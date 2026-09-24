import { createHash, randomBytes } from 'crypto';
import path from 'path';
import type { FileType } from '@surco/db';
import { logAudit, type AuditContext } from '@surco/audit';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { putObject, getObjectStream, type StoredObject } from '../../plugins/storage';

/** Tamaño máximo por archivo: 25 MB. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const FILE_TYPES = [
  'RADIOGRAPHY',
  'CBCT',
  'LAB_RESULT',
  'CLINICAL_PHOTO',
  'REFERRAL_DOC',
  'PRESCRIPTION_PDF',
  'CONSENT_PDF',
  'REPORT',
  'OTHER',
] as const satisfies readonly FileType[];

export function isFileType(v: unknown): v is FileType {
  return typeof v === 'string' && (FILE_TYPES as readonly string[]).includes(v);
}

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/dicom',
] as const;

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
  'application/dicom': '.dcm',
};

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

/**
 * Detecta el tipo real por la firma binaria ("magic bytes"). No confiamos en
 * el Content-Type que manda el navegador: así nadie puede subir un HTML
 * disfrazado de imagen y que luego se sirva inline.
 */
function sniffMimeType(buf: Buffer): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  if (buf.subarray(0, 1024).indexOf('%PDF-') !== -1) return 'application/pdf';
  if (buf.length >= 132 && buf.toString('ascii', 128, 132) === 'DICM') return 'application/dicom';
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp' && HEIC_BRANDS.has(buf.toString('ascii', 8, 12))) {
    return 'image/heic';
  }
  return null;
}

/** Tipo MIME definitivo del archivo, o FILE_TYPE_NOT_ALLOWED si no es permitido. */
export function resolveMimeType(buf: Buffer, declaredMime: string, fileName: string): string {
  const sniffed = sniffMimeType(buf);
  if (sniffed) return sniffed;
  // DICOM sin preámbulo "DICM" (equipos antiguos): se acepta por extensión/declaración.
  // Se sirve como application/dicom, que el navegador descarga y no renderiza.
  const ext = path.extname(fileName).toLowerCase();
  if (declaredMime === 'application/dicom' || ext === '.dcm' || ext === '.dicom') return 'application/dicom';
  throw new AppError('FILE_TYPE_NOT_ALLOWED', 400);
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Nombre visible: sin rutas ("C:\fakepath\..."), sin caracteres de control, máx. 200. */
function displayFileName(raw: string, mimeType: string): string {
  const base = (raw || '').split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  let name = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!name) name = `archivo-${new Date().toISOString().slice(0, 10)}${EXTENSION_BY_MIME[mimeType] ?? ''}`;
  if (name.length > 200) {
    const ext = path.extname(name).slice(0, 10);
    name = name.slice(0, 200 - ext.length) + ext;
  }
  return name;
}

/** Nombre seguro para la key de almacenamiento: ascii, minúsculas, guiones. */
function storageSafeName(name: string, mimeType: string): string {
  const ext = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '') || EXTENSION_BY_MIME[mimeType] || '';
  const stem = stripAccents(path.basename(name, path.extname(name)))
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return `${stem || 'archivo'}${ext.slice(0, 10)}`;
}

/** Campos públicos (no exponemos bucket/key internos). */
const FILE_SELECT = {
  id: true,
  patientId: true,
  type: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  uploadedBy: true,
  uploadedAt: true,
} as const;

async function resolveUserNames(tenantId: string, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique }, tenantId },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

async function assertPatientInTenant(tenantId: string, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId },
    select: { id: true },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);
  return patient;
}

// ─────────────────────────────────────────────────────────────
// Subir
// ─────────────────────────────────────────────────────────────

export interface UploadFileInput {
  patientId: string;
  type: FileType;
  fileName: string;
  declaredMime: string;
  buffer: Buffer;
}

export async function uploadFile(ctx: AuditContext, input: UploadFileInput) {
  await assertPatientInTenant(ctx.tenantId, input.patientId);

  const sizeBytes = input.buffer.length;
  if (sizeBytes === 0) throw new AppError('FILE_EMPTY', 400);
  if (sizeBytes > MAX_FILE_BYTES) throw new AppError('FILE_TOO_LARGE', 413);

  const mimeType = resolveMimeType(input.buffer, input.declaredMime, input.fileName);
  const fileName = displayFileName(input.fileName, mimeType);
  const sha256 = createHash('sha256').update(input.buffer).digest('hex');
  const key = [
    'tenants', ctx.tenantId,
    'patients', input.patientId,
    `${Date.now()}-${randomBytes(4).toString('hex')}-${storageSafeName(fileName, mimeType)}`,
  ].join('/');

  const stored = await putObject(key, input.buffer, mimeType);

  const file = await prisma.clinicalFile.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      type: input.type,
      fileName,
      mimeType,
      sizeBytes,
      s3Bucket: stored.bucket,
      s3Key: key,
      s3Etag: stored.etag,
      sha256,
      uploadedBy: ctx.actorId ?? 'unknown',
    },
    select: FILE_SELECT,
  });

  await logAudit({
    ctx,
    action: 'UPLOAD_FILE',
    entityType: 'ClinicalFile',
    entityId: file.id,
    metadata: { patientId: input.patientId, type: input.type, mimeType, sizeBytes, sha256 },
  });

  const names = await resolveUserNames(ctx.tenantId, [file.uploadedBy]);
  return { ...file, uploadedByName: names.get(file.uploadedBy) ?? null };
}

// ─────────────────────────────────────────────────────────────
// Listar
// ─────────────────────────────────────────────────────────────

export async function listFiles(ctx: AuditContext, patientId: string, type?: FileType) {
  await assertPatientInTenant(ctx.tenantId, patientId);

  const files = await prisma.clinicalFile.findMany({
    where: { tenantId: ctx.tenantId, patientId, archivedAt: null, ...(type && { type }) },
    orderBy: { uploadedAt: 'desc' },
    select: FILE_SELECT,
  });

  const names = await resolveUserNames(ctx.tenantId, files.map((f) => f.uploadedBy));
  return files.map((f) => ({ ...f, uploadedByName: names.get(f.uploadedBy) ?? null }));
}

// ─────────────────────────────────────────────────────────────
// Ver / descargar
// ─────────────────────────────────────────────────────────────

export interface FileContent {
  file: { id: string; fileName: string; mimeType: string; sizeBytes: number };
  object: StoredObject;
}

export async function getFileContent(
  ctx: AuditContext,
  id: string,
  opts: { download: boolean },
): Promise<FileContent> {
  const file = await prisma.clinicalFile.findFirst({
    where: { id, tenantId: ctx.tenantId, archivedAt: null },
    select: {
      id: true, patientId: true, fileName: true, mimeType: true, sizeBytes: true,
      s3Bucket: true, s3Key: true,
    },
  });
  if (!file) throw new AppError('FILE_NOT_FOUND', 404);

  const object = await getObjectStream(file.s3Key, file.s3Bucket);

  await logAudit({
    ctx,
    action: 'DOWNLOAD_FILE',
    entityType: 'ClinicalFile',
    entityId: file.id,
    metadata: { patientId: file.patientId, disposition: opts.download ? 'attachment' : 'inline' },
  });

  return {
    file: { id: file.id, fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes },
    object,
  };
}

/**
 * Content-Disposition seguro para cualquier nombre (tildes, ñ, emojis):
 * `filename` ASCII de respaldo + `filename*` UTF-8 (RFC 6266 / 5987).
 */
export function contentDisposition(kind: 'inline' | 'attachment', fileName: string): string {
  const ascii = stripAccents(fileName).replace(/[^\x20-\x7e]|["\\%;]/g, '_') || 'archivo';
  const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

// ─────────────────────────────────────────────────────────────
// Archivar (soft delete)
// ─────────────────────────────────────────────────────────────

export async function archiveFile(ctx: AuditContext, id: string) {
  const file = await prisma.clinicalFile.findFirst({
    where: { id, tenantId: ctx.tenantId, archivedAt: null },
    select: { id: true, patientId: true, fileName: true, type: true },
  });
  if (!file) throw new AppError('FILE_NOT_FOUND', 404);

  const archivedAt = new Date();
  await prisma.clinicalFile.update({ where: { id: file.id }, data: { archivedAt } });

  await logAudit({
    ctx,
    action: 'DELETE_FILE',
    entityType: 'ClinicalFile',
    entityId: file.id,
    metadata: { patientId: file.patientId, fileName: file.fileName, type: file.type, softDelete: true },
  });

  return { id: file.id, archivedAt };
}

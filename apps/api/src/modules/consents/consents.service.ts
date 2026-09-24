import { createHash } from 'crypto';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import type {
  CreateConsentTemplateInput, UpdateConsentTemplateInput,
  PreviewConsentInput, IssueConsentInput,
} from '@surco/shared';
import { DEFAULT_CONSENT_TEMPLATES } from './consent-templates';

/**
 * Consentimientos informados con firma electrónica del paciente.
 *
 * - El texto se renderiza SIEMPRE en el servidor: el snapshot `bodyRendered`
 *   guardado es el que vale legalmente (no el que envía el cliente).
 * - No-repudio: bodyHash = SHA-256(bodyRendered + signatureImg), junto con
 *   fecha/hora, IP y userAgent de la firma (Ley 527 de 1999).
 * - ConsentTemplate no tiene relación Prisma con Tenant: se filtra por tenantId a mano.
 */

const DEFAULT_TIMEZONE = 'America/Bogota';

/** Texto que se usa cuando no se escribe un procedimiento al emitir. */
export const DEFAULT_PROCEDURE_TEXT = 'Según el plan de tratamiento explicado por el profesional tratante.';

const DOC_LABEL: Record<string, string> = {
  CC: 'C.C.', TI: 'T.I.', CE: 'C.E.', RC: 'R.C.', PA: 'Pasaporte', PASSPORT: 'Pasaporte',
  DNI: 'DNI', RFC: 'RFC', OTHER: 'Documento',
};

// Firma: data URL de imagen rasterizada en base64 (nunca SVG: podría llevar scripts).
const SIGNATURE_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

const templateSelect = {
  id: true, name: true, bodyMarkdown: true, version: true, isActive: true, createdAt: true,
} as const;

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function normalizeBody(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

function safeTimeZone(tz: string | null | undefined): string {
  const candidate = tz || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('es-CO', { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function longDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone,
  }).format(date);
}

/** Edad en años cumplidos, tomando "hoy" en la zona horaria de la clínica. */
function ageLabel(birthdate: Date, now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'numeric', day: 'numeric', timeZone,
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const y = get('year'); const m = get('month'); const d = get('day');
  // birthdate se guarda como fecha (medianoche UTC): se leen sus partes en UTC
  const by = birthdate.getUTCFullYear(); const bm = birthdate.getUTCMonth() + 1; const bd = birthdate.getUTCDate();
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  if (age < 1) return 'menos de 1 año';
  return age === 1 ? '1 año' : `${age} años`;
}

function cleanProcedure(text: string | undefined): string {
  return (text ?? '').replace(/\{\{|\}\}/g, '').replace(/\s+/g, ' ').trim();
}

/** Reemplaza {{merge.tags}}. Los tags desconocidos se dejan tal cual. */
export function renderConsentBody(body: string, vars: Record<string, string>): string {
  return normalizeBody(body).replace(/\{\{\s*([a-zA-Z_.]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

/** Extrae el "Procedimiento / detalle" del snapshot (para mostrarlo en la lista). */
function extractProcedure(bodyRendered: string): string | null {
  const m = bodyRendered.match(/^\*\*Procedimiento[^*\n]*\*\*\s*(.+)$/m);
  const value = m?.[1]?.trim();
  if (!value || value === DEFAULT_PROCEDURE_TEXT) return null;
  return value.length > 140 ? `${value.slice(0, 137)}…` : value;
}

// ============================================================
// Plantillas
// ============================================================

/**
 * Si la clínica no tiene NINGUNA plantilla (ni activa ni inactiva), crea las
 * plantillas por defecto. Idempotente incluso con peticiones simultáneas
 * (advisory lock por tenant dentro de la transacción).
 */
async function ensureDefaultTemplates(tenantId: string): Promise<void> {
  const existing = await prisma.consentTemplate.count({ where: { tenantId } });
  if (existing > 0) return;

  await prisma.$transaction(async (tx) => {
    const lockKey = `consent-templates:${tenantId}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const again = await tx.consentTemplate.count({ where: { tenantId } });
    if (again > 0) return;
    // createdAt escalonado para conservar el orden de presentación
    const base = Date.now() - DEFAULT_CONSENT_TEMPLATES.length * 1000;
    await tx.consentTemplate.createMany({
      data: DEFAULT_CONSENT_TEMPLATES.map((t, i) => ({
        tenantId,
        name: t.name,
        bodyMarkdown: normalizeBody(t.bodyMarkdown),
        createdAt: new Date(base + i * 1000),
      })),
    });
  });
}

export async function listTemplates(ctx: AuditContext, includeInactive: boolean) {
  await ensureDefaultTemplates(ctx.tenantId);
  return prisma.consentTemplate.findMany({
    where: { tenantId: ctx.tenantId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: [{ createdAt: 'asc' }, { name: 'asc' }],
    select: templateSelect,
  });
}

export async function createTemplate(ctx: AuditContext, input: CreateConsentTemplateInput) {
  const template = await prisma.consentTemplate.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      bodyMarkdown: normalizeBody(input.bodyMarkdown),
      isActive: input.isActive ?? true,
    },
    select: templateSelect,
  });
  await logAudit({
    ctx, action: 'CREATE_CONSENT_TEMPLATE', entityType: 'ConsentTemplate', entityId: template.id,
    metadata: { name: template.name },
  });
  return template;
}

export async function updateTemplate(ctx: AuditContext, id: string, input: UpdateConsentTemplateInput) {
  const current = await prisma.consentTemplate.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, bodyMarkdown: true, version: true },
  });
  if (!current) throw new AppError('TEMPLATE_NOT_FOUND', 404);

  const newBody = input.bodyMarkdown !== undefined ? normalizeBody(input.bodyMarkdown) : undefined;
  const bodyChanged = newBody !== undefined && newBody !== current.bodyMarkdown;

  const template = await prisma.consentTemplate.update({
    where: { id: current.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      // Cambiar el texto crea una nueva versión; lo ya firmado conserva su snapshot.
      ...(bodyChanged ? { bodyMarkdown: newBody, version: { increment: 1 } } : {}),
    },
    select: templateSelect,
  });
  await logAudit({
    ctx, action: 'UPDATE_CONSENT_TEMPLATE', entityType: 'ConsentTemplate', entityId: template.id,
    metadata: {
      bodyChanged,
      fromVersion: current.version,
      toVersion: template.version,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
  return template;
}

// ============================================================
// Render (preview y emisión comparten exactamente la misma lógica)
// ============================================================

async function buildRender(ctx: AuditContext, input: PreviewConsentInput) {
  const [patient, template, tenant, professional] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: input.patientId, tenantId: ctx.tenantId, isActive: true },
      select: { id: true, fullName: true, documentType: true, documentId: true, birthdate: true },
    }),
    prisma.consentTemplate.findFirst({
      where: { id: input.templateId, tenantId: ctx.tenantId, isActive: true },
      select: { id: true, name: true, version: true, bodyMarkdown: true },
    }),
    prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { tradeName: true, legalName: true, timezone: true },
    }),
    ctx.actorId
      ? prisma.user.findFirst({
        where: { id: ctx.actorId, tenantId: ctx.tenantId },
        select: { fullName: true, licenseNumber: true },
      })
      : Promise.resolve(null),
  ]);
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);
  if (!template) throw new AppError('TEMPLATE_NOT_FOUND', 404);
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);

  const tz = safeTimeZone(tenant.timezone);
  const now = new Date();
  const docLabel = DOC_LABEL[patient.documentType] ?? patient.documentType;
  const procedure = cleanProcedure(input.procedureDetail);

  const vars: Record<string, string> = {
    'paciente.nombre': patient.fullName,
    'paciente.documento': `${docLabel} ${patient.documentId}`,
    'paciente.edad': ageLabel(patient.birthdate, now, tz),
    'clinica.nombre': tenant.tradeName || tenant.legalName,
    'profesional.nombre': professional?.fullName ?? '________________________',
    'profesional.registro': professional?.licenseNumber?.trim() || '________________',
    'fecha': longDate(now, tz),
    'procedimiento': procedure || DEFAULT_PROCEDURE_TEXT,
  };

  return {
    patient,
    template,
    procedure,
    bodyRendered: renderConsentBody(template.bodyMarkdown, vars),
  };
}

export async function previewConsent(ctx: AuditContext, input: PreviewConsentInput) {
  const r = await buildRender(ctx, input);
  return {
    bodyRendered: r.bodyRendered,
    template: { id: r.template.id, name: r.template.name, version: r.template.version },
    patient: {
      id: r.patient.id,
      fullName: r.patient.fullName,
      documentType: r.patient.documentType,
      documentId: r.patient.documentId,
    },
  };
}

// ============================================================
// Emisión y firma
// ============================================================

/** Valida la firma antes de cualquier otra cosa (también se llama desde la ruta). */
export function assertSignature(signatureImg: unknown): void {
  if (typeof signatureImg !== 'string' || !signatureImg.startsWith('data:image/')) {
    throw new AppError('SIGNATURE_REQUIRED', 400);
  }
  if (!SIGNATURE_RE.test(signatureImg)) {
    throw new AppError('SIGNATURE_INVALID', 400);
  }
}

export async function issueConsent(ctx: AuditContext, input: IssueConsentInput) {
  assertSignature(input.signatureImg);
  // input.professionalSignatureImg se ignora a propósito: no hay columna para guardarla.

  const r = await buildRender(ctx, input);
  const signedAt = new Date();
  const bodyHash = sha256(r.bodyRendered + input.signatureImg);

  const consent = await prisma.consent.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: r.patient.id,
      templateId: r.template.id,
      bodyRendered: r.bodyRendered,
      signedAt,
      signatureImg: input.signatureImg,
      signatureIp: ctx.ipAddress ?? null,
      signatureUserAgent: ctx.userAgent ? ctx.userAgent.slice(0, 500) : null,
      bodyHash,
    },
    select: { id: true, signedAt: true, bodyHash: true, createdAt: true },
  });

  await logAudit({
    ctx, action: 'SIGN_CONSENT', entityType: 'Consent', entityId: consent.id,
    metadata: {
      patientId: r.patient.id,
      templateId: r.template.id,
      templateName: r.template.name,
      templateVersion: r.template.version,
      procedureDetail: r.procedure || null,
      bodyHash,
    },
  });

  return {
    id: consent.id,
    signedAt: consent.signedAt,
    createdAt: consent.createdAt,
    bodyHash: consent.bodyHash,
    bodyHashShort: consent.bodyHash.slice(0, 12),
    templateName: r.template.name,
  };
}

// ============================================================
// Consulta
// ============================================================

export async function listConsents(ctx: AuditContext, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const rows = await prisma.consent.findMany({
    where: { tenantId: ctx.tenantId, patientId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, signedAt: true, createdAt: true, bodyHash: true, bodyRendered: true,
      template: { select: { id: true, name: true, version: true } },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    templateId: c.template.id,
    templateName: c.template.name,
    templateVersion: c.template.version,
    signedAt: c.signedAt,
    createdAt: c.createdAt,
    bodyHashShort: c.bodyHash.slice(0, 12),
    procedureDetail: extractProcedure(c.bodyRendered),
  }));
}

/**
 * Detalle completo (para la vista imprimible). La lectura queda en el audit log
 * porque el consentimiento hace parte de la historia clínica (Res. 1995/1999).
 */
export async function getConsent(ctx: AuditContext, id: string) {
  const consent = await prisma.consent.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: {
      id: true, bodyRendered: true, signedAt: true, signatureImg: true, signatureIp: true,
      signatureUserAgent: true, bodyHash: true, createdAt: true,
      patient: {
        select: {
          id: true, fullName: true, documentType: true, documentId: true,
          birthdate: true, phone: true, insurerName: true,
        },
      },
      template: { select: { id: true, name: true, version: true } },
    },
  });
  if (!consent) throw new AppError('CONSENT_NOT_FOUND', 404);

  const [clinic, signEvent] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { tradeName: true, legalName: true, taxId: true, taxIdType: true, timezone: true },
    }),
    // Quién emitió el consentimiento (no hay columna: se toma del audit log de la firma)
    prisma.auditLog.findFirst({
      where: { tenantId: ctx.tenantId, entityType: 'Consent', entityId: consent.id, action: 'SIGN_CONSENT' },
      orderBy: { createdAt: 'asc' },
      select: { actor: { select: { fullName: true, licenseNumber: true, specialty: true } } },
    }),
  ]);

  await logAudit({
    ctx, action: 'READ_CONSENT', entityType: 'Consent', entityId: consent.id,
    metadata: { patientId: consent.patient.id, templateId: consent.template.id },
  });

  return {
    ...consent,
    procedureDetail: extractProcedure(consent.bodyRendered),
    clinic: clinic
      ? { ...clinic, timezone: safeTimeZone(clinic.timezone) }
      : null,
    issuedBy: signEvent?.actor ?? null,
  };
}

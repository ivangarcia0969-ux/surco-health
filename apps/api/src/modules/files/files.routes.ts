import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import type { FileType } from '@surco/db';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import { AppError } from '../../utils/errors';
import * as svc from './files.service';

/** Traduce los errores de @fastify/multipart a códigos que entiende el front. */
function mapMultipartError(err: unknown): unknown {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'FST_REQ_FILE_TOO_LARGE':
      return new AppError('FILE_TOO_LARGE', 413);
    case 'FST_FILES_LIMIT':
      return new AppError('TOO_MANY_FILES', 400);
    case 'FST_PARTS_LIMIT':
    case 'FST_FIELDS_LIMIT':
    case 'FST_PROTO_VIOLATION':
      return new AppError('VALIDATION', 400);
    case 'FST_INVALID_MULTIPART_CONTENT_TYPE':
      return new AppError('MULTIPART_REQUIRED', 406);
    default:
      return err;
  }
}

/**
 * Archivos clínicos (radiografías, fotos, PDFs). Se registra con prefix `/api/files`.
 * El binario SIEMPRE pasa por el API (MinIO es interno, sin URLs prefirmadas).
 */
export default async function filesRoutes(app: FastifyInstance) {
  // Multipart solo dentro de este plugin (encapsulado): 25 MB y 1 archivo.
  await app.register(multipart, {
    limits: {
      fileSize: svc.MAX_FILE_BYTES,
      files: 1,
      fields: 10,
      fieldSize: 64 * 1024,
      parts: 12,
    },
  });

  // Subir: multipart con `file` + `patientId` + `type` (FileType).
  app.post(
    '/',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST')] },
    async (req, reply) => {
      if (!req.isMultipart()) throw new AppError('MULTIPART_REQUIRED', 406);

      const fields: Record<string, string> = {};
      let upload: { buffer: Buffer; fileName: string; mimeType: string } | null = null;

      try {
        for await (const part of req.parts()) {
          if (part.type === 'file') {
            // Hay que consumir el stream siempre, aunque el campo no sea el esperado.
            const buffer = await part.toBuffer();
            if (part.fieldname === 'file' && !upload) {
              upload = { buffer, fileName: part.filename, mimeType: part.mimetype };
            }
          } else if (typeof part.value === 'string') {
            fields[part.fieldname] = part.value;
          }
        }
      } catch (err) {
        throw mapMultipartError(err);
      }

      if (!upload) throw new AppError('FILE_REQUIRED', 400);

      const patientId = (fields.patientId ?? '').trim();
      if (!patientId || patientId.length > 64) {
        throw new AppError('VALIDATION', 400, { field: 'patientId' });
      }
      const type = (fields.type ?? '').trim();
      if (!svc.isFileType(type)) {
        throw new AppError('VALIDATION', 400, { field: 'type', allowed: svc.FILE_TYPES });
      }

      const file = await svc.uploadFile(auditContextFromReq(req), {
        patientId,
        type,
        fileName: upload.fileName,
        declaredMime: upload.mimeType,
        buffer: upload.buffer,
      });
      return reply.code(201).send(file);
    },
  );

  // Listar archivos activos (no archivados) de un paciente.
  app.get<{ Querystring: { patientId?: string; type?: string } }>(
    '/',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST')] },
    async (req) => {
      const patientId = (req.query.patientId ?? '').trim();
      if (!patientId) throw new AppError('VALIDATION', 400, { field: 'patientId' });
      const rawType = req.query.type?.trim();
      let type: FileType | undefined;
      if (rawType) {
        if (!svc.isFileType(rawType)) {
          throw new AppError('VALIDATION', 400, { field: 'type', allowed: svc.FILE_TYPES });
        }
        type = rawType;
      }
      return svc.listFiles(auditContextFromReq(req), patientId, type);
    },
  );

  // Contenido binario (stream). `?download=1` fuerza descarga como adjunto.
  app.get<{ Params: { id: string }; Querystring: { download?: string } }>(
    '/:id/content',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL')] },
    async (req, reply) => {
      const download = req.query.download === '1' || req.query.download === 'true';
      const { file, object } = await svc.getFileContent(auditContextFromReq(req), req.params.id, { download });

      reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', svc.contentDisposition(download ? 'attachment' : 'inline', file.fileName))
        .header('Cache-Control', 'private, max-age=300')
        .header('X-Content-Type-Options', 'nosniff');
      if (typeof object.contentLength === 'number') reply.header('Content-Length', object.contentLength);
      return reply.send(object.body);
    },
  );

  // Archivar (soft delete: archivedAt = now).
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL')] },
    async (req) => svc.archiveFile(auditContextFromReq(req), req.params.id),
  );
}

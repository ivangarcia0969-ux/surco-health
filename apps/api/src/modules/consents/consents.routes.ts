import type { FastifyInstance } from 'fastify';
import {
  createConsentTemplateSchema, updateConsentTemplateSchema, listConsentTemplatesQuerySchema,
  previewConsentSchema, issueConsentSchema, listConsentsQuerySchema,
} from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './consents.service';

/** Roles que pueden emitir, firmar y consultar consentimientos. */
const CONSENT_ROLES = ['CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST'] as const;

/** La firma PNG pesa ~30–300 KB en base64; margen hasta 2 MB. */
const SIGN_BODY_LIMIT = 2 * 1024 * 1024;

/** Registrar con prefix `/api/consents`. */
export default async function consentsRoutes(app: FastifyInstance) {
  // ───────────── Plantillas ─────────────

  // Lista plantillas activas. Si la clínica no tiene ninguna, crea las de por defecto.
  // ?includeInactive=true (solo dueño) devuelve también las desactivadas.
  app.get(
    '/templates',
    { preHandler: [authMiddleware, requireRole(...CONSENT_ROLES)] },
    async (req, reply) => {
      const parsed = listConsentTemplatesQuerySchema.safeParse(req.query ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const includeInactive = parsed.data.includeInactive && req.auth.role === 'CLINIC_OWNER';
      return svc.listTemplates(auditContextFromReq(req), includeInactive);
    },
  );

  app.post(
    '/templates',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createConsentTemplateSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createTemplate(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/templates/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = updateConsentTemplateSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updateTemplate(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );

  // ───────────── Vista previa (texto con merge tags reemplazados) ─────────────

  app.post(
    '/preview',
    { preHandler: [authMiddleware, requireRole(...CONSENT_ROLES)] },
    async (req, reply) => {
      const parsed = previewConsentSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.previewConsent(auditContextFromReq(req), parsed.data);
    },
  );

  // ───────────── Emitir y firmar ─────────────

  app.post(
    '/',
    { bodyLimit: SIGN_BODY_LIMIT, preHandler: [authMiddleware, requireRole(...CONSENT_ROLES)] },
    async (req, reply) => {
      // La firma se valida primero para devolver un error claro (SIGNATURE_REQUIRED)
      svc.assertSignature((req.body as { signatureImg?: unknown } | null)?.signatureImg);
      const parsed = issueConsentSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.issueConsent(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );

  // ───────────── Consulta ─────────────

  app.get(
    '/',
    { preHandler: [authMiddleware, requireRole(...CONSENT_ROLES)] },
    async (req, reply) => {
      const parsed = listConsentsQuerySchema.safeParse(req.query ?? {});
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.listConsents(auditContextFromReq(req), parsed.data.patientId);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware, requireRole(...CONSENT_ROLES)] },
    async (req) => svc.getConsent(auditContextFromReq(req), req.params.id),
  );
}

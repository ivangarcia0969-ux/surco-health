import type { FastifyInstance } from 'fastify';
import {
  createPrescriptionSchema, listPrescriptionsQuerySchema, cancelPrescriptionSchema,
  professionalSignatureSchema,
} from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './prescriptions.service';

/**
 * Recetas / fórmula médica. Se registra con prefix `/api/prescriptions`.
 *
 * Nota de orden: las rutas estáticas (`/me/signature`) se declaran antes que
 * las paramétricas (`/:id`). find-my-way de todas formas prioriza las estáticas.
 */
export default async function prescriptionsRoutes(app: FastifyInstance) {
  const clinicians = [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')];

  // ---------- Firma del profesional autenticado ----------
  app.get('/me/signature', { preHandler: clinicians }, async (req) =>
    svc.getMySignature(auditContextFromReq(req)),
  );

  app.put('/me/signature', { preHandler: clinicians }, async (req, reply) => {
    const parsed = professionalSignatureSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
    return svc.updateMySignature(auditContextFromReq(req), parsed.data.signatureImg);
  });

  // ---------- Recetas ----------
  app.get('/', { preHandler: clinicians }, async (req, reply) => {
    const parsed = listPrescriptionsQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
    return svc.listPrescriptions(auditContextFromReq(req), parsed.data.patientId);
  });

  app.post('/', { preHandler: clinicians }, async (req, reply) => {
    const parsed = createPrescriptionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
    const r = await svc.createPrescription(auditContextFromReq(req), parsed.data);
    return reply.code(201).send(r);
  });

  // Lectura individual con audit log (READ_PRESCRIPTION)
  app.get<{ Params: { id: string } }>('/:id', { preHandler: clinicians }, async (req) =>
    svc.getPrescription(auditContextFromReq(req), req.params.id),
  );

  // Firmar y emitir un borrador (solo el autor)
  app.post<{ Params: { id: string } }>('/:id/issue', { preHandler: clinicians }, async (req) =>
    svc.issuePrescription(auditContextFromReq(req), req.params.id),
  );

  // Anular (autor o CLINIC_OWNER)
  app.post<{ Params: { id: string } }>('/:id/cancel', { preHandler: clinicians }, async (req, reply) => {
    const parsed = cancelPrescriptionSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
    return svc.cancelPrescription(auditContextFromReq(req), req.auth.role, req.params.id, parsed.data.reason);
  });
}

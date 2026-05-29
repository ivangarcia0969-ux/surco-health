import type { FastifyInstance } from 'fastify';
import {
  createConsultationSchema, createEvolutionNoteSchema, createAmendmentSchema,
  listClinicalRecordsQuerySchema,
} from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './clinical.service';

export default async function clinicalRoutes(app: FastifyInstance) {
  app.get(
    '/records',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL')] },
    async (req, reply) => {
      const parsed = listClinicalRecordsQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.listClinicalRecords(auditContextFromReq(req), req.auth.role, parsed.data);
    },
  );

  // Lectura individual con audit log obligatorio (Res 1995/1999 Art. 9)
  app.get<{ Params: { id: string } }>(
    '/records/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL')] },
    async (req) => svc.getClinicalRecord(auditContextFromReq(req), req.auth.role, req.params.id),
  );

  app.post(
    '/consultations',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createConsultationSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createConsultation(auditContextFromReq(req), req.auth.role, parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.post(
    '/evolution-notes',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createEvolutionNoteSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createEvolutionNote(auditContextFromReq(req), req.auth.role, parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.post(
    '/amendments',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createAmendmentSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createAmendment(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );
}

import type { FastifyInstance } from 'fastify';
import { createPatientSchema, updatePatientSchema, listPatientsQuerySchema } from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './patients.service';
import { z } from 'zod';

const archiveSchema = z.object({ reason: z.string().min(3).max(300) });

export default async function patientsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST', 'BILLING')] },
    async (req, reply) => {
      const parsed = listPatientsQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.listPatients(req.auth.tenantId!, parsed.data);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST')] },
    async (req) => svc.getPatient(auditContextFromReq(req), req.params.id),
  );

  app.post(
    '/',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST')] },
    async (req, reply) => {
      const parsed = createPatientSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const created = await svc.createPatient(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST')] },
    async (req, reply) => {
      const parsed = updatePatientSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updatePatient(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/:id/archive',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = archiveSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      await svc.archivePatient(auditContextFromReq(req), req.params.id, parsed.data.reason);
      return reply.code(204).send();
    },
  );
}

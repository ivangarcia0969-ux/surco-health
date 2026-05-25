import type { FastifyInstance } from 'fastify';
import {
  createSoapNoteSchema, updatePsychologyProfileSchema, applyPsychometricTestSchema,
} from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './psychology.service';

export default async function psychologyRoutes(app: FastifyInstance) {
  app.post(
    '/soap-notes',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createSoapNoteSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createSoapNote(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/soap-notes/:id',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req) => svc.readSoapNote(auditContextFromReq(req), req.params.id),
  );

  app.put<{ Params: { patientId: string } }>(
    '/profile/:patientId',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = updatePsychologyProfileSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updatePsychologyProfile(auditContextFromReq(req), req.params.patientId, parsed.data);
    },
  );

  app.post(
    '/tests/apply',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = applyPsychometricTestSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.applyTest(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.get('/tests', { preHandler: [authMiddleware] }, async () => svc.listAvailableTests());
}

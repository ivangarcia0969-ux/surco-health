import type { FastifyInstance } from 'fastify';
import { vitalSignsSchema, updateMedicalProfileSchema, icd10SearchSchema } from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './medical.service';
import { z } from 'zod';

const recordVitalsBody = z.object({
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  vitals: vitalSignsSchema,
});

export default async function medicalRoutes(app: FastifyInstance) {
  app.post(
    '/vital-signs',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = recordVitalsBody.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.recordVitalSigns(
        auditContextFromReq(req),
        parsed.data.patientId,
        parsed.data.appointmentId,
        parsed.data.vitals,
      );
      return reply.code(201).send(r);
    },
  );

  app.get<{ Params: { patientId: string } }>(
    '/profile/:patientId',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req) => svc.getMedicalProfile(auditContextFromReq(req), req.params.patientId),
  );

  app.put<{ Params: { patientId: string } }>(
    '/profile/:patientId',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = updateMedicalProfileSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updateMedicalProfile(auditContextFromReq(req), req.params.patientId, parsed.data);
    },
  );

  app.get(
    '/icd10/search',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      const parsed = icd10SearchSchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION' });
      return svc.searchIcd10(parsed.data);
    },
  );
}

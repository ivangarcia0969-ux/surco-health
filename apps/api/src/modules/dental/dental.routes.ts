import type { FastifyInstance } from 'fastify';
import { updateDentalChartSchema, createDentalTreatmentSchema } from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './dental.service';

export default async function dentalRoutes(app: FastifyInstance) {
  app.get<{ Params: { patientId: string } }>(
    '/chart/:patientId',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL')] },
    async (req) => svc.getDentalChart(auditContextFromReq(req), req.params.patientId),
  );

  app.put<{ Params: { patientId: string } }>(
    '/chart/:patientId',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL')] },
    async (req, reply) => {
      const parsed = updateDentalChartSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updateDentalChart(auditContextFromReq(req), req.params.patientId, parsed.data);
    },
  );

  app.post(
    '/treatments',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createDentalTreatmentSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createDentalTreatment(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.get<{ Params: { patientId: string } }>(
    '/procedures/:patientId',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL')] },
    async (req) => svc.listProcedures(auditContextFromReq(req), req.params.patientId),
  );

  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/procedures/:id/status',
    { preHandler: [authMiddleware, requireRole('PROFESSIONAL', 'CLINIC_OWNER')] },
    async (req, reply) => {
      const { status } = req.body;
      if (!['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return reply.code(400).send({ error: 'INVALID_STATUS' });
      }
      return svc.updateProcedureStatus(auditContextFromReq(req), req.params.id, status as any);
    },
  );
}

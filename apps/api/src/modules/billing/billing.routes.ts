import type { FastifyInstance } from 'fastify';
import { createPaymentSchema, billingSummaryQuerySchema } from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './billing.service';

export default async function billingRoutes(app: FastifyInstance) {
  app.post(
    '/payments',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST', 'BILLING')] },
    async (req, reply) => {
      const parsed = createPaymentSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createPayment(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.get<{ Params: { patientId: string } }>(
    '/patients/:patientId/account',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST', 'BILLING')] },
    async (req) => svc.getPatientAccount(auditContextFromReq(req), req.params.patientId),
  );

  app.get<{ Params: { id: string } }>(
    '/receipts/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST', 'BILLING')] },
    async (req) => svc.getReceipt(auditContextFromReq(req), req.params.id),
  );

  app.get(
    '/summary',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'BILLING', 'RECEPTIONIST')] },
    async (req, reply) => {
      const parsed = billingSummaryQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.getSummary(auditContextFromReq(req), parsed.data);
    },
  );

  app.get(
    '/receipts',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'BILLING', 'RECEPTIONIST')] },
    async (req, reply) => {
      const parsed = billingSummaryQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.listReceipts(auditContextFromReq(req), parsed.data);
    },
  );
}

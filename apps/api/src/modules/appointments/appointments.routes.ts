import type { FastifyInstance } from 'fastify';
import {
  createAppointmentSchema, updateAppointmentSchema, listAppointmentsQuerySchema,
} from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import { enforceMonthlyAppointmentsLimit } from '../../middlewares/plan-limits';
import * as svc from './appointments.service';

export default async function appointmentsRoutes(app: FastifyInstance) {
  app.get(
    '/',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST')] },
    async (req, reply) => {
      const parsed = listAppointmentsQuerySchema.safeParse(req.query);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.listAppointments(auditContextFromReq(req), req.auth.role, parsed.data);
    },
  );

  app.post(
    '/',
    {
      preHandler: [
        authMiddleware,
        requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST'),
        enforceMonthlyAppointmentsLimit,
      ],
    },
    async (req, reply) => {
      const parsed = createAppointmentSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const appt = await svc.createAppointment(auditContextFromReq(req), req.auth.role, parsed.data);
      return reply.code(201).send(appt);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST')] },
    async (req, reply) => {
      const parsed = updateAppointmentSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updateAppointment(auditContextFromReq(req), req.auth.role, req.params.id, parsed.data);
    },
  );
}

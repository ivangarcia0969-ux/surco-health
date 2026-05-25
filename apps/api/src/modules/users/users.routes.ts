import type { FastifyInstance } from 'fastify';
import { createProfessionalSchema, createStaffSchema, updateUserSchema } from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import { enforceProfessionalLimit } from '../../middlewares/plan-limits';
import * as svc from './users.service';

export default async function usersRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [authMiddleware] }, async (req) => svc.getMe(req.auth.userId));

  app.get('/professionals', { preHandler: [authMiddleware] }, async (req) =>
    svc.listProfessionals(req.auth.tenantId!),
  );

  app.get('/staff', { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] }, async (req) =>
    svc.listStaff(req.auth.tenantId!),
  );

  app.post(
    '/professionals',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER'), enforceProfessionalLimit(1)] },
    async (req, reply) => {
      const parsed = createProfessionalSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const u = await svc.createProfessional(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(u);
    },
  );

  app.post(
    '/staff',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createStaffSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const u = await svc.createStaff(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(u);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updateUser(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );
}

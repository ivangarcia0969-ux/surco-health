import type { FastifyInstance } from 'fastify';
import { updateTenantSchema, createSiteSchema, createRoomSchema } from '@surco/shared';
import { authMiddleware, requireRole } from '../../middlewares/auth';
import { requirePlanFeature } from '../../middlewares/plan-limits';
import * as svc from './tenants.service';

export default async function tenantsRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: [authMiddleware] }, async (req) =>
    svc.getMyTenant(req.auth.tenantId!),
  );

  app.patch('/me', { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] }, async (req, reply) => {
    const parsed = updateTenantSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
    return svc.updateMyTenant(req.auth.tenantId!, parsed.data);
  });

  app.get('/me/usage', { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] }, async (req) =>
    svc.getUsage(req.auth.tenantId!),
  );

  app.get('/plans', { preHandler: [authMiddleware] }, async () => svc.listPlans());

  // === Sedes ===
  app.get('/sites', { preHandler: [authMiddleware] }, async (req) => svc.listSites(req.auth.tenantId!));

  app.post(
    '/sites',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER'), requirePlanFeature('multiSite')] },
    async (req, reply) => {
      const parsed = createSiteSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const site = await svc.createSite(req.auth.tenantId!, parsed.data);
      return reply.code(201).send(site);
    },
  );

  app.post(
    '/rooms',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createRoomSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const room = await svc.createRoom(req.auth.tenantId!, parsed.data);
      return reply.code(201).send(room);
    },
  );
}

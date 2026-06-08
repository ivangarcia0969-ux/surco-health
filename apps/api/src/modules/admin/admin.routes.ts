import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './admin.service';

const setPlanSchema = z.object({
  tier: z.enum(['FREE', 'PRO', 'CLINICA', 'ENTERPRISE']),
  months: z.number().int().min(1).max(36),
});

const suspendSchema = z.object({ reason: z.string().min(3).max(300) });

/**
 * Panel de administración SaaS — solo SAAS_ADMIN.
 *
 *   GET  /api/admin/tenants                  — lista de clientes + estado
 *   POST /api/admin/tenants/:id/plan         — activar/extender plan pago
 *   POST /api/admin/tenants/:id/suspend      — suspender
 *   POST /api/admin/tenants/:id/reactivate   — reactivar
 */
export default async function adminRoutes(app: FastifyInstance) {
  app.get(
    '/tenants',
    { preHandler: [authMiddleware, requireRole('SAAS_ADMIN')] },
    async () => svc.listTenants(),
  );

  app.post<{ Params: { id: string } }>(
    '/tenants/:id/plan',
    { preHandler: [authMiddleware, requireRole('SAAS_ADMIN')] },
    async (req, reply) => {
      const parsed = setPlanSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.setTenantPlan(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/tenants/:id/suspend',
    { preHandler: [authMiddleware, requireRole('SAAS_ADMIN')] },
    async (req, reply) => {
      const parsed = suspendSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.suspendTenant(auditContextFromReq(req), req.params.id, parsed.data.reason);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/tenants/:id/reactivate',
    { preHandler: [authMiddleware, requireRole('SAAS_ADMIN')] },
    async (req) => svc.reactivateTenant(auditContextFromReq(req), req.params.id),
  );
}

import type { FastifyInstance } from 'fastify';
import {
  createWhatsappAccountSchema,
  updateWhatsappAccountSchema,
  whatsappTestSchema,
} from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import { requirePlanFeature } from '../../middlewares/plan-limits';
import * as svc from './whatsapp.service';

/**
 * Endpoints WhatsApp — N bots per tenant.
 *
 *   GET    /api/whatsapp/accounts                — lista (con capacity)
 *   POST   /api/whatsapp/accounts                — crear (gateado por plan + cuota)
 *   PATCH  /api/whatsapp/accounts/:id            — editar (rotar token, cambiar sede, etc.)
 *   POST   /api/whatsapp/accounts/:id/default    — marcar como default
 *   POST   /api/whatsapp/accounts/:id/test       — envío de prueba a Meta
 *   DELETE /api/whatsapp/accounts/:id            — borrar
 *
 * Solo CLINIC_OWNER puede tocar config.
 */
export default async function whatsappRoutes(app: FastifyInstance) {
  app.get(
    '/accounts',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req) => svc.listAccounts(req.auth.tenantId!),
  );

  app.post(
    '/accounts',
    {
      preHandler: [
        authMiddleware,
        requireRole('CLINIC_OWNER'),
        requirePlanFeature('whatsapp'),
      ],
    },
    async (req, reply) => {
      const parsed = createWhatsappAccountSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const out = await svc.createAccount(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(out);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/accounts/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = updateWhatsappAccountSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.updateAccount(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );

  app.post<{ Params: { id: string } }>(
    '/accounts/:id/default',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req) => svc.setDefault(auditContextFromReq(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>(
    '/accounts/:id/test',
    {
      preHandler: [
        authMiddleware,
        requireRole('CLINIC_OWNER'),
        requirePlanFeature('whatsapp'),
      ],
    },
    async (req, reply) => {
      const parsed = whatsappTestSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.testAccount(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/accounts/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req) => svc.deleteAccount(auditContextFromReq(req), req.params.id),
  );
}

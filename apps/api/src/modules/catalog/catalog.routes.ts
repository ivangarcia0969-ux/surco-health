import type { FastifyInstance } from 'fastify';
import {
  createClinicalServiceSchema,
  updateClinicalServiceSchema,
  listClinicalServicesQuerySchema,
} from '@surco/shared';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './catalog.service';

export default async function catalogRoutes(app: FastifyInstance) {
  // Listar — todos los roles autenticados (profesionales necesitan ver servicios para agendar)
  app.get(
    '/services',
    { preHandler: [authMiddleware] },
    async (req, reply) => {
      const parsed = listClinicalServicesQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      }
      return svc.listServices(req.auth.tenantId!, parsed.data);
    },
  );

  app.get<{ Params: { id: string } }>(
    '/services/:id',
    { preHandler: [authMiddleware] },
    async (req) => svc.getService(req.auth.tenantId!, req.params.id),
  );

  // Solo OWNER puede crear/editar/archivar
  app.post(
    '/services',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = createClinicalServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      }
      const created = await svc.createService(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(created);
    },
  );

  app.patch<{ Params: { id: string } }>(
    '/services/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = updateClinicalServiceSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      }
      return svc.updateService(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/services/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      await svc.archiveService(auditContextFromReq(req), req.params.id);
      return reply.code(204).send();
    },
  );
}

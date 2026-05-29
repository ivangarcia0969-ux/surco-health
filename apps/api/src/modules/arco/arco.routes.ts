import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import * as svc from './arco.service';

const createSchema = z.object({
  patientId: z.string().cuid(),
  kind: z.enum(['ACCESS', 'RECTIFICATION', 'CANCELLATION', 'OPPOSITION', 'PORTABILITY']),
  requestDetails: z.string().min(10).max(2000),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().min(7).max(20).optional(),
});

const resolveSchema = z.object({
  status: z.enum(['RESOLVED', 'REJECTED']),
  resolutionNotes: z.string().min(10).max(2000),
  deliveryFileUrl: z.string().url().optional(),
});

/**
 * Endpoints ARCO — Habeas Data Ley 1581.
 *
 *   POST   /api/arco                         — crear solicitud (Owner o Receptionist en nombre del paciente)
 *   GET    /api/arco                         — listar (Owner)
 *   GET    /api/arco/:id                     — ver una (Owner)
 *   POST   /api/arco/:id/resolve             — marcar como resuelta/rechazada
 *   GET    /api/arco/patients/:id/export     — generar Bundle FHIR (portabilidad)
 */
export default async function arcoRoutes(app: FastifyInstance) {
  app.post(
    '/',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER', 'RECEPTIONIST')] },
    async (req, reply) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      const r = await svc.createArcoRequest(auditContextFromReq(req), parsed.data);
      return reply.code(201).send(r);
    },
  );

  app.get<{ Querystring: { status?: string } }>(
    '/',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req) => svc.listArcoRequests(auditContextFromReq(req), req.query.status),
  );

  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req) => svc.getArcoRequest(auditContextFromReq(req), req.params.id),
  );

  app.post<{ Params: { id: string } }>(
    '/:id/resolve',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const parsed = resolveSchema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
      return svc.resolveArcoRequest(auditContextFromReq(req), req.params.id, parsed.data);
    },
  );

  // Portabilidad: Bundle FHIR del paciente (lo que iría en deliveryFileUrl).
  // El Owner puede generarlo para acompañar una resolución de portabilidad.
  app.get<{ Params: { id: string } }>(
    '/patients/:id/export',
    { preHandler: [authMiddleware, requireRole('CLINIC_OWNER')] },
    async (req, reply) => {
      const bundle = await svc.exportPatientFhir(auditContextFromReq(req), req.params.id);
      reply.header('Content-Type', 'application/fhir+json; charset=utf-8');
      reply.header(
        'Content-Disposition',
        `attachment; filename="patient-${req.params.id}-fhir.json"`,
      );
      return bundle;
    },
  );
}

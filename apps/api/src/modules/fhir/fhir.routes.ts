import type { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole, auditContextFromReq } from '../../middlewares/auth';
import { requirePlanFeature } from '../../middlewares/plan-limits';
import * as svc from './fhir.service';

/**
 * Endpoints FHIR R4 — solo profesionales y owners pueden exportar.
 * Gateado por plan.fhirExportEnabled (plan CLINICA o superior).
 *
 * Content-Type: application/fhir+json
 */
export default async function fhirRoutes(app: FastifyInstance) {
  // CapabilityStatement es público (estándar FHIR)
  app.get('/metadata', async (req, reply) => {
    const baseUrl = `${req.protocol}://${req.headers.host}/api/fhir`;
    reply.header('Content-Type', 'application/fhir+json; charset=utf-8');
    return svc.buildCapabilityStatement(baseUrl);
  });

  // Patient/:id
  app.get<{ Params: { id: string } }>(
    '/Patient/:id',
    {
      preHandler: [
        authMiddleware,
        requireRole('CLINIC_OWNER', 'PROFESSIONAL'),
        requirePlanFeature('fhirExport'),
      ],
    },
    async (req, reply) => {
      const resource = await svc.buildFhirPatient(auditContextFromReq(req), req.params.id);
      reply.header('Content-Type', 'application/fhir+json; charset=utf-8');
      return resource;
    },
  );

  // Patient/:id/$everything — bundle completo
  app.get<{ Params: { id: string } }>(
    '/Patient/:id/$everything',
    {
      preHandler: [
        authMiddleware,
        requireRole('CLINIC_OWNER', 'PROFESSIONAL'),
        requirePlanFeature('fhirExport'),
      ],
    },
    async (req, reply) => {
      const bundle = await svc.buildPatientEverything(auditContextFromReq(req), req.params.id);
      reply.header('Content-Type', 'application/fhir+json; charset=utf-8');
      return bundle;
    },
  );

  // Composition/:recordId
  app.get<{ Params: { id: string } }>(
    '/Composition/:id',
    {
      preHandler: [
        authMiddleware,
        requireRole('CLINIC_OWNER', 'PROFESSIONAL'),
        requirePlanFeature('fhirExport'),
      ],
    },
    async (req, reply) => {
      const resource = await svc.buildFhirCompositionFromRecord(auditContextFromReq(req), req.params.id);
      reply.header('Content-Type', 'application/fhir+json; charset=utf-8');
      return resource;
    },
  );

  // Observation/:recordId (signos vitales)
  app.get<{ Params: { id: string } }>(
    '/Observation/:id',
    {
      preHandler: [
        authMiddleware,
        requireRole('CLINIC_OWNER', 'PROFESSIONAL'),
        requirePlanFeature('fhirExport'),
      ],
    },
    async (req, reply) => {
      const resource = await svc.buildFhirObservationFromVitals(auditContextFromReq(req), req.params.id);
      reply.header('Content-Type', 'application/fhir+json; charset=utf-8');
      return resource;
    },
  );
}

import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import { buildPatientEverything } from '../fhir/fhir.service';

/**
 * Habeas Data Ley 1581/2012 Art. 8 — derechos del titular (ARCO).
 *
 * Flujo:
 *   1) Paciente (o titular en su representación) solicita ARCO al tenant.
 *   2) La clínica tiene 15 días hábiles para responder (Decreto 1377/2013 Art. 14).
 *   3) Si la respuesta no satisface, el titular puede ir a SIC.
 *
 * Nota: NO permitimos auto-resolución desde el endpoint público — todo va por
 * cola humana. Excepciones especiales solo el OWNER o SAAS_ADMIN.
 */

interface CreateArcoArgs {
  patientId: string;
  kind: 'ACCESS' | 'RECTIFICATION' | 'CANCELLATION' | 'OPPOSITION' | 'PORTABILITY';
  requestDetails: string;
  contactEmail?: string;
  contactPhone?: string;
}

export async function createArcoRequest(ctx: AuditContext, args: CreateArcoArgs) {
  const patient = await prisma.patient.findFirst({
    where: { id: args.patientId, tenantId: ctx.tenantId },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  // 15 días HÁBILES (~21 calendario en promedio para no fallar el plazo)
  const dueDate = new Date(Date.now() + 21 * 24 * 3600_000);

  const req = await prisma.arcoRequest.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: args.patientId,
      kind: args.kind,
      requestDetails: args.requestDetails,
      contactEmail: args.contactEmail ?? null,
      contactPhone: args.contactPhone ?? null,
      dueDate,
    },
  });

  await logAudit({
    ctx, action: 'CREATE_CONSENT', entityType: 'Patient', entityId: args.patientId,
    metadata: { arco: args.kind, requestId: req.id, dueDate },
  });

  return req;
}

export async function listArcoRequests(ctx: AuditContext, status?: string) {
  return prisma.arcoRequest.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      patient: { select: { id: true, fullName: true, documentId: true } },
    },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
  });
}

export async function getArcoRequest(ctx: AuditContext, id: string) {
  const r = await prisma.arcoRequest.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { patient: { select: { id: true, fullName: true, documentId: true } } },
  });
  if (!r) throw new AppError('ARCO_NOT_FOUND', 404);
  return r;
}

export async function resolveArcoRequest(
  ctx: AuditContext,
  id: string,
  args: { status: 'RESOLVED' | 'REJECTED'; resolutionNotes: string; deliveryFileUrl?: string },
) {
  const r = await prisma.arcoRequest.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!r) throw new AppError('ARCO_NOT_FOUND', 404);
  if (r.status === 'RESOLVED' || r.status === 'REJECTED') {
    throw new AppError('ARCO_ALREADY_RESOLVED', 400);
  }

  const updated = await prisma.arcoRequest.update({
    where: { id },
    data: {
      status: args.status,
      resolutionNotes: args.resolutionNotes,
      deliveryFileUrl: args.deliveryFileUrl ?? null,
      resolvedAt: new Date(),
      resolvedBy: ctx.actorId,
    },
  });

  await logAudit({
    ctx, action: 'SIGN_CONSENT', entityType: 'Patient', entityId: r.patientId,
    metadata: { arco: r.kind, requestId: id, resolution: args.status },
  });

  return updated;
}

/**
 * Portabilidad (ARCO-P): genera el Bundle FHIR R4 del paciente.
 * El paciente puede descargarlo o pedirlo en su solicitud ARCO.
 */
export async function exportPatientFhir(ctx: AuditContext, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId: ctx.tenantId },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const bundle = await buildPatientEverything(ctx, patientId);

  await logAudit({
    ctx, action: 'EXPORT_PATIENT_DATA', entityType: 'Patient', entityId: patientId,
    metadata: { format: 'FHIR R4', operation: '$everything' },
  });

  return bundle;
}

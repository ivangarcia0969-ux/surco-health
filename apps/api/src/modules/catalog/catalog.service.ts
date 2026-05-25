import { Prisma } from '@surco/db';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import type {
  CreateClinicalServiceInput,
  UpdateClinicalServiceInput,
  ListClinicalServicesQuery,
} from '@surco/shared';

export async function listServices(tenantId: string, q: ListClinicalServicesQuery) {
  const where: Prisma.ClinicalServiceWhereInput = { tenantId };
  if (!q.includeInactive) where.isActive = true;
  if (q.specialty) where.specialty = q.specialty;
  if (q.q) {
    where.OR = [
      { name: { contains: q.q, mode: 'insensitive' } },
      { description: { contains: q.q, mode: 'insensitive' } },
    ];
  }

  return prisma.clinicalService.findMany({
    where,
    orderBy: [{ specialty: 'asc' }, { name: 'asc' }],
  });
}

export async function getService(tenantId: string, id: string) {
  const service = await prisma.clinicalService.findFirst({
    where: { id, tenantId },
  });
  if (!service) throw new AppError('SERVICE_NOT_FOUND', 404);
  return service;
}

export async function createService(ctx: AuditContext, input: CreateClinicalServiceInput) {
  const service = await prisma.clinicalService.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description,
      durationMinutes: input.durationMinutes,
      priceParticular: input.priceParticular,
      priceInsurer: input.priceInsurer,
      specialty: input.specialty,
      defaultCieCode: input.defaultCieCode,
    },
  });

  await logAudit({
    ctx,
    action: 'CREATE_USER', // reusamos esta acción; podría añadirse 'CREATE_SERVICE' al enum
    entityType: 'ClinicalService',
    entityId: service.id,
    metadata: { name: service.name, specialty: service.specialty },
  });
  return service;
}

export async function updateService(
  ctx: AuditContext,
  id: string,
  input: UpdateClinicalServiceInput,
) {
  const existing = await prisma.clinicalService.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) throw new AppError('SERVICE_NOT_FOUND', 404);

  const updated = await prisma.clinicalService.update({
    where: { id },
    data: input,
  });

  await logAudit({
    ctx,
    action: 'UPDATE_PATIENT', // reusamos
    entityType: 'ClinicalService',
    entityId: id,
    metadata: { fieldsChanged: Object.keys(input) },
  });
  return updated;
}

/** Soft-delete: marca isActive=false (jamás eliminar — pueden haber citas/facturas históricas) */
export async function archiveService(ctx: AuditContext, id: string) {
  const existing = await prisma.clinicalService.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) throw new AppError('SERVICE_NOT_FOUND', 404);

  await prisma.clinicalService.update({
    where: { id },
    data: { isActive: false },
  });

  await logAudit({
    ctx,
    action: 'ARCHIVE_PATIENT', // reusamos
    entityType: 'ClinicalService',
    entityId: id,
  });
}

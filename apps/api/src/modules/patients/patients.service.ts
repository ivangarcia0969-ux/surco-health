import { Prisma } from '@surco/db';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import type { CreatePatientInput, UpdatePatientInput, ListPatientsQuery } from '@surco/shared';

export async function listPatients(tenantId: string, q: ListPatientsQuery) {
  const where: Prisma.PatientWhereInput = { tenantId, isActive: true };
  if (q.q) {
    where.OR = [
      { fullName: { contains: q.q, mode: 'insensitive' } },
      { documentId: { contains: q.q } },
      { phone: { contains: q.q } },
      { email: { contains: q.q, mode: 'insensitive' } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      orderBy: { fullName: 'asc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return {
    data,
    pagination: {
      page: q.page, pageSize: q.pageSize, total,
      totalPages: Math.ceil(total / q.pageSize),
    },
  };
}

export async function getPatient(ctx: AuditContext, id: string) {
  const patient = await prisma.patient.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      dentalChart: true,
      medicalProfile: true,
      psychologyProfile: true,
      pediatricProfile: { include: { vaccines: true } },
    },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  await logAudit({ ctx, action: 'READ_PATIENT', entityType: 'Patient', entityId: id });
  return patient;
}

export async function createPatient(ctx: AuditContext, input: CreatePatientInput) {
  // Unicidad por documento dentro del tenant
  const dup = await prisma.patient.findUnique({
    where: {
      tenantId_documentType_documentId: {
        tenantId: ctx.tenantId,
        documentType: input.documentType,
        documentId: input.documentId,
      },
    },
  });
  if (dup) throw new AppError('PATIENT_DOCUMENT_TAKEN', 409, { existingId: dup.id });

  const patient = await prisma.patient.create({
    data: {
      tenantId: ctx.tenantId,
      documentType: input.documentType,
      documentId: input.documentId,
      fullName: input.fullName,
      birthdate: new Date(input.birthdate),
      gender: input.gender,
      phone: input.phone,
      email: input.email || null,
      address: input.address,
      city: input.city,
      bloodType: input.bloodType,
      allergiesSummary: input.allergiesSummary,
      insurerName: input.insurerName,
      insurerPlan: input.insurerPlan,
      insurerNumber: input.insurerNumber,
      emergencyName: input.emergencyName,
      emergencyPhone: input.emergencyPhone,
      emergencyRel: input.emergencyRel,
      notes: input.notes,
      privacyAcceptedAt: new Date(),
      privacyVersion: input.privacyVersion,
      // Inicializa perfiles vacíos (se llenan al ver al paciente por primera vez)
      dentalChart: { create: { state: {} } },
      medicalProfile: { create: {} },
    },
  });

  await logAudit({ ctx, action: 'CREATE_PATIENT', entityType: 'Patient', entityId: patient.id });
  return patient;
}

export async function updatePatient(ctx: AuditContext, id: string, input: UpdatePatientInput) {
  const existing = await prisma.patient.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) throw new AppError('PATIENT_NOT_FOUND', 404);

  const updated = await prisma.patient.update({
    where: { id },
    data: {
      ...input,
      birthdate: input.birthdate ? new Date(input.birthdate) : undefined,
      email: input.email === '' ? null : input.email,
    },
  });

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'Patient', entityId: id,
    metadata: { fieldsChanged: Object.keys(input) },
  });
  return updated;
}

/** Soft-delete: archivar (NO se elimina por retención legal 15 años) */
export async function archivePatient(ctx: AuditContext, id: string, reason: string) {
  const existing = await prisma.patient.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!existing) throw new AppError('PATIENT_NOT_FOUND', 404);

  await prisma.patient.update({
    where: { id },
    data: { isActive: false, notes: `${existing.notes ?? ''}\n[archivado: ${reason}]` },
  });

  await logAudit({
    ctx, action: 'ARCHIVE_PATIENT', entityType: 'Patient', entityId: id,
    metadata: { reason },
  });
}

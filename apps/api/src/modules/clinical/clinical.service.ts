import { Prisma } from '@surco/db';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { encryptText } from '@surco/encryption';
import { logAudit, type AuditContext } from '@surco/audit';
import { createHash } from 'crypto';
import type {
  CreateConsultationInput, CreateEvolutionNoteInput, CreateAmendmentInput,
  ListClinicalRecordsQuery, UserRole,
} from '@surco/shared';

/** Genera hash inmutable del contenido (no-repudio al firmar) */
function contentHash(content: unknown): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

/**
 * El profesional puede registrar HCE para cualquier paciente del tenant.
 * (Antes restringía solo a quienes habían tenido cita con él; eso bloqueaba
 * casos legítimos como urgencias, primera vez sin cita previa, etc.)
 * La trazabilidad queda en el audit log + en el campo professionalId del registro.
 */
async function ensureProfessionalCanAccessPatient(
  tx: Prisma.TransactionClient,
  tenantId: string,
  _professionalId: string,
  patientId: string,
) {
  const patient = await tx.patient.findFirst({
    where: { id: patientId, tenantId, isActive: true },
    select: { id: true },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);
}

export async function createConsultation(
  ctx: AuditContext, role: UserRole, input: CreateConsultationInput,
) {
  return prisma.$transaction(async (tx) => {
    if (role === 'PROFESSIONAL') {
      await ensureProfessionalCanAccessPatient(tx, ctx.tenantId, ctx.actorId!, input.patientId);
    }

    const patient = await tx.patient.findFirst({ where: { id: input.patientId, tenantId: ctx.tenantId, isActive: true } });
    if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

    const structuredData: Record<string, unknown> = {
      chiefComplaint: input.chiefComplaint,
      currentIllness: input.currentIllness,
      physicalExam: input.physicalExam,
      plan: input.plan,
    };

    const encryptedText = input.privateNotes ? await encryptText(input.privateNotes) : null;
    const signature = input.signNow ? contentHash({ structuredData, encryptedText }) : null;

    const record = await tx.clinicalRecord.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        professionalId: ctx.actorId!,
        appointmentId: input.appointmentId,
        type: 'CONSULTATION',
        structuredData: structuredData as any,
        encryptedText,
        signedAt: input.signNow ? new Date() : null,
        signatureHash: signature,
      },
    });

    if (input.diagnoses?.length) {
      await tx.diagnosis.createMany({
        data: input.diagnoses.map((d) => ({
          clinicalRecordId: record.id,
          icd10Code: d.icd10Code,
          description: d.description,
          isPrimary: d.isPrimary,
          type: d.type,
        })),
      });
    }

    return record;
  })
    .then(async (record) => {
      await logAudit({
        ctx, action: 'CREATE_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: record.id,
        metadata: { type: record.type, patientId: record.patientId, signed: !!record.signedAt },
      });
      return record;
    });
}

export async function createEvolutionNote(
  ctx: AuditContext, role: UserRole, input: CreateEvolutionNoteInput,
) {
  return prisma.$transaction(async (tx) => {
    if (role === 'PROFESSIONAL') {
      await ensureProfessionalCanAccessPatient(tx, ctx.tenantId, ctx.actorId!, input.patientId);
    }
    const encryptedText = await encryptText(input.body);
    const sig = input.signNow ? contentHash({ encryptedText }) : null;
    return tx.clinicalRecord.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        professionalId: ctx.actorId!,
        appointmentId: input.appointmentId,
        type: 'EVOLUTION_NOTE',
        structuredData: {},
        encryptedText,
        signedAt: input.signNow ? new Date() : null,
        signatureHash: sig,
      },
    });
  })
    .then(async (record) => {
      await logAudit({ ctx, action: 'CREATE_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: record.id });
      return record;
    });
}

export async function createAmendment(ctx: AuditContext, input: CreateAmendmentInput) {
  const original = await prisma.clinicalRecord.findFirst({
    where: { id: input.previousRecordId, tenantId: ctx.tenantId },
  });
  if (!original) throw new AppError('ORIGINAL_RECORD_NOT_FOUND', 404);

  const encryptedText = await encryptText(`[ADENDA] ${input.reason}\n\n${input.body}`);

  const amendment = await prisma.clinicalRecord.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: original.patientId,
      professionalId: ctx.actorId!,
      type: 'AMENDMENT',
      structuredData: { reason: input.reason, previousType: original.type },
      encryptedText,
      previousRecordId: original.id,
      version: original.version + 1,
    },
  });

  await logAudit({
    ctx, action: 'AMEND_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: amendment.id,
    metadata: { previousRecordId: original.id, reason: input.reason },
  });
  return amendment;
}

export async function listClinicalRecords(
  ctx: AuditContext, role: UserRole, q: ListClinicalRecordsQuery,
) {
  const where: Prisma.ClinicalRecordWhereInput = {
    tenantId: ctx.tenantId,
    patientId: q.patientId,
    archivedAt: null,
  };
  if (role === 'PROFESSIONAL') where.professionalId = ctx.actorId!;
  if (q.type) where.type = q.type;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) (where.createdAt as any).gte = new Date(q.from);
    if (q.to) (where.createdAt as any).lte = new Date(q.to);
  }

  const records = await prisma.clinicalRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      professional: { select: { id: true, fullName: true, specialty: true } },
      diagnoses: {
        select: { id: true, icd10Code: true, description: true, isPrimary: true, type: true },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
      vitalSigns: true,
      dentalProcedures: {
        select: { id: true, toothNumber: true, surfaces: true, condition: true, treatment: true, status: true },
      },
    },
  });

  await logAudit({
    ctx, action: 'LIST_CLINICAL_RECORDS', entityType: 'Patient', entityId: q.patientId,
    metadata: { count: records.length },
  });
  return records;
}

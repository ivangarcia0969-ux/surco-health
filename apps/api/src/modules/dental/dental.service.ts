import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import { createHash } from 'crypto';
import type { UpdateDentalChartInput, CreateDentalTreatmentInput } from '@surco/shared';

export async function getDentalChart(ctx: AuditContext, patientId: string) {
  const chart = await prisma.dentalChart.findFirst({
    where: { patientId, patient: { tenantId: ctx.tenantId } },
  });
  if (!chart) throw new AppError('DENTAL_CHART_NOT_FOUND', 404);
  return chart;
}

export async function updateDentalChart(
  ctx: AuditContext, patientId: string, input: UpdateDentalChartInput,
) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: ctx.tenantId } });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const chart = await prisma.dentalChart.upsert({
    where: { patientId },
    update: {
      state: input.state as any,
      numbering: input.numbering,
      lastUpdatedAt: new Date(),
    },
    create: {
      patientId,
      state: input.state as any,
      numbering: input.numbering ?? 'FDI',
    },
  });

  await logAudit({
    ctx, action: 'CREATE_CLINICAL_RECORD', entityType: 'DentalChart', entityId: chart.id,
    metadata: { patientId, teethUpdated: Object.keys(input.state).length },
  });
  return chart;
}

export async function createDentalTreatment(
  ctx: AuditContext, input: CreateDentalTreatmentInput,
) {
  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, tenantId: ctx.tenantId, isActive: true },
      include: { dentalChart: true },
    });
    if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

    const structuredData = {
      proceduresCount: input.procedures.length,
      teeth: input.procedures.map((p) => p.toothNumber),
      notes: input.notes,
    };

    const signatureHash = input.signNow
      ? createHash('sha256').update(JSON.stringify(structuredData)).digest('hex')
      : null;

    const record = await tx.clinicalRecord.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        professionalId: ctx.actorId!,
        appointmentId: input.appointmentId,
        type: 'DENTAL_TREATMENT',
        structuredData: structuredData as any,
        signedAt: input.signNow ? new Date() : null,
        signatureHash,
        dentalProcedures: {
          create: input.procedures.map((p) => ({
            toothNumber: p.toothNumber,
            surfaces: p.surfaces,
            condition: p.condition,
            treatment: p.treatment,
            cost: p.cost as any,
            status: p.status,
            performedAt: p.status === 'COMPLETED' ? new Date() : null,
          })),
        },
      },
      include: { dentalProcedures: true },
    });

    // Aplicar cambios al odontograma
    if (input.applyToChart && patient.dentalChart) {
      const currentState = (patient.dentalChart.state as Record<string, Record<string, string>>) ?? {};
      for (const p of input.procedures) {
        if (!currentState[p.toothNumber]) currentState[p.toothNumber] = {};
        if (p.surfaces.length === 0) {
          // condición que aplica al diente entero
          currentState[p.toothNumber]['whole'] = p.condition;
        } else {
          for (const surface of p.surfaces) {
            currentState[p.toothNumber][surface.toLowerCase()] = p.condition;
          }
        }
      }
      await tx.dentalChart.update({
        where: { patientId: input.patientId },
        data: { state: currentState as any, lastUpdatedAt: new Date() },
      });
    }

    return record;
  })
    .then(async (record) => {
      await logAudit({
        ctx, action: 'CREATE_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: record.id,
        metadata: { type: 'DENTAL_TREATMENT', procedures: record.dentalProcedures.length },
      });
      return record;
    });
}

export async function listProcedures(ctx: AuditContext, patientId: string) {
  return prisma.dentalProcedure.findMany({
    where: { clinicalRecord: { patientId, tenantId: ctx.tenantId } },
    include: {
      clinicalRecord: { include: { professional: { select: { id: true, fullName: true } } } },
    },
    orderBy: { clinicalRecord: { createdAt: 'desc' } },
  });
}

export async function updateProcedureStatus(
  ctx: AuditContext,
  procedureId: string,
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
) {
  const proc = await prisma.dentalProcedure.findFirst({
    where: { id: procedureId, clinicalRecord: { tenantId: ctx.tenantId } },
  });
  if (!proc) throw new AppError('PROCEDURE_NOT_FOUND', 404);

  const updated = await prisma.dentalProcedure.update({
    where: { id: procedureId },
    data: {
      status,
      performedAt: status === 'COMPLETED' ? new Date() : null,
    },
  });

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'DentalProcedure', entityId: procedureId,
    metadata: { newStatus: status, toothNumber: proc.toothNumber },
  });
  return updated;
}

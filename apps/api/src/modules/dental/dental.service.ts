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

type ChartState = Record<string, Record<string, string>>;

/**
 * Pinta un procedimiento en el odontograma.
 *  - Solo lo REALIZADO se pinta con su condición final (resina, corona…).
 *  - Lo planeado no cambia el diente, salvo la exodoncia planeada, que se marca
 *    como "extracción indicada" (no como diente ya extraído).
 *  - Procedimientos sin diente (p.ej. "GEN" = profilaxis de boca completa) no se pintan.
 *  - Al pintar superficies se quita la marca de "diente completo" para que se vean.
 */
function paintProcedure(
  state: ChartState,
  p: { toothNumber: string; surfaces: string[]; condition: string; status: string },
) {
  if (!/^\d{2}$/.test(p.toothNumber) || p.status === 'CANCELLED') return;
  let condition: string | null = null;
  if (p.status === 'COMPLETED') condition = p.condition;
  else if (p.condition === 'EXTRACTED') condition = 'EXTRACTION_NEEDED';
  if (!condition) return;
  const tooth = (state[p.toothNumber] ??= {});
  if (p.surfaces.length === 0) {
    tooth['whole'] = condition;
  } else {
    delete tooth['whole'];
    for (const surface of p.surfaces) tooth[surface.toLowerCase()] = condition;
  }
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

    // Aplicar cambios al odontograma (lo crea si el paciente aún no tiene).
    if (input.applyToChart) {
      const currentState = (patient.dentalChart?.state as ChartState) ?? {};
      for (const p of input.procedures) paintProcedure(currentState, p);
      await tx.dentalChart.upsert({
        where: { patientId: input.patientId },
        update: { state: currentState as any, lastUpdatedAt: new Date() },
        create: { patientId: input.patientId, state: currentState as any, numbering: 'FDI' },
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
    // Solo lo que usan el plan y el presupuesto: recepción/caja también llaman
    // esta ruta y NO deben recibir el contenido del registro clínico.
    include: {
      clinicalRecord: {
        select: { id: true, createdAt: true, professional: { select: { id: true, fullName: true } } },
      },
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
    include: { clinicalRecord: { select: { patientId: true } } },
  });
  if (!proc) throw new AppError('PROCEDURE_NOT_FOUND', 404);

  const updated = await prisma.dentalProcedure.update({
    where: { id: procedureId },
    data: {
      status,
      performedAt: status === 'COMPLETED' ? new Date() : null,
    },
  });

  // Al terminar un procedimiento, el odontograma refleja el trabajo realizado
  if (status === 'COMPLETED') {
    const patientId = proc.clinicalRecord.patientId;
    const chart = await prisma.dentalChart.findUnique({ where: { patientId } });
    const state = (chart?.state as ChartState) ?? {};
    paintProcedure(state, { ...proc, status });
    await prisma.dentalChart.upsert({
      where: { patientId },
      update: { state: state as any, lastUpdatedAt: new Date() },
      create: { patientId, state: state as any, numbering: 'FDI' },
    });
  }

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'DentalProcedure', entityId: procedureId,
    metadata: { newStatus: status, toothNumber: proc.toothNumber },
  });
  return updated;
}

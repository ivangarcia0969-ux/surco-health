import { Prisma } from '@surco/db';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import { createHash } from 'crypto';
import type { CreatePrescriptionInput, UserRole } from '@surco/shared';

/**
 * Recetas (fórmula médica).
 *
 * Cada receta crea además un ClinicalRecord tipo PRESCRIPTION para que quede
 * en la historia clínica del paciente (Res. 1995/1999). La receta firmada
 * guarda un hash SHA-256 del contenido (no-repudio, Ley 527/1999).
 * Jamás se borra: se anula (status CANCELLED) y queda en el audit log.
 */

/** Número visible de la receta: últimos 6 caracteres del id, en mayúscula. */
export function prescriptionNumber(id: string): string {
  return id.slice(-6).toUpperCase();
}

function contentHash(content: unknown): string {
  return createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

interface ItemContent {
  drugName: string;
  presentation: string | null;
  dose: string;
  frequency: string;
  durationDays: number | null;
  quantity: string | null;
  instructions: string | null;
  ordering: number;
}

/** Contenido canónico que se firma (mismo orden de llaves siempre → hash estable). */
function signedContent(p: {
  id: string;
  tenantId: string;
  patientId: string;
  professionalId: string;
  diagnosis: string | null;
  notes: string | null;
  isMipres: boolean;
  items: ItemContent[];
  issuedAt: Date;
}) {
  return {
    prescriptionId: p.id,
    number: prescriptionNumber(p.id),
    tenantId: p.tenantId,
    patientId: p.patientId,
    professionalId: p.professionalId,
    diagnosis: p.diagnosis,
    notes: p.notes,
    isMipres: p.isMipres,
    items: [...p.items]
      .sort((a, b) => a.ordering - b.ordering)
      .map((it) => ({
        drugName: it.drugName,
        presentation: it.presentation,
        dose: it.dose,
        frequency: it.frequency,
        durationDays: it.durationDays,
        quantity: it.quantity,
        instructions: it.instructions,
      })),
    issuedAt: p.issuedAt.toISOString(),
  };
}

/** "Amoxicilina 500 mg (Cápsulas) — 1 cápsula, cada 8 horas, durante 7 días" */
function itemSummary(it: ItemContent): string {
  const head = it.presentation ? `${it.drugName} (${it.presentation})` : it.drugName;
  const parts = [it.dose, it.frequency.toLowerCase()];
  if (it.durationDays) parts.push(`durante ${it.durationDays} ${it.durationDays === 1 ? 'día' : 'días'}`);
  return `${head} — ${parts.join(', ')}`;
}

const professionalListSelect = {
  id: true, fullName: true, specialty: true, licenseNumber: true,
} satisfies Prisma.UserSelect;

function withNumber<T extends { id: string }>(p: T): T & { number: string } {
  return { ...p, number: prescriptionNumber(p.id) };
}

// ------------------------------------------------------------------
// Crear
// ------------------------------------------------------------------
export async function createPrescription(ctx: AuditContext, input: CreatePrescriptionInput) {
  const professionalId = ctx.actorId!;
  const now = new Date();
  const signNow = input.signNow;

  const items: ItemContent[] = input.items.map((it, i) => ({
    drugName: it.drugName,
    presentation: it.presentation ?? null,
    dose: it.dose,
    frequency: it.frequency,
    durationDays: it.durationDays ?? null,
    quantity: it.quantity ?? null,
    instructions: it.instructions ?? null,
    ordering: i,
  }));

  const created = await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, tenantId: ctx.tenantId, isActive: true },
      select: { id: true },
    });
    if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

    if (input.clinicalRecordId) {
      const related = await tx.clinicalRecord.findFirst({
        where: { id: input.clinicalRecordId, tenantId: ctx.tenantId, patientId: input.patientId },
        select: { id: true },
      });
      if (!related) throw new AppError('RECORD_NOT_FOUND', 404);
    }

    // 1) Receta (necesitamos su id para el número y el hash)
    const prescription = await tx.prescription.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        professionalId,
        diagnosis: input.diagnosis ?? null,
        notes: input.notes ?? null,
        isMipres: input.isMipres,
        status: signNow ? 'ISSUED' : 'DRAFT',
        issuedAt: signNow ? now : null,
        signedAt: signNow ? now : null,
        items: { create: items },
      },
    });

    const signatureHash = signNow
      ? contentHash(signedContent({ ...prescription, items, issuedAt: now }))
      : null;
    const number = prescriptionNumber(prescription.id);

    // 2) Registro en la historia clínica (resumen legible en `plan`)
    const structuredData = {
      kind: 'PRESCRIPTION',
      prescriptionId: prescription.id,
      number,
      diagnosis: input.diagnosis ?? null,
      notes: input.notes ?? null,
      items: items.map((it) => ({
        drugName: it.drugName,
        presentation: it.presentation,
        dose: it.dose,
        frequency: it.frequency,
        durationDays: it.durationDays,
        quantity: it.quantity,
      })),
      plan: [
        `Fórmula médica N.º ${number}${signNow ? '' : ' (borrador)'}`,
        ...(input.diagnosis ? [`Diagnóstico: ${input.diagnosis}`] : []),
        ...items.map((it, i) => `${i + 1}. ${itemSummary(it)}`),
        ...(input.notes ? [`Recomendaciones: ${input.notes}`] : []),
      ].join('\n'),
      relatedRecordId: input.clinicalRecordId ?? null,
    };

    const record = await tx.clinicalRecord.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        professionalId,
        type: 'PRESCRIPTION',
        structuredData: structuredData as Prisma.InputJsonValue,
        signedAt: signNow ? now : null,
        signatureHash,
      },
    });

    // 3) Enlace receta ↔ registro clínico + hash de firma
    return tx.prescription.update({
      where: { id: prescription.id },
      data: { clinicalRecordId: record.id, signatureHash },
      include: {
        items: { orderBy: { ordering: 'asc' } },
        professional: { select: professionalListSelect },
      },
    });
  });

  await logAudit({
    ctx, action: 'CREATE_PRESCRIPTION', entityType: 'Prescription', entityId: created.id,
    metadata: {
      patientId: created.patientId,
      clinicalRecordId: created.clinicalRecordId,
      items: created.items.length,
      signed: !!created.signedAt,
    },
  });
  if (created.signedAt) {
    await logAudit({
      ctx, action: 'ISSUE_PRESCRIPTION', entityType: 'Prescription', entityId: created.id,
      metadata: { patientId: created.patientId, signatureHash: created.signatureHash },
    });
  }

  return withNumber(created);
}

// ------------------------------------------------------------------
// Listar por paciente
// ------------------------------------------------------------------
export async function listPrescriptions(ctx: AuditContext, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const rows = await prisma.prescription.findMany({
    where: { tenantId: ctx.tenantId, patientId },
    orderBy: { createdAt: 'desc' },
    include: {
      items: { orderBy: { ordering: 'asc' } },
      professional: { select: professionalListSelect },
    },
  });

  await logAudit({
    ctx, action: 'LIST_PRESCRIPTIONS', entityType: 'Patient', entityId: patientId,
    metadata: { count: rows.length },
  });

  return rows.map(withNumber);
}

// ------------------------------------------------------------------
// Detalle (vista de impresión)
// ------------------------------------------------------------------
export async function getPrescription(ctx: AuditContext, id: string) {
  const p = await prisma.prescription.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: {
      items: { orderBy: { ordering: 'asc' } },
      patient: {
        select: {
          id: true, fullName: true, documentType: true, documentId: true, birthdate: true,
          phone: true, insurerName: true, allergiesSummary: true,
        },
      },
      professional: {
        select: {
          id: true, fullName: true, specialty: true, licenseNumber: true,
          licenseAuthority: true, signatureImageUrl: true,
        },
      },
    },
  });
  if (!p) throw new AppError('PRESCRIPTION_NOT_FOUND', 404);

  await logAudit({
    ctx, action: 'READ_PRESCRIPTION', entityType: 'Prescription', entityId: p.id,
    metadata: { patientId: p.patientId, status: p.status },
  });

  return withNumber(p);
}

// ------------------------------------------------------------------
// Firmar y emitir un borrador (solo el autor)
// ------------------------------------------------------------------
export async function issuePrescription(ctx: AuditContext, id: string) {
  const p = await prisma.prescription.findFirst({
    where: { id, tenantId: ctx.tenantId },
    include: { items: true },
  });
  if (!p) throw new AppError('PRESCRIPTION_NOT_FOUND', 404);
  if (p.professionalId !== ctx.actorId) throw new AppError('ONLY_AUTHOR_CAN_SIGN', 403);
  if (p.status !== 'DRAFT') throw new AppError('PRESCRIPTION_NOT_DRAFT', 409);

  const now = new Date();
  const signatureHash = contentHash(signedContent({ ...p, issuedAt: now }));

  const updated = await prisma.$transaction(async (tx) => {
    if (p.clinicalRecordId) {
      await tx.clinicalRecord.updateMany({
        where: { id: p.clinicalRecordId, tenantId: ctx.tenantId, signedAt: null },
        data: { signedAt: now, signatureHash },
      });
    }
    return tx.prescription.update({
      where: { id: p.id },
      data: { status: 'ISSUED', issuedAt: now, signedAt: now, signatureHash },
      include: {
        items: { orderBy: { ordering: 'asc' } },
        professional: { select: professionalListSelect },
      },
    });
  });

  await logAudit({
    ctx, action: 'ISSUE_PRESCRIPTION', entityType: 'Prescription', entityId: p.id,
    metadata: { patientId: p.patientId, signatureHash },
  });

  return withNumber(updated);
}

// ------------------------------------------------------------------
// Anular (autor o dueño de la clínica)
// ------------------------------------------------------------------
export async function cancelPrescription(
  ctx: AuditContext, role: UserRole, id: string, reason?: string,
) {
  const p = await prisma.prescription.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, professionalId: true, patientId: true, status: true },
  });
  if (!p) throw new AppError('PRESCRIPTION_NOT_FOUND', 404);
  if (role !== 'CLINIC_OWNER' && p.professionalId !== ctx.actorId) {
    throw new AppError('FORBIDDEN', 403);
  }
  if (p.status === 'CANCELLED') throw new AppError('PRESCRIPTION_ALREADY_CANCELLED', 409);

  const updated = await prisma.prescription.update({
    where: { id: p.id },
    data: { status: 'CANCELLED' },
    include: {
      items: { orderBy: { ordering: 'asc' } },
      professional: { select: professionalListSelect },
    },
  });

  await logAudit({
    ctx, action: 'CANCEL_PRESCRIPTION', entityType: 'Prescription', entityId: p.id,
    metadata: { patientId: p.patientId, previousStatus: p.status, reason: reason ?? null },
  });

  return withNumber(updated);
}

// ------------------------------------------------------------------
// Firma manuscrita del profesional autenticado
// ------------------------------------------------------------------
export async function getMySignature(ctx: AuditContext) {
  const u = await prisma.user.findFirst({
    where: { id: ctx.actorId!, tenantId: ctx.tenantId },
    select: {
      signatureImageUrl: true, fullName: true, specialty: true,
      licenseNumber: true, licenseAuthority: true,
    },
  });
  if (!u) throw new AppError('USER_NOT_FOUND', 404);
  return {
    signatureImg: u.signatureImageUrl,
    fullName: u.fullName,
    specialty: u.specialty,
    licenseNumber: u.licenseNumber,
    licenseAuthority: u.licenseAuthority,
  };
}

export async function updateMySignature(ctx: AuditContext, signatureImg: string | null) {
  const r = await prisma.user.updateMany({
    where: { id: ctx.actorId!, tenantId: ctx.tenantId },
    data: { signatureImageUrl: signatureImg },
  });
  if (r.count === 0) throw new AppError('USER_NOT_FOUND', 404);

  await logAudit({
    ctx, action: signatureImg ? 'UPDATE_SIGNATURE' : 'DELETE_SIGNATURE',
    entityType: 'User', entityId: ctx.actorId!,
    metadata: { hasSignature: !!signatureImg, size: signatureImg?.length ?? 0 },
  });

  return { signatureImg };
}

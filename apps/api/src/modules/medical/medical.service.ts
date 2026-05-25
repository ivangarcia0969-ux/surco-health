import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { encryptText, decryptFields } from '@surco/encryption';
import { logAudit, type AuditContext } from '@surco/audit';
import type { VitalSignsInput, UpdateMedicalProfileInput, Icd10SearchQuery } from '@surco/shared';

/** Calcula IMC con 2 decimales */
function calcBmi(weightKg?: number, heightCm?: number): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 100) / 100;
}

export async function recordVitalSigns(
  ctx: AuditContext, patientId: string, appointmentId: string | undefined, vitals: VitalSignsInput,
) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: ctx.tenantId, isActive: true } });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const bmi = calcBmi(vitals.weightKg, vitals.heightCm);

  const record = await prisma.clinicalRecord.create({
    data: {
      tenantId: ctx.tenantId,
      patientId,
      professionalId: ctx.actorId!,
      appointmentId,
      type: 'CONSULTATION',
      structuredData: { kind: 'VITAL_SIGNS' } as any,
      vitalSigns: {
        create: {
          systolicMmHg: vitals.systolicMmHg,
          diastolicMmHg: vitals.diastolicMmHg,
          heartRate: vitals.heartRate,
          respiratoryRate: vitals.respiratoryRate,
          temperatureC: vitals.temperatureC as any,
          oxygenSaturation: vitals.oxygenSaturation,
          weightKg: vitals.weightKg as any,
          heightCm: vitals.heightCm as any,
          bmi: bmi as any,
          waistCm: vitals.waistCm as any,
          headCircumferenceCm: vitals.headCircumferenceCm as any,
          glucoseMgDl: vitals.glucoseMgDl,
          painScale: vitals.painScale,
        },
      },
    },
    include: { vitalSigns: true },
  });

  await logAudit({
    ctx, action: 'CREATE_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: record.id,
    metadata: { kind: 'VITAL_SIGNS' },
  });
  return record;
}

export async function getMedicalProfile(ctx: AuditContext, patientId: string) {
  const profile = await prisma.medicalProfile.findFirst({
    where: { patientId, patient: { tenantId: ctx.tenantId } },
  });
  if (!profile) return null;

  // Descifrar campos encriptados
  const decrypted = await decryptFields(profile, [
    'personalHistoryEnc', 'familyHistoryEnc', 'surgicalHistoryEnc',
    'allergiesDetailEnc', 'currentMedsEnc',
  ] as any);

  await logAudit({
    ctx, action: 'READ_CLINICAL_RECORD', entityType: 'MedicalProfile', entityId: profile.id,
    metadata: { decryptedFields: ['personalHistory', 'familyHistory', 'surgicalHistory', 'allergiesDetail', 'currentMeds'] },
  });

  return {
    id: profile.id,
    patientId: profile.patientId,
    personalHistory: (decrypted as any).personalHistoryEnc,
    familyHistory: (decrypted as any).familyHistoryEnc,
    surgicalHistory: (decrypted as any).surgicalHistoryEnc,
    allergiesDetail: (decrypted as any).allergiesDetailEnc,
    currentMeds: (decrypted as any).currentMedsEnc,
    smoker: profile.smoker,
    alcohol: profile.alcohol,
    exercise: profile.exercise,
    updatedAt: profile.updatedAt,
  };
}

export async function updateMedicalProfile(
  ctx: AuditContext, patientId: string, input: UpdateMedicalProfileInput,
) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: ctx.tenantId } });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const [pHist, fHist, sHist, allerg, meds] = await Promise.all([
    encryptText(input.personalHistory),
    encryptText(input.familyHistory),
    encryptText(input.surgicalHistory),
    encryptText(input.allergiesDetail),
    encryptText(input.currentMeds),
  ]);

  const data: any = { patientId };
  if (input.personalHistory !== undefined) data.personalHistoryEnc = pHist;
  if (input.familyHistory !== undefined) data.familyHistoryEnc = fHist;
  if (input.surgicalHistory !== undefined) data.surgicalHistoryEnc = sHist;
  if (input.allergiesDetail !== undefined) data.allergiesDetailEnc = allerg;
  if (input.currentMeds !== undefined) data.currentMedsEnc = meds;
  if (input.smoker !== undefined) data.smoker = input.smoker;
  if (input.alcohol !== undefined) data.alcohol = input.alcohol;
  if (input.exercise !== undefined) data.exercise = input.exercise;

  const profile = await prisma.medicalProfile.upsert({
    where: { patientId },
    update: data,
    create: data,
  });

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'MedicalProfile', entityId: profile.id,
    metadata: { fieldsChanged: Object.keys(input) },
  });
  return { id: profile.id, updatedAt: profile.updatedAt };
}

export async function searchIcd10(q: Icd10SearchQuery) {
  return prisma.icd10Code.findMany({
    where: {
      OR: [
        { code: { startsWith: q.q, mode: 'insensitive' } },
        { description: { contains: q.q, mode: 'insensitive' } },
      ],
    },
    orderBy: { code: 'asc' },
    take: q.limit,
  });
}

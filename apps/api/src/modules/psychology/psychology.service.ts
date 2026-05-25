import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { encryptText, decryptText, decryptFields } from '@surco/encryption';
import { logAudit, type AuditContext } from '@surco/audit';
import type {
  CreateSoapNoteInput, UpdatePsychologyProfileInput, ApplyPsychometricTestInput,
} from '@surco/shared';

export async function createSoapNote(ctx: AuditContext, input: CreateSoapNoteInput) {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, tenantId: ctx.tenantId, isActive: true },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  // Encriptar TODOS los campos del SOAP
  const [subj, obj, ass, plan] = await Promise.all([
    encryptText(input.subjective),
    encryptText(input.objective),
    encryptText(input.assessment),
    encryptText(input.plan),
  ]);

  if (!subj || !obj || !ass || !plan) {
    throw new AppError('ENCRYPTION_FAILED', 500);
  }

  const record = await prisma.clinicalRecord.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      professionalId: ctx.actorId!,
      appointmentId: input.appointmentId,
      type: 'PSYCHOLOGY_SOAP',
      structuredData: { riskFlag: input.riskFlag, safetyPlanIncluded: !!input.safetyPlan } as any,
      // El safetyPlan va dentro del campo principal encriptado
      encryptedText: input.safetyPlan ? await encryptText(input.safetyPlan) : null,
      // Notas SOAP estricta — bloqueo de privacidad
      isLocked: true,
      signedAt: input.signNow ? new Date() : null,
      soapNote: {
        create: {
          subjectiveEnc: subj,
          objectiveEnc: obj,
          assessmentEnc: ass,
          planEnc: plan,
          riskFlag: input.riskFlag,
        },
      },
    },
    include: { soapNote: true },
  });

  // Actualizar riesgo agregado en perfil si HIGH/IMMINENT
  if (input.riskFlag === 'HIGH' || input.riskFlag === 'IMMINENT') {
    await prisma.psychologyProfile.upsert({
      where: { patientId: input.patientId },
      update: { suicideRiskLevel: input.riskFlag },
      create: { patientId: input.patientId, suicideRiskLevel: input.riskFlag },
    });
  }

  await logAudit({
    ctx, action: 'CREATE_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: record.id,
    metadata: { type: 'PSYCHOLOGY_SOAP', riskFlag: input.riskFlag, locked: true },
  });
  return { id: record.id, createdAt: record.createdAt, riskFlag: record.soapNote?.riskFlag };
}

export async function readSoapNote(ctx: AuditContext, recordId: string) {
  const record = await prisma.clinicalRecord.findFirst({
    where: { id: recordId, tenantId: ctx.tenantId, type: 'PSYCHOLOGY_SOAP' },
    include: { soapNote: true, professional: { select: { id: true, fullName: true } } },
  });
  if (!record?.soapNote) throw new AppError('RECORD_NOT_FOUND', 404);

  // Solo el profesional que la creó O un Owner pueden leerla (sin admin SaaS)
  if (record.professionalId !== ctx.actorId && ctx.actorRole !== 'CLINIC_OWNER') {
    throw new AppError('FORBIDDEN_LOCKED_RECORD', 403);
  }

  const decrypted = await decryptFields(record.soapNote, [
    'subjectiveEnc', 'objectiveEnc', 'assessmentEnc', 'planEnc',
  ] as any);

  await logAudit({
    ctx, action: 'READ_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: record.id,
    metadata: { type: 'PSYCHOLOGY_SOAP', decrypted: true },
  });

  return {
    id: record.id,
    professional: record.professional,
    createdAt: record.createdAt,
    riskFlag: record.soapNote.riskFlag,
    subjective: (decrypted as any).subjectiveEnc,
    objective: (decrypted as any).objectiveEnc,
    assessment: (decrypted as any).assessmentEnc,
    plan: (decrypted as any).planEnc,
    safetyPlan: record.encryptedText ? await decryptText(record.encryptedText as any) : null,
    signedAt: record.signedAt,
  };
}

export async function updatePsychologyProfile(
  ctx: AuditContext, patientId: string, input: UpdatePsychologyProfileInput,
) {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, tenantId: ctx.tenantId } });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const [reason, goals] = await Promise.all([
    encryptText(input.reasonForConsult),
    encryptText(input.treatmentGoals),
  ]);

  const data: any = { patientId };
  if (input.reasonForConsult !== undefined) data.reasonForConsultEnc = reason;
  if (input.treatmentGoals !== undefined) data.treatmentGoalsEnc = goals;
  if (input.genogram !== undefined) data.genogram = input.genogram;
  if (input.suicideRiskLevel !== undefined) data.suicideRiskLevel = input.suicideRiskLevel;
  if (input.selfHarmRiskLevel !== undefined) data.selfHarmRiskLevel = input.selfHarmRiskLevel;

  const profile = await prisma.psychologyProfile.upsert({
    where: { patientId },
    update: data,
    create: data,
  });

  await logAudit({ ctx, action: 'UPDATE_PATIENT', entityType: 'PsychologyProfile', entityId: profile.id });
  return { id: profile.id, updatedAt: profile.updatedAt };
}

/** Aplicar test psicométrico y calcular score + interpretación */
export async function applyTest(ctx: AuditContext, input: ApplyPsychometricTestInput) {
  const test = await prisma.psychometricTestDefinition.findUnique({ where: { code: input.testCode } });
  if (!test) throw new AppError('TEST_NOT_FOUND', 404);

  const patient = await prisma.patient.findFirst({ where: { id: input.patientId, tenantId: ctx.tenantId } });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  // Score = suma de respuestas (compatible con PHQ-9, GAD-7, BDI-II)
  const score = input.answers.reduce((s, a) => s + a, 0);

  // Interpretación según rangos
  const schema = test.schema as any;
  let interpretation = 'Sin interpretación';
  if (Array.isArray(schema?.interpretation)) {
    const match = schema.interpretation.find(
      (r: any) => score >= r.range[0] && score <= r.range[1],
    );
    if (match) interpretation = match.label;
  }

  // Banderas — score alto en depresión + ítem 9 PHQ-9 (suicidio) > 0
  const flags: string[] = [];
  if (test.code === 'PHQ-9' && input.answers[8] > 0) flags.push('SUICIDAL_IDEATION');
  if (score >= (schema?.maxScore ?? 0) * 0.7) flags.push('HIGH_SEVERITY');

  const encryptedAnswers = await encryptText(JSON.stringify(input.answers));
  if (!encryptedAnswers) throw new AppError('ENCRYPTION_FAILED', 500);

  const record = await prisma.clinicalRecord.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      professionalId: ctx.actorId!,
      appointmentId: input.appointmentId,
      type: 'PSYCHOMETRIC_TEST',
      structuredData: {
        testCode: test.code, score, interpretation, flags, notes: input.notes,
      } as any,
      psychometricResult: {
        create: {
          testId: test.id,
          answersEnc: encryptedAnswers,
          score: score as any,
          interpretation,
          flags,
        },
      },
    },
    include: { psychometricResult: { include: { test: true } } },
  });

  await logAudit({
    ctx, action: 'CREATE_CLINICAL_RECORD', entityType: 'ClinicalRecord', entityId: record.id,
    metadata: { type: 'PSYCHOMETRIC_TEST', testCode: test.code, score, flags },
  });

  return {
    id: record.id,
    testCode: test.code,
    testName: test.name,
    score, interpretation, flags,
    takenAt: record.psychometricResult?.takenAt,
  };
}

export async function listAvailableTests() {
  return prisma.psychometricTestDefinition.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, description: true, schema: true },
  });
}

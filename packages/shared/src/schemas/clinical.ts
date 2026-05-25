import { z } from 'zod';

export const clinicalRecordTypeEnum = z.enum([
  'CONSULTATION', 'EVOLUTION_NOTE',
  'DENTAL_TREATMENT', 'PSYCHOLOGY_SOAP', 'PSYCHOMETRIC_TEST',
  'PEDIATRIC_CHECKUP', 'AESTHETIC_PROCEDURE',
  'PRESCRIPTION', 'LAB_ORDER', 'IMAGING_ORDER',
  'REFERRAL', 'CERTIFICATE', 'AMENDMENT',
]);

/** Consulta médica/odonto genérica — anamnesis + examen + plan */
export const createConsultationSchema = z.object({
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  // Subjetivo / motivo de consulta
  chiefComplaint: z.string().min(1).max(1000),
  currentIllness: z.string().max(3000).optional(),
  // Objetivo / examen físico
  physicalExam: z.string().max(3000).optional(),
  // Análisis / diagnóstico
  diagnoses: z
    .array(
      z.object({
        icd10Code: z.string().min(2).max(10),
        description: z.string().optional(),
        isPrimary: z.boolean().default(false),
        type: z.enum(['PRESUMPTIVE', 'CONFIRMED', 'DIFFERENTIAL', 'RULE_OUT']).default('CONFIRMED'),
      }),
    )
    .optional(),
  // Plan
  plan: z.string().max(3000).optional(),
  // Notas privadas adicionales (encriptadas at-rest)
  privateNotes: z.string().max(5000).optional(),
  // Sign-off
  signNow: z.boolean().default(false),
});
export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;

/** Nota de evolución más simple (continuación de tratamiento) */
export const createEvolutionNoteSchema = z.object({
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  body: z.string().min(1).max(5000),
  signNow: z.boolean().default(false),
});
export type CreateEvolutionNoteInput = z.infer<typeof createEvolutionNoteSchema>;

/** Adenda a un registro previo (no se edita, se crea adenda) */
export const createAmendmentSchema = z.object({
  previousRecordId: z.string().cuid(),
  reason: z.string().min(5).max(300),
  body: z.string().min(1).max(5000),
});
export type CreateAmendmentInput = z.infer<typeof createAmendmentSchema>;

export const listClinicalRecordsQuerySchema = z.object({
  patientId: z.string().cuid(),
  type: clinicalRecordTypeEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type ListClinicalRecordsQuery = z.infer<typeof listClinicalRecordsQuerySchema>;

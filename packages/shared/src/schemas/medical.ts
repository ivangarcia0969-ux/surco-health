import { z } from 'zod';

/** Signos vitales — todos opcionales, captura lo que tengas */
export const vitalSignsSchema = z.object({
  systolicMmHg: z.number().int().min(50).max(300).optional(),
  diastolicMmHg: z.number().int().min(30).max(200).optional(),
  heartRate: z.number().int().min(20).max(250).optional(),
  respiratoryRate: z.number().int().min(5).max(80).optional(),
  temperatureC: z.number().min(30).max(45).optional(),
  oxygenSaturation: z.number().int().min(40).max(100).optional(),
  weightKg: z.number().min(0.3).max(500).optional(),
  heightCm: z.number().min(20).max(260).optional(),
  waistCm: z.number().min(20).max(300).optional(),
  headCircumferenceCm: z.number().min(20).max(80).optional(),
  glucoseMgDl: z.number().int().min(20).max(800).optional(),
  painScale: z.number().int().min(0).max(10).optional(),
});
export type VitalSignsInput = z.infer<typeof vitalSignsSchema>;

/** Actualizar perfil médico del paciente (antecedentes) */
export const updateMedicalProfileSchema = z.object({
  personalHistory: z.string().max(5000).optional(),
  familyHistory: z.string().max(5000).optional(),
  surgicalHistory: z.string().max(3000).optional(),
  allergiesDetail: z.string().max(2000).optional(),
  currentMeds: z.string().max(2000).optional(),
  smoker: z.boolean().optional(),
  alcohol: z.string().max(60).optional(),
  exercise: z.string().max(120).optional(),
});
export type UpdateMedicalProfileInput = z.infer<typeof updateMedicalProfileSchema>;

/** Búsqueda de códigos CIE-10 (autocompletar) */
export const icd10SearchSchema = z.object({
  q: z.string().min(1).max(60),
  limit: z.coerce.number().int().positive().max(50).default(10),
});
export type Icd10SearchQuery = z.infer<typeof icd10SearchSchema>;

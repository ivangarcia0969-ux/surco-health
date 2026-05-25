import { z } from 'zod';

export const riskLevelEnum = z.enum(['NONE', 'LOW', 'MEDIUM', 'HIGH', 'IMMINENT']);

/** Crear nota SOAP (toda encriptada at-rest) */
export const createSoapNoteSchema = z.object({
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  // SOAP — todo texto libre, se encripta
  subjective: z.string().min(1).max(10000),
  objective: z.string().min(1).max(10000),
  assessment: z.string().min(1).max(10000),
  plan: z.string().min(1).max(10000),
  riskFlag: riskLevelEnum.default('NONE'),
  // Si HIGH/IMMINENT, requerir notas adicionales y plan de seguridad
  safetyPlan: z.string().max(5000).optional(),
  signNow: z.boolean().default(false),
});
export type CreateSoapNoteInput = z.infer<typeof createSoapNoteSchema>;

/** Actualizar perfil psicológico del paciente */
export const updatePsychologyProfileSchema = z.object({
  reasonForConsult: z.string().max(3000).optional(),
  treatmentGoals: z.string().max(3000).optional(),
  genogram: z.any().optional(), // estructura libre
  suicideRiskLevel: riskLevelEnum.optional(),
  selfHarmRiskLevel: riskLevelEnum.optional(),
});
export type UpdatePsychologyProfileInput = z.infer<typeof updatePsychologyProfileSchema>;

/** Aplicar un test psicométrico (PHQ-9, GAD-7, BDI-II, etc.) */
export const applyPsychometricTestSchema = z.object({
  patientId: z.string().cuid(),
  testCode: z.string().min(2).max(20), // "PHQ-9"
  // Respuestas: array de números 0-N (depende del test)
  answers: z.array(z.number().int().min(0).max(10)).min(1).max(100),
  appointmentId: z.string().cuid().optional(),
  notes: z.string().max(2000).optional(),
});
export type ApplyPsychometricTestInput = z.infer<typeof applyPsychometricTestSchema>;

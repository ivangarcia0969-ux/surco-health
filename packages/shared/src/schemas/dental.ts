import { z } from 'zod';

export const dentalSurfaceEnum = z.enum(['MESIAL', 'DISTAL', 'OCCLUSAL', 'LINGUAL', 'VESTIBULAR', 'PALATAL']);
export const dentalConditionEnum = z.enum([
  'HEALTHY', 'CARIES',
  'FILLING_AMALGAM', 'FILLING_RESIN', 'FILLING_TEMP',
  'CROWN', 'IMPLANT', 'EXTRACTION_NEEDED', 'EXTRACTED',
  'ROOT_CANAL', 'BRIDGE', 'SEALANT', 'FRACTURE', 'MOBILITY', 'ABSENT',
]);
export const numberingSystemEnum = z.enum(['FDI', 'UNIVERSAL', 'PALMER']);

/** Actualizar el odontograma completo (estado por diente y superficie) */
export const updateDentalChartSchema = z.object({
  numbering: numberingSystemEnum.optional(),
  // { "11": { "mesial": "CARIES", "occlusal": "HEALTHY", ... }, ... }
  state: z.record(z.string(), z.record(z.string(), dentalConditionEnum)),
});
export type UpdateDentalChartInput = z.infer<typeof updateDentalChartSchema>;

/** Registrar un procedimiento dental (forma parte de un ClinicalRecord) */
export const dentalProcedureSchema = z.object({
  toothNumber: z.string().min(1).max(4),
  surfaces: z.array(dentalSurfaceEnum).min(0),
  condition: dentalConditionEnum,
  treatment: z.string().max(300).optional(),
  cost: z.number().nonnegative().optional(),
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PLANNED'),
});
export type DentalProcedureInput = z.infer<typeof dentalProcedureSchema>;

/** Crear un ClinicalRecord tipo DENTAL_TREATMENT con N procedimientos */
export const createDentalTreatmentSchema = z.object({
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  notes: z.string().max(3000).optional(),
  procedures: z.array(dentalProcedureSchema).min(1, 'Al menos un procedimiento'),
  applyToChart: z.boolean().default(true), // actualizar odontograma con los nuevos estados
  signNow: z.boolean().default(false),
});
export type CreateDentalTreatmentInput = z.infer<typeof createDentalTreatmentSchema>;

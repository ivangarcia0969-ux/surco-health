import { z } from 'zod';

/** Texto opcional: recorta espacios y convierte "" en undefined. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : undefined));

export const prescriptionItemSchema = z.object({
  drugName: z.string().trim().min(2, 'Nombre del medicamento').max(150),
  presentation: optionalText(100),
  dose: z.string().trim().min(1, 'Dosis').max(80),
  frequency: z.string().trim().min(1, 'Frecuencia').max(80),
  durationDays: z.number().int().positive().max(365).optional(),
  quantity: optionalText(60),
  instructions: optionalText(300),
});
export type PrescriptionItemInput = z.infer<typeof prescriptionItemSchema>;

export const createPrescriptionSchema = z.object({
  patientId: z.string().cuid(),
  /** Registro clínico relacionado (p. ej. la consulta que originó la receta). */
  clinicalRecordId: z.string().cuid().optional(),
  diagnosis: optionalText(300),
  notes: optionalText(1000),
  isMipres: z.boolean().default(false),
  items: z.array(prescriptionItemSchema).min(1, 'Al menos un medicamento').max(20),
  /** true → se firma y emite de una vez (ISSUED). false → queda en borrador. */
  signNow: z.boolean().default(false),
});
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

export const listPrescriptionsQuerySchema = z.object({
  patientId: z.string().min(1).max(64),
});
export type ListPrescriptionsQuery = z.infer<typeof listPrescriptionsQuerySchema>;

export const cancelPrescriptionSchema = z.object({
  reason: optionalText(300),
});
export type CancelPrescriptionInput = z.infer<typeof cancelPrescriptionSchema>;

/**
 * Firma manuscrita del profesional (se imprime en recetas y documentos).
 * Se guarda como data URL PNG en User.signatureImageUrl. null = borrar.
 */
export const professionalSignatureSchema = z.object({
  signatureImg: z
    .string()
    .max(300_000, 'La imagen de la firma es demasiado grande')
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/, 'Formato de firma inválido (PNG)')
    .nullable(),
});
export type ProfessionalSignatureInput = z.infer<typeof professionalSignatureSchema>;

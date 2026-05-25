import { z } from 'zod';

export const prescriptionItemSchema = z.object({
  drugName: z.string().min(2).max(150),
  presentation: z.string().max(100).optional(),
  dose: z.string().min(1).max(80),
  frequency: z.string().min(1).max(80),
  durationDays: z.number().int().positive().optional(),
  quantity: z.string().max(60).optional(),
  instructions: z.string().max(300).optional(),
});

export const createPrescriptionSchema = z.object({
  patientId: z.string().cuid(),
  clinicalRecordId: z.string().cuid().optional(),
  diagnosis: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  isMipres: z.boolean().default(false),
  items: z.array(prescriptionItemSchema).min(1, 'Al menos un medicamento'),
  signNow: z.boolean().default(false),
});
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;

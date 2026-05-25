import { z } from 'zod';

const specialtyEnum = z.enum([
  'MEDICAL_GENERAL', 'DENTAL', 'PSYCHOLOGY', 'PSYCHIATRY', 'PEDIATRICS',
  'GYNECOLOGY', 'DERMATOLOGY', 'CARDIOLOGY', 'NUTRITION', 'PHYSIOTHERAPY',
  'AESTHETICS', 'OPHTHALMOLOGY', 'ORTHOPEDICS', 'OTORHINOLARYNGOLOGY', 'OTHER',
]);

export const createClinicalServiceSchema = z.object({
  name: z.string().min(2).max(150),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(5).max(600),
  priceParticular: z.number().nonnegative(),
  priceInsurer: z.number().nonnegative().optional(),
  specialty: specialtyEnum.optional(),
  defaultCieCode: z.string().max(10).optional(),
});
export type CreateClinicalServiceInput = z.infer<typeof createClinicalServiceSchema>;

export const updateClinicalServiceSchema = createClinicalServiceSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateClinicalServiceInput = z.infer<typeof updateClinicalServiceSchema>;

export const listClinicalServicesQuerySchema = z.object({
  specialty: specialtyEnum.optional(),
  includeInactive: z.coerce.boolean().default(false),
  q: z.string().optional(),
});
export type ListClinicalServicesQuery = z.infer<typeof listClinicalServicesQuerySchema>;

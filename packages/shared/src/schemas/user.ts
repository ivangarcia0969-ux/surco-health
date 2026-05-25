import { z } from 'zod';

const specialtyEnum = z.enum([
  'MEDICAL_GENERAL', 'DENTAL', 'PSYCHOLOGY', 'PSYCHIATRY', 'PEDIATRICS',
  'GYNECOLOGY', 'DERMATOLOGY', 'CARDIOLOGY', 'NUTRITION', 'PHYSIOTHERAPY',
  'AESTHETICS', 'OPHTHALMOLOGY', 'ORTHOPEDICS', 'OTORHINOLARYNGOLOGY', 'OTHER',
]);

export const createProfessionalSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(100),
  phone: z.string().optional(),
  specialty: specialtyEnum,
  licenseNumber: z.string().min(2).max(50),
  licenseAuthority: z.string().min(2).max(100).default('Minsalud Colombia'),
  siteIds: z.array(z.string().cuid()).optional(),
});
export type CreateProfessionalInput = z.infer<typeof createProfessionalSchema>;

export const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(100),
  phone: z.string().optional(),
  role: z.enum(['RECEPTIONIST', 'BILLING']),
});
export type CreateStaffInput = z.infer<typeof createStaffSchema>;

export const updateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
  specialty: specialtyEnum.optional(),
  licenseNumber: z.string().optional(),
  licenseAuthority: z.string().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

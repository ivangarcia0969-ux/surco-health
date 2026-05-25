import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantSlug: z.string().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerClinicSchema = z.object({
  // Tenant
  legalName: z.string().min(2).max(150),
  tradeName: z.string().min(2).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  country: z.enum(['CO', 'MX', 'AR', 'CL', 'PE', 'EC', 'ES', 'US', 'OTHER']).default('CO'),
  timezone: z.string().default('America/Bogota'),
  currency: z.string().default('COP'),
  primarySpecialty: z
    .enum([
      'MEDICAL_GENERAL', 'DENTAL', 'PSYCHOLOGY', 'PSYCHIATRY', 'PEDIATRICS',
      'GYNECOLOGY', 'DERMATOLOGY', 'CARDIOLOGY', 'NUTRITION', 'PHYSIOTHERAPY',
      'AESTHETICS', 'OPHTHALMOLOGY', 'ORTHOPEDICS', 'OTORHINOLARYNGOLOGY', 'OTHER',
    ])
    .optional(),
  taxId: z.string().optional(),
  taxIdType: z.string().optional(),
  // Owner
  ownerName: z.string().min(2).max(100),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  ownerPhone: z.string().optional(),
  // Aceptación habeas data (OBLIGATORIO)
  acceptedPrivacyPolicy: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar la política de privacidad (Habeas Data)' }),
  }),
});
export type RegisterClinicInput = z.infer<typeof registerClinicSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

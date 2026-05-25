import { z } from 'zod';

export const updateTenantSchema = z.object({
  legalName: z.string().min(2).max(150).optional(),
  tradeName: z.string().min(2).max(100).optional(),
  taxId: z.string().optional(),
  taxIdType: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().length(3).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  primarySpecialty: z
    .enum([
      'MEDICAL_GENERAL', 'DENTAL', 'PSYCHOLOGY', 'PSYCHIATRY', 'PEDIATRICS',
      'GYNECOLOGY', 'DERMATOLOGY', 'CARDIOLOGY', 'NUTRITION', 'PHYSIOTHERAPY',
      'AESTHETICS', 'OPHTHALMOLOGY', 'ORTHOPEDICS', 'OTORHINOLARYNGOLOGY', 'OTHER',
    ])
    .optional(),
});
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

export const createSiteSchema = z.object({
  name: z.string().min(2).max(100),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  isMain: z.boolean().default(false),
});
export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const createRoomSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(1).max(60),
});
export type CreateRoomInput = z.infer<typeof createRoomSchema>;

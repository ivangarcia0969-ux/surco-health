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

// === WhatsApp Cloud API (Meta) — Multi-bot per tenant ===
// Cada tenant puede tener N WhatsappAccount (cuota por plan).
// El plan define maxWhatsappAccounts (FREE=1, PRO=2, CLINICA=5, ENTERPRISE=50).

export const createWhatsappAccountSchema = z.object({
  name: z.string().min(2, 'Nombre del bot requerido').max(80),
  displayPhone: z.string().regex(/^\+?\d{8,15}$/, 'Teléfono E.164 inválido').optional(),
  phoneNumberId: z
    .string()
    .min(8, 'Phone Number ID inválido')
    .max(40)
    .regex(/^\d+$/, 'Solo dígitos'),
  businessAccountId: z
    .string()
    .min(8).max(40)
    .regex(/^\d+$/, 'Solo dígitos')
    .optional(),
  accessToken: z
    .string()
    .min(40, 'Token Meta demasiado corto')
    .max(500),
  templateLang: z.string().min(2).max(10).default('es_CO'),
  isDefault: z.boolean().default(false),
  siteId: z.string().cuid().optional(),
});
export type CreateWhatsappAccountInput = z.infer<typeof createWhatsappAccountSchema>;

export const updateWhatsappAccountSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  displayPhone: z.string().regex(/^\+?\d{8,15}$/).optional().nullable(),
  // Para rotar el token sin reescribir todo:
  accessToken: z.string().min(40).max(500).optional(),
  templateLang: z.string().min(2).max(10).optional(),
  siteId: z.string().cuid().optional().nullable(),
  isActive: z.boolean().optional(),
});
export type UpdateWhatsappAccountInput = z.infer<typeof updateWhatsappAccountSchema>;

export const whatsappTestSchema = z.object({
  to: z
    .string()
    .regex(/^\+?\d{8,15}$/, 'Número en formato E.164 (+57300...)'),
  templateName: z.string().min(2).max(100).optional(), // si no se da, usa hello_world
});
export type WhatsappTestInput = z.infer<typeof whatsappTestSchema>;

import { z } from 'zod';

/**
 * Consentimientos informados (Ley 23 de 1981, Ley 35 de 1989, Res. 1995 de 1999)
 * con firma electrónica del paciente (Ley 527 de 1999).
 *
 * Formato de las plantillas (texto simple, sin HTML):
 *  - `## Subtítulo` al inicio de línea
 *  - `**negrita**`
 *  - `- viñeta`
 *  - párrafos separados por línea en blanco
 * Merge tags disponibles: ver CONSENT_MERGE_TAGS.
 */

/** Merge tags que el servidor reemplaza al emitir el consentimiento. */
export const CONSENT_MERGE_TAGS = [
  { tag: '{{paciente.nombre}}', label: 'Nombre completo del paciente' },
  { tag: '{{paciente.documento}}', label: 'Tipo y número de documento' },
  { tag: '{{paciente.edad}}', label: 'Edad del paciente (ej. «34 años»)' },
  { tag: '{{clinica.nombre}}', label: 'Nombre de la clínica / consultorio' },
  { tag: '{{profesional.nombre}}', label: 'Profesional que emite el documento' },
  { tag: '{{profesional.registro}}', label: 'Registro profesional del profesional' },
  { tag: '{{fecha}}', label: 'Fecha larga (ej. «23 de septiembre de 2026»)' },
  { tag: '{{procedimiento}}', label: 'Procedimiento / detalle escrito al emitir' },
] as const;

// IDs: cuid en la práctica; se valida laxo para no romper con datos de seed.
const idSchema = z.string().trim().min(1).max(64);

export const createConsentTemplateSchema = z.object({
  name: z.string().trim().min(2).max(150),
  bodyMarkdown: z.string().trim().min(20).max(60_000),
  isActive: z.boolean().optional(),
});
export type CreateConsentTemplateInput = z.infer<typeof createConsentTemplateSchema>;

export const updateConsentTemplateSchema = z
  .object({
    name: z.string().trim().min(2).max(150).optional(),
    bodyMarkdown: z.string().trim().min(20).max(60_000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.bodyMarkdown !== undefined || v.isActive !== undefined, {
    message: 'Nada para actualizar',
  });
export type UpdateConsentTemplateInput = z.infer<typeof updateConsentTemplateSchema>;

export const listConsentTemplatesQuerySchema = z.object({
  // Solo lo respeta el dueño de la clínica (gestor de plantillas en Ajustes)
  includeInactive: z
    .union([z.literal('true'), z.literal('1'), z.literal('false'), z.literal('0')])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});
export type ListConsentTemplatesQuery = z.infer<typeof listConsentTemplatesQuerySchema>;

export const previewConsentSchema = z.object({
  patientId: idSchema,
  templateId: idSchema,
  // Texto libre opcional, ej. "Exodoncia del diente 38"
  procedureDetail: z.string().trim().max(300).optional(),
});
export type PreviewConsentInput = z.infer<typeof previewConsentSchema>;

export const issueConsentSchema = previewConsentSchema.extend({
  // Firma del paciente capturada en canvas: data URL PNG (≈ 30–300 KB).
  signatureImg: z.string().min(20).max(1_900_000),
  // Aceptada por compatibilidad pero IGNORADA: no hay columna para guardarla.
  professionalSignatureImg: z.string().max(1_900_000).optional(),
});
export type IssueConsentInput = z.infer<typeof issueConsentSchema>;

export const listConsentsQuerySchema = z.object({
  patientId: idSchema,
});
export type ListConsentsQuery = z.infer<typeof listConsentsQuerySchema>;

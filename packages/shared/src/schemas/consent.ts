import { z } from 'zod';

export const createConsentTemplateSchema = z.object({
  name: z.string().min(2).max(150),
  bodyMarkdown: z.string().min(20),
});
export type CreateConsentTemplateInput = z.infer<typeof createConsentTemplateSchema>;

export const issueConsentSchema = z.object({
  patientId: z.string().cuid(),
  templateId: z.string().cuid(),
  // Firma del paciente capturada en canvas, data URL
  signatureImg: z.string().min(20).max(500_000),
});
export type IssueConsentInput = z.infer<typeof issueConsentSchema>;

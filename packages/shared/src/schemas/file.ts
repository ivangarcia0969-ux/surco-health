import { z } from 'zod';

export const fileTypeEnum = z.enum([
  'RADIOGRAPHY', 'CBCT', 'LAB_RESULT', 'CLINICAL_PHOTO',
  'REFERRAL_DOC', 'PRESCRIPTION_PDF', 'CONSENT_PDF', 'REPORT', 'OTHER',
]);

export const presignUploadSchema = z.object({
  patientId: z.string().cuid().optional(),
  clinicalRecordId: z.string().cuid().optional(),
  type: fileTypeEnum,
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(120),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024), // 50 MB tope MVP
});
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

export const confirmUploadSchema = z.object({
  fileId: z.string().cuid(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;

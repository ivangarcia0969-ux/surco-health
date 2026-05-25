import { z } from 'zod';

const docTypeEnum = z.enum(['CC', 'TI', 'CE', 'RC', 'PA', 'RFC', 'DNI', 'PASSPORT', 'OTHER']);
const genderEnum = z.enum(['MALE', 'FEMALE', 'NON_BINARY', 'PREFER_NOT_TO_SAY', 'OTHER']);
const bloodTypeEnum = z.enum(['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN']);

export const createPatientSchema = z.object({
  documentType: docTypeEnum,
  documentId: z.string().min(3).max(30),
  fullName: z.string().min(2).max(150),
  birthdate: z.string().datetime(),
  gender: genderEnum,
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  bloodType: bloodTypeEnum.default('UNKNOWN'),
  allergiesSummary: z.string().max(300).optional(),
  insurerName: z.string().optional(),
  insurerPlan: z.string().optional(),
  insurerNumber: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  emergencyRel: z.string().optional(),
  notes: z.string().max(1000).optional(),
  // Aceptación habeas data (OBLIGATORIO al crear paciente)
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: 'Debe registrar la aceptación de la política de privacidad del paciente' }),
  }),
  privacyVersion: z.string().default('v1.0'),
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.partial().omit({ acceptedPrivacy: true });
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

export const listPatientsQuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

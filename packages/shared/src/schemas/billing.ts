import { z } from 'zod';

export const paymentMethodEnum = z.enum(['CASH', 'CARD', 'TRANSFER', 'INSURER', 'MIXED']);

/** Registrar un abono / pago del paciente (genera un recibo de caja). */
export const createPaymentSchema = z.object({
  patientId: z.string().cuid(),
  amount: z.number().positive().max(1_000_000_000),
  method: paymentMethodEnum,
  concept: z.string().min(2).max(200),
  reference: z.string().max(80).optional(),
});
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const billingSummaryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
export type BillingSummaryQuery = z.infer<typeof billingSummaryQuerySchema>;

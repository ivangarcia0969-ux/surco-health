import { z } from 'zod';

export const appointmentStatusEnum = z.enum([
  'REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'ATTENDED', 'NO_SHOW', 'CANCELLED',
]);

export const createAppointmentSchema = z.object({
  patientId: z.string().cuid(),
  professionalId: z.string().cuid(),
  serviceId: z.string().cuid().optional(),
  siteId: z.string().cuid().optional(),
  roomId: z.string().cuid().optional(),
  startsAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(480).optional(), // si no, toma de service
  channel: z.enum(['IN_PERSON', 'TELEHEALTH']).default('IN_PERSON'),
  reason: z.string().max(300).optional(),
  internalNotes: z.string().max(500).optional(),
});
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

export const updateAppointmentSchema = z.object({
  startsAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  status: appointmentStatusEnum.optional(),
  reason: z.string().max(300).optional(),
  internalNotes: z.string().max(500).optional(),
  cancelReason: z.string().max(300).optional(),
  serviceId: z.string().cuid().optional(),
  roomId: z.string().cuid().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;

export const listAppointmentsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  professionalId: z.string().cuid().optional(),
  patientId: z.string().cuid().optional(),
  siteId: z.string().cuid().optional(),
  status: appointmentStatusEnum.optional(),
});
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

export const scheduleBlockSchema = z.object({
  professionalId: z.string().cuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(150).optional(),
});
export type ScheduleBlockInput = z.infer<typeof scheduleBlockSchema>;

export const availabilitySchema = z.object({
  professionalId: z.string().cuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z.coerce.number().int().positive().max(480),
  siteId: z.string().cuid().optional(),
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

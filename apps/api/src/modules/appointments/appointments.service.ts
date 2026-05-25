import { Prisma } from '@surco/db';
import { prisma } from '../../plugins/prisma';
import { hasCollision } from './collision';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import type {
  CreateAppointmentInput, UpdateAppointmentInput, ListAppointmentsQuery, UserRole,
} from '@surco/shared';

export async function createAppointment(
  ctx: AuditContext, role: UserRole, input: CreateAppointmentInput,
) {
  // Profesional solo puede crear citas para sí mismo
  if (role === 'PROFESSIONAL' && input.professionalId !== ctx.actorId) {
    throw new AppError('FORBIDDEN_OTHER_PROFESSIONAL', 403);
  }

  return prisma.$transaction(async (tx) => {
    const [patient, professional, service] = await Promise.all([
      tx.patient.findFirst({ where: { id: input.patientId, tenantId: ctx.tenantId, isActive: true } }),
      tx.user.findFirst({
        where: { id: input.professionalId, tenantId: ctx.tenantId, role: 'PROFESSIONAL', isActive: true },
      }),
      input.serviceId
        ? tx.clinicalService.findFirst({ where: { id: input.serviceId, tenantId: ctx.tenantId, isActive: true } })
        : Promise.resolve(null),
    ]);
    if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);
    if (!professional) throw new AppError('PROFESSIONAL_NOT_FOUND', 404);
    if (input.serviceId && !service) throw new AppError('SERVICE_INVALID', 400);

    const durationMinutes =
      input.durationMinutes ?? service?.durationMinutes ?? 30;

    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    if (await hasCollision({
      tx, tenantId: ctx.tenantId, professionalId: input.professionalId, startsAt, endsAt,
    })) {
      throw new AppError('TIME_SLOT_CONFLICT', 409, { professionalId: input.professionalId, startsAt, endsAt });
    }

    const appt = await tx.appointment.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        professionalId: input.professionalId,
        serviceId: input.serviceId,
        siteId: input.siteId,
        roomId: input.roomId,
        startsAt, endsAt,
        channel: input.channel,
        reason: input.reason,
        internalNotes: input.internalNotes,
        status: 'CONFIRMED',
        createdBy: ctx.actorId,
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        professional: { select: { id: true, fullName: true, specialty: true } },
        service: { select: { id: true, name: true } },
      },
    });

    return appt;
  }, { isolationLevel: 'Serializable' })
    .then(async (appt) => {
      await logAudit({
        ctx, action: 'CREATE_PATIENT', entityType: 'Appointment', entityId: appt.id,
        metadata: { patientId: appt.patientId, professionalId: appt.professionalId, startsAt: appt.startsAt },
      });
      return appt;
    });
}

export async function updateAppointment(
  ctx: AuditContext, role: UserRole, id: string, input: UpdateAppointmentInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!existing) throw new AppError('APPOINTMENT_NOT_FOUND', 404);

    if (role === 'PROFESSIONAL' && existing.professionalId !== ctx.actorId) {
      throw new AppError('FORBIDDEN', 403);
    }

    let newStart = existing.startsAt;
    let newEnd = existing.endsAt;

    if (input.startsAt || input.durationMinutes) {
      const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
      const duration = input.durationMinutes
        ?? Math.round((existing.endsAt.getTime() - existing.startsAt.getTime()) / 60_000);
      newStart = startsAt;
      newEnd = new Date(startsAt.getTime() + duration * 60_000);

      if (await hasCollision({
        tx, tenantId: ctx.tenantId, professionalId: existing.professionalId,
        startsAt: newStart, endsAt: newEnd, excludeAppointmentId: id,
      })) {
        throw new AppError('TIME_SLOT_CONFLICT', 409);
      }
    }

    return tx.appointment.update({
      where: { id },
      data: {
        startsAt: newStart,
        endsAt: newEnd,
        status: input.status,
        reason: input.reason,
        internalNotes: input.internalNotes,
        cancelReason: input.cancelReason,
        cancelledAt: input.status === 'CANCELLED' ? new Date() : undefined,
        cancelledBy: input.status === 'CANCELLED' ? ctx.actorId : undefined,
        serviceId: input.serviceId,
        roomId: input.roomId,
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        professional: { select: { id: true, fullName: true } },
      },
    });
  });
}

export async function listAppointments(
  ctx: AuditContext, role: UserRole, q: ListAppointmentsQuery,
) {
  const where: Prisma.AppointmentWhereInput = { tenantId: ctx.tenantId };
  if (role === 'PROFESSIONAL') where.professionalId = ctx.actorId!;
  else if (q.professionalId) where.professionalId = q.professionalId;
  if (q.patientId) where.patientId = q.patientId;
  if (q.siteId) where.siteId = q.siteId;
  if (q.status) where.status = q.status;
  if (q.from || q.to) {
    where.startsAt = {};
    if (q.from) (where.startsAt as any).gte = new Date(q.from);
    if (q.to) (where.startsAt as any).lte = new Date(q.to);
  }

  return prisma.appointment.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    include: {
      patient: { select: { id: true, fullName: true, phone: true, documentId: true } },
      professional: { select: { id: true, fullName: true, specialty: true } },
      service: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      room: { select: { id: true, name: true } },
    },
  });
}

import type { Prisma } from '@surco/db';

interface CollisionArgs {
  tx: Prisma.TransactionClient;
  tenantId: string;
  professionalId: string;
  startsAt: Date;
  endsAt: Date;
  excludeAppointmentId?: string;
}

/**
 * Detecta solapamiento con citas activas o bloqueos del profesional.
 * Solape: (existingStart < newEnd) AND (existingEnd > newStart)
 */
export async function hasCollision(args: CollisionArgs): Promise<boolean> {
  const { tx, tenantId, professionalId, startsAt, endsAt, excludeAppointmentId } = args;

  const conflictAppt = await tx.appointment.findFirst({
    where: {
      tenantId,
      professionalId,
      id: excludeAppointmentId ? { not: excludeAppointmentId } : undefined,
      status: { in: ['REQUESTED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'ATTENDED'] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  if (conflictAppt) return true;

  const conflictBlock = await tx.professionalSchedule.findFirst({
    where: {
      tenantId,
      professionalId,
      type: 'BLOCK',
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  return !!conflictBlock;
}

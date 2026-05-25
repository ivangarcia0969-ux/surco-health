import { prisma } from '../../plugins/prisma';
import { hashPassword } from '../../utils/password';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import type { CreateProfessionalInput, CreateStaffInput, UpdateUserInput } from '@surco/shared';
import { UserRole } from '@surco/db';

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, fullName: true, phone: true, role: true,
      specialty: true, licenseNumber: true, licenseAuthority: true,
      mfaEnabled: true, tenantId: true,
      tenant: { select: { id: true, slug: true, tradeName: true, legalName: true, timezone: true, currency: true } },
    },
  });
  if (!user) throw new AppError('USER_NOT_FOUND', 404);
  return user;
}

export async function listProfessionals(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId, role: UserRole.PROFESSIONAL },
    select: {
      id: true, email: true, fullName: true, phone: true, specialty: true,
      licenseNumber: true, licenseAuthority: true, isActive: true,
      createdAt: true, lastLoginAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listStaff(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId, role: { in: [UserRole.RECEPTIONIST, UserRole.BILLING] } },
    select: {
      id: true, email: true, fullName: true, phone: true, role: true,
      isActive: true, createdAt: true, lastLoginAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createProfessional(ctx: AuditContext, input: CreateProfessionalInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('EMAIL_TAKEN', 409);

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      tenantId: ctx.tenantId,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
      role: UserRole.PROFESSIONAL,
      specialty: input.specialty,
      licenseNumber: input.licenseNumber,
      licenseAuthority: input.licenseAuthority,
      // Asignar a sedes si vienen
      sites: input.siteIds?.length
        ? { create: input.siteIds.map((siteId) => ({ siteId })) }
        : undefined,
    },
    select: { id: true, email: true, fullName: true, specialty: true },
  });

  await logAudit({ ctx, action: 'CREATE_USER', entityType: 'User', entityId: user.id, metadata: { role: 'PROFESSIONAL' } });
  return user;
}

export async function createStaff(ctx: AuditContext, input: CreateStaffInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('EMAIL_TAKEN', 409);

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      tenantId: ctx.tenantId,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone,
      role: input.role as UserRole,
    },
    select: { id: true, email: true, fullName: true, role: true },
  });

  await logAudit({ ctx, action: 'CREATE_USER', entityType: 'User', entityId: user.id, metadata: { role: input.role } });
  return user;
}

export async function updateUser(ctx: AuditContext, id: string, input: UpdateUserInput) {
  const user = await prisma.user.findFirst({ where: { id, tenantId: ctx.tenantId } });
  if (!user) throw new AppError('USER_NOT_FOUND', 404);

  const updated = await prisma.user.update({
    where: { id },
    data: input,
    select: {
      id: true, email: true, fullName: true, phone: true, role: true,
      specialty: true, isActive: true,
    },
  });

  await logAudit({
    ctx, action: input.isActive === false ? 'DISABLE_USER' : 'CHANGE_USER_ROLE',
    entityType: 'User', entityId: id, metadata: input,
  });
  return updated;
}

import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import type { UpdateTenantInput, CreateSiteInput, CreateRoomInput } from '@surco/shared';

export async function getMyTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true },
  });
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);
  return tenant;
}

export async function updateMyTenant(tenantId: string, input: UpdateTenantInput) {
  return prisma.tenant.update({
    where: { id: tenantId },
    data: input,
    include: { plan: true },
  });
}

export async function getUsage(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, include: { plan: true },
  });
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [professionals, monthAppts, patients] = await Promise.all([
    prisma.user.count({ where: { tenantId, role: 'PROFESSIONAL', isActive: true } }),
    prisma.appointment.count({
      where: { tenantId, createdAt: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
    }),
    prisma.patient.count({ where: { tenantId, isActive: true } }),
  ]);

  return {
    plan: tenant.plan,
    planExpiresAt: tenant.planExpiresAt,
    trialEndsAt: tenant.trialEndsAt,
    usage: { professionals, monthAppts, patients },
  };
}

export async function listPlans() {
  return prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthlyUsd: 'asc' } });
}

// === Sedes ===
export async function listSites(tenantId: string) {
  return prisma.site.findMany({
    where: { tenantId, isActive: true },
    orderBy: { isMain: 'desc' },
    include: { rooms: { where: { isActive: true }, orderBy: { name: 'asc' } } },
  });
}

export async function createSite(tenantId: string, input: CreateSiteInput) {
  return prisma.site.create({ data: { tenantId, ...input } });
}

export async function createRoom(tenantId: string, input: CreateRoomInput) {
  const site = await prisma.site.findFirst({ where: { id: input.siteId, tenantId } });
  if (!site) throw new AppError('SITE_NOT_FOUND', 404);
  return prisma.room.create({ data: { siteId: input.siteId, name: input.name } });
}

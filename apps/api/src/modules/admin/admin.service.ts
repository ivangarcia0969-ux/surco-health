import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import { cacheDel } from '../../plugins/redis';
import { PlanTier } from '@surco/db';

/**
 * Módulo de administración SaaS (rol SAAS_ADMIN).
 *
 * Pensado para VENTA ASISTIDA (concierge): el dueño del SaaS activa manualmente
 * a cada cliente que paga, asignándole un plan y una fecha de expiración.
 *
 * El bloqueo por expiración es automático: el authMiddleware rechaza con
 * TENANT_SUBSCRIPTION_EXPIRED cuando planExpiresAt < now.
 */

export async function listTenants() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      plan: { select: { tier: true, name: true, priceMonthlyUsd: true } },
      _count: {
        select: {
          users: true,
          patients: true,
          appointments: true,
        },
      },
    },
  });

  const now = Date.now();
  return tenants.map((t) => {
    const expMs = t.planExpiresAt ? new Date(t.planExpiresAt).getTime() : null;
    const trialMs = t.trialEndsAt ? new Date(t.trialEndsAt).getTime() : null;
    let estado: string;
    if (!t.isActive) estado = 'SUSPENDIDO';
    else if (expMs && expMs < now) estado = 'EXPIRADO';
    else if (expMs && expMs >= now) estado = 'PAGO_ACTIVO';
    else if (trialMs && trialMs >= now) estado = 'TRIAL';
    else if (trialMs && trialMs < now) estado = 'TRIAL_VENCIDO';
    else estado = 'SIN_PLAN';

    return {
      id: t.id,
      legalName: t.legalName,
      tradeName: t.tradeName,
      slug: t.slug,
      country: t.country,
      plan: t.plan,
      estado,
      planExpiresAt: t.planExpiresAt,
      trialEndsAt: t.trialEndsAt,
      isActive: t.isActive,
      createdAt: t.createdAt,
      usuarios: t._count.users,
      pacientes: t._count.patients,
      citas: t._count.appointments,
    };
  });
}

/**
 * Asigna un plan pago a un tenant y extiende su vigencia N meses.
 * Llamar DESPUÉS de confirmar el pago (Wompi) y el contrato firmado.
 */
export async function setTenantPlan(
  ctx: AuditContext,
  tenantId: string,
  args: { tier: 'FREE' | 'PRO' | 'CLINICA' | 'ENTERPRISE'; months: number },
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { users: { where: { role: 'CLINIC_OWNER' }, select: { id: true } } },
  });
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);

  const plan = await prisma.plan.findUnique({ where: { tier: args.tier as PlanTier } });
  if (!plan) throw new AppError('PLAN_NOT_FOUND', 404);

  // Extiende desde la fecha de expiración vigente (si está en el futuro) o desde hoy
  const base =
    tenant.planExpiresAt && new Date(tenant.planExpiresAt).getTime() > Date.now()
      ? new Date(tenant.planExpiresAt)
      : new Date();
  const newExpiry = new Date(base);
  newExpiry.setMonth(newExpiry.getMonth() + args.months);

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      planId: plan.id,
      planExpiresAt: newExpiry,
      isActive: true,
    },
    include: { plan: { select: { tier: true, name: true } } },
  });

  // Invalida cache de auth de todos los usuarios del tenant (plan cambió)
  await invalidateTenantUsersCache(tenantId);

  // El audit se registra CONTRA el tenant destino (el admin no tiene tenantId)
  await logAudit({
    ctx: { ...ctx, tenantId },
    action: 'OVERRIDE_TENANT_PLAN',
    entityType: 'Tenant',
    entityId: tenantId,
    metadata: { tier: args.tier, months: args.months, newExpiry, by: 'concierge', actorAdmin: ctx.actorId },
  });

  return {
    ok: true,
    tenant: updated.tradeName,
    plan: updated.plan.name,
    expiraEl: newExpiry,
  };
}

/** Suspende un tenant (deja de poder entrar). Reversible con setTenantPlan. */
export async function suspendTenant(ctx: AuditContext, tenantId: string, reason: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);

  await prisma.tenant.update({ where: { id: tenantId }, data: { isActive: false } });
  await invalidateTenantUsersCache(tenantId);

  await logAudit({
    ctx: { ...ctx, tenantId }, action: 'OVERRIDE_TENANT_PLAN', entityType: 'Tenant', entityId: tenantId,
    metadata: { action: 'suspend', reason, actorAdmin: ctx.actorId },
  });
  return { ok: true };
}

/** Reactiva un tenant suspendido sin cambiar su plan/fecha. */
export async function reactivateTenant(ctx: AuditContext, tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);

  await prisma.tenant.update({ where: { id: tenantId }, data: { isActive: true } });
  await invalidateTenantUsersCache(tenantId);

  await logAudit({
    ctx: { ...ctx, tenantId }, action: 'OVERRIDE_TENANT_PLAN', entityType: 'Tenant', entityId: tenantId,
    metadata: { action: 'reactivate', actorAdmin: ctx.actorId },
  });
  return { ok: true };
}

async function invalidateTenantUsersCache(tenantId: string) {
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  });
  await Promise.all(users.map((u) => cacheDel(`auth:user:${u.id}`)));
}

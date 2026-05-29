import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../plugins/prisma';

/** Bloquea creación de profesional si excede el límite del plan */
export function enforceProfessionalLimit(delta = 1) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth.tenantId) return;
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.auth.tenantId },
      include: {
        plan: true,
        _count: { select: { users: { where: { role: 'PROFESSIONAL', isActive: true } } } },
      },
    });
    if (!tenant) return reply.code(404).send({ error: 'TENANT_NOT_FOUND' });

    const current = tenant._count.users;
    if (current + delta > tenant.plan.maxProfessionals) {
      return reply.code(402).send({
        error: 'PLAN_LIMIT_EXCEEDED',
        feature: 'professionals',
        current,
        max: tenant.plan.maxProfessionals,
        planTier: tenant.plan.tier,
      });
    }
  };
}

/** Bloquea creación de cita si excede maxAppointmentsPerMonth */
export async function enforceMonthlyAppointmentsLimit(req: FastifyRequest, reply: FastifyReply) {
  if (!req.auth.tenantId) return;
  const tenant = await prisma.tenant.findUnique({
    where: { id: req.auth.tenantId },
    include: { plan: true },
  });
  if (!tenant) return reply.code(404).send({ error: 'TENANT_NOT_FOUND' });
  if (tenant.plan.maxAppointmentsPerMonth == null) return;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const count = await prisma.appointment.count({
    where: {
      tenantId: tenant.id,
      createdAt: { gte: startOfMonth },
      status: { not: 'CANCELLED' },
    },
  });

  if (count >= tenant.plan.maxAppointmentsPerMonth) {
    return reply.code(402).send({
      error: 'PLAN_LIMIT_EXCEEDED',
      feature: 'monthly_appointments',
      current: count,
      max: tenant.plan.maxAppointmentsPerMonth,
      planTier: tenant.plan.tier,
    });
  }
}

/** Gate feature por plan (telehealth, FE, FHIR export, WhatsApp, etc.) */
export function requirePlanFeature(
  feature: 'telehealth' | 'electronicInvoice' | 'fhirExport' | 'multiSite' | 'whatsapp',
) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.auth.tenantId) return;
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.auth.tenantId },
      include: { plan: true },
    });
    if (!tenant) return reply.code(404).send({ error: 'TENANT_NOT_FOUND' });

    const enabled =
      (feature === 'telehealth' && tenant.plan.telehealthEnabled) ||
      (feature === 'electronicInvoice' && tenant.plan.electronicInvoiceEnabled) ||
      (feature === 'fhirExport' && tenant.plan.fhirExportEnabled) ||
      (feature === 'multiSite' && tenant.plan.multiSiteEnabled) ||
      (feature === 'whatsapp' && tenant.plan.whatsappEnabled);

    if (!enabled) {
      return reply.code(402).send({
        error: 'FEATURE_NOT_IN_PLAN',
        feature,
        planTier: tenant.plan.tier,
      });
    }
  };
}

import { prisma } from '../../plugins/prisma';
import { hashPassword, verifyPassword } from '../../utils/password';
import {
  signAccessToken, generateRefreshToken, hashRefreshToken, refreshTokenExpiry,
} from '../../utils/jwt';
import { AppError } from '../../utils/errors';
import { logAudit } from '@surco/audit';
import type { LoginInput, RegisterClinicInput } from '@surco/shared';
import { PlanTier, UserRole, Country } from '@surco/db';

export async function login(input: LoginInput, ipAddress: string | null, userAgent: string | null) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { tenant: true },
  });
  if (!user || !user.isActive) {
    if (user) {
      await logAudit({
        ctx: { tenantId: user.tenantId ?? 'global', actorId: user.id, ipAddress, userAgent },
        action: 'LOGIN_FAILURE',
        entityType: 'User',
        entityId: user.id,
        metadata: { reason: 'inactive_or_not_found' },
      });
    }
    throw new AppError('INVALID_CREDENTIALS', 401);
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    await logAudit({
      ctx: { tenantId: user.tenantId ?? 'global', actorId: user.id, ipAddress, userAgent },
      action: 'LOGIN_FAILURE',
      entityType: 'User',
      entityId: user.id,
      metadata: { reason: 'wrong_password' },
    });
    throw new AppError('INVALID_CREDENTIALS', 401);
  }

  if (input.tenantSlug && user.tenant?.slug !== input.tenantSlug) {
    throw new AppError('TENANT_MISMATCH', 403);
  }

  const accessToken = signAccessToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as any,
    specialty: user.specialty,
  });
  const { token: refreshToken, hash } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: hash, expiresAt: refreshTokenExpiry(), ipAddress, userAgent },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ipAddress },
  });

  await logAudit({
    ctx: { tenantId: user.tenantId ?? 'global', actorId: user.id, actorRole: user.role, ipAddress, userAgent },
    action: 'LOGIN_SUCCESS',
    entityType: 'User',
    entityId: user.id,
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      specialty: user.specialty,
      tenantId: user.tenantId,
      tenantSlug: user.tenant?.slug,
    },
  };
}

export async function registerClinic(input: RegisterClinicInput) {
  const existing = await prisma.tenant.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError('SLUG_TAKEN', 409);

  const emailExists = await prisma.user.findUnique({ where: { email: input.ownerEmail } });
  if (emailExists) throw new AppError('EMAIL_TAKEN', 409);

  const freePlan = await prisma.plan.findUnique({ where: { tier: PlanTier.FREE } });
  if (!freePlan) throw new AppError('NO_FREE_PLAN', 500);

  const passwordHash = await hashPassword(input.ownerPassword);

  const tenant = await prisma.tenant.create({
    data: {
      legalName: input.legalName,
      tradeName: input.tradeName,
      slug: input.slug,
      country: input.country as Country,
      timezone: input.timezone,
      currency: input.currency,
      primarySpecialty: input.primarySpecialty ?? null,
      taxId: input.taxId,
      taxIdType: input.taxIdType,
      planId: freePlan.id,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      privacyPolicyAcceptedAt: new Date(),
      users: {
        create: {
          email: input.ownerEmail,
          passwordHash,
          fullName: input.ownerName,
          phone: input.ownerPhone,
          role: UserRole.CLINIC_OWNER,
        },
      },
    },
    include: { users: true },
  });

  return { tenantId: tenant.id, ownerId: tenant.users[0].id };
}

export async function refreshSession(refreshToken: string, ipAddress: string | null, userAgent: string | null) {
  const hash = hashRefreshToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
    include: { user: { include: { tenant: true } } },
  });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AppError('INVALID_REFRESH_TOKEN', 401);
  }
  if (!stored.user.isActive) throw new AppError('USER_INACTIVE', 401);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const accessToken = signAccessToken({
    userId: stored.user.id,
    tenantId: stored.user.tenantId,
    role: stored.user.role as any,
    specialty: stored.user.specialty,
  });
  const { token: newRefresh, hash: newHash } = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: stored.user.id, tokenHash: newHash, expiresAt: refreshTokenExpiry(), ipAddress, userAgent },
  });

  return { accessToken, refreshToken: newRefresh };
}

export async function logout(refreshToken: string) {
  const hash = hashRefreshToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

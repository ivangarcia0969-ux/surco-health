import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../plugins/prisma';
import { cacheGet, cacheSet, cacheDel } from '../plugins/redis';
import { verifyAccessToken } from '../utils/jwt';
import type { AuthContext, UserRole } from '@surco/shared';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}

interface CachedAuthUser {
  userId: string;
  tenantId: string | null;
  role: UserRole;
  specialty: string | null;
  isActive: boolean;
  tenantIsActive: boolean | null;
  tenantPlanExpiresAt: string | null; // ISO
}

const AUTH_CACHE_TTL = 60; // 60s — invalidación corta para revocaciones rápidas

function authCacheKey(userId: string): string {
  return `auth:user:${userId}`;
}

/**
 * Invalida la cache de un usuario. Llamar cuando:
 *  - El usuario es desactivado
 *  - El rol cambia
 *  - El tenant cambia de plan o expira
 *  - El usuario cambia de tenant
 */
export async function invalidateAuthCache(userId: string): Promise<void> {
  await cacheDel(authCacheKey(userId));
}

export async function authMiddleware(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'MISSING_TOKEN' });
  }

  let payload: AuthContext;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    return reply.code(401).send({ error: 'INVALID_TOKEN' });
  }

  // 1) Hit cache — evita el JOIN user→tenant→plan en cada request
  let cached = await cacheGet<CachedAuthUser>(authCacheKey(payload.userId));

  if (!cached) {
    // 2) Miss — leer de BD y poblar cache
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: { include: { plan: true } } },
    });
    if (!user) {
      return reply.code(401).send({ error: 'USER_NOT_FOUND' });
    }
    cached = {
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role as UserRole,
      specialty: user.specialty ?? null,
      isActive: user.isActive,
      tenantIsActive: user.tenant?.isActive ?? null,
      tenantPlanExpiresAt: user.tenant?.planExpiresAt?.toISOString() ?? null,
    };
    await cacheSet(authCacheKey(payload.userId), cached, AUTH_CACHE_TTL);
  }

  // 3) Verificar status (estos campos vienen de la cache pero son revocables
  //    en máximo AUTH_CACHE_TTL segundos)
  if (!cached.isActive) {
    return reply.code(401).send({ error: 'USER_INACTIVE' });
  }
  if (cached.tenantIsActive === false) {
    return reply.code(403).send({ error: 'TENANT_INACTIVE' });
  }
  if (
    cached.tenantPlanExpiresAt &&
    new Date(cached.tenantPlanExpiresAt).getTime() < Date.now()
  ) {
    return reply.code(402).send({ error: 'TENANT_SUBSCRIPTION_EXPIRED' });
  }

  req.auth = {
    userId: cached.userId,
    tenantId: cached.tenantId,
    role: cached.role,
    specialty: cached.specialty,
  };
}

export function requireRole(...roles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(req.auth.role)) {
      return reply.code(403).send({ error: 'FORBIDDEN' });
    }
  };
}

/**
 * Helper: extrae el contexto para audit log desde la request autenticada.
 */
export function auditContextFromReq(req: FastifyRequest) {
  return {
    tenantId: req.auth.tenantId!,
    actorId: req.auth.userId,
    actorRole: req.auth.role,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  };
}

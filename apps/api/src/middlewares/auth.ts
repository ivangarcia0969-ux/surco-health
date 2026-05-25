import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../plugins/prisma';
import { verifyAccessToken } from '../utils/jwt';
import type { AuthContext, UserRole } from '@surco/shared';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
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

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { tenant: { include: { plan: true } } },
  });

  if (!user || !user.isActive) {
    return reply.code(401).send({ error: 'USER_INACTIVE' });
  }

  if (user.tenant) {
    if (!user.tenant.isActive) {
      return reply.code(403).send({ error: 'TENANT_INACTIVE' });
    }
    if (user.tenant.planExpiresAt && user.tenant.planExpiresAt < new Date()) {
      return reply.code(402).send({ error: 'TENANT_SUBSCRIPTION_EXPIRED' });
    }
  }

  req.auth = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role as UserRole,
    specialty: user.specialty ?? null,
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

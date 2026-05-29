import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { env } from '../config/env';
import type { AuthContext } from '@surco/shared';

// JWT_ALG fijo en HS256 — explicitar previene "alg: none" attack y migración accidental
const JWT_ALG = 'HS256' as const;

export function signAccessToken(payload: AuthContext): string {
  const opts: SignOptions = {
    expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'],
    algorithm: JWT_ALG,
  };
  return jwt.sign(payload, env.JWT_SECRET, opts);
}

export function verifyAccessToken(token: string): AuthContext {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [JWT_ALG] }) as AuthContext;
}

export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiry(): Date {
  const ttl = env.JWT_REFRESH_TTL;
  const match = ttl.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error('Invalid JWT_REFRESH_TTL');
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const ms =
    unit === 's' ? n * 1000 :
    unit === 'm' ? n * 60 * 1000 :
    unit === 'h' ? n * 60 * 60 * 1000 :
    n * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

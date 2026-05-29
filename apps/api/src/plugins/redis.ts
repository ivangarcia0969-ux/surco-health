/**
 * Conexión Redis singleton para uso del API (cache de auth + rate limit por tenant).
 * Es la MISMA Redis que usa BullMQ — distinto DB index para no mezclar (db 1).
 */
import IORedis from 'ioredis';
import { env } from '../config/env';

let _redis: IORedis | null = null;

export function getRedis(): IORedis | null {
  if (_redis) return _redis;
  if (!env.REDIS_URL) {
    // Sin Redis funcionamos pero sin cache (modo dev)
    return null;
  }
  _redis = new IORedis(env.REDIS_URL, {
    db: 1, // db 0 lo usa BullMQ
    maxRetriesPerRequest: 2,
    enableReadyCheck: false,
    lazyConnect: false,
  });
  _redis.on('error', (e) => console.warn('[redis-cache]', e.message));
  return _redis;
}

/** Cache helper: get/set JSON con TTL */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const v = await r.get(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    /* swallow */
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  const r = getRedis();
  if (!r || keys.length === 0) return;
  try {
    await r.del(...keys);
  } catch {
    /* swallow */
  }
}

/** Health check de Redis para /health */
export async function redisHealthcheck(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const pong = await r.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

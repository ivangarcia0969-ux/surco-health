import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { env, corsOrigins } from './config/env';
import { AppError } from './utils/errors';
import { verifyEncryptionSetup } from '@surco/encryption';
import { prisma } from './plugins/prisma';
import { redisHealthcheck } from './plugins/redis';

import authRoutes from './modules/auth/auth.routes';
import tenantsRoutes from './modules/tenants/tenants.routes';
import usersRoutes from './modules/users/users.routes';
import patientsRoutes from './modules/patients/patients.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import clinicalRoutes from './modules/clinical/clinical.routes';
import dentalRoutes from './modules/dental/dental.routes';
import medicalRoutes from './modules/medical/medical.routes';
import psychologyRoutes from './modules/psychology/psychology.routes';
import catalogRoutes from './modules/catalog/catalog.routes';
import fhirRoutes from './modules/fhir/fhir.routes';
import whatsappRoutes from './modules/whatsapp/whatsapp.routes';
import arcoRoutes from './modules/arco/arco.routes';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...(env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } },
      }),
    },
    trustProxy: true,
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // FIX seguridad: el patrón antiguo `endsWith(rootDomain)` permite
      // `evilroot.com` cuando root es `root.com`. Forzamos un punto delante.
      const allowed = corsOrigins.some((a) => {
        if (a.startsWith('*.')) {
          const suffix = a.slice(1); // ".surcoapp.tech"
          return origin === `https://${a.slice(2)}` || origin.endsWith(suffix);
        }
        return origin === a;
      });
      if (allowed) return cb(null, true);
      cb(new Error('CORS_BLOCKED'), false);
    },
    credentials: true,
  });
  await app.register(sensible);
  // Rate limit por tenant si está autenticado, sino por IP — evita que
  // recepcionistas detrás del mismo NAT compartan el límite.
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => {
      const t = (req as any).auth?.tenantId;
      return t ? `tenant:${t}` : `ip:${req.ip}`;
    },
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, details: err.details });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });

  // Health real: chequea Postgres + Redis. Si algo está roto, responde 503.
  // Esto permite que Caddy / load balancer detecte un container muerto.
  app.get('/health', async (_req, reply) => {
    const checks = {
      api: 'ok',
      postgres: 'unknown' as 'ok' | 'fail' | 'unknown',
      redis: 'unknown' as 'ok' | 'fail' | 'unknown',
    };
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = 'ok';
    } catch {
      checks.postgres = 'fail';
    }
    try {
      checks.redis = (await redisHealthcheck()) ? 'ok' : 'fail';
    } catch {
      checks.redis = 'fail';
    }
    const healthy = checks.postgres === 'ok' && (checks.redis === 'ok' || !env.REDIS_URL);
    return reply
      .code(healthy ? 200 : 503)
      .send({
        status: healthy ? 'ok' : 'degraded',
        ts: new Date().toISOString(),
        checks,
      });
  });

  // ============ Rutas autenticadas ============
  app.register(
    async (instance) => {
      await instance.register(rateLimit, { max: 20, timeWindow: '1 minute' });
      await instance.register(authRoutes);
    },
    { prefix: '/api/auth' },
  );
  await app.register(tenantsRoutes, { prefix: '/api/tenants' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(patientsRoutes, { prefix: '/api/patients' });
  await app.register(appointmentsRoutes, { prefix: '/api/appointments' });
  await app.register(clinicalRoutes, { prefix: '/api/clinical' });
  await app.register(dentalRoutes, { prefix: '/api/dental' });
  await app.register(medicalRoutes, { prefix: '/api/medical' });
  await app.register(psychologyRoutes, { prefix: '/api/psychology' });
  await app.register(catalogRoutes, { prefix: '/api/catalog' });
  await app.register(fhirRoutes, { prefix: '/api/fhir' });
  await app.register(whatsappRoutes, { prefix: '/api/whatsapp' });
  await app.register(arcoRoutes, { prefix: '/api/arco' });

  return app;
}

async function main() {
  // Verifica encriptación al boot — falla rápido si está mal configurada
  await verifyEncryptionSetup();

  const app = await buildServer();
  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
    app.log.info(`🚀 Surco Health API listening on http://${env.API_HOST}:${env.API_PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async (sig: string) => {
    app.log.info(`Received ${sig}, shutting down...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();

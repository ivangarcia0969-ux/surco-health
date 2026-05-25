import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { env, corsOrigins } from './config/env';
import { AppError } from './utils/errors';
import { verifyEncryptionSetup } from '@surco/encryption';

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
      if (corsOrigins.some((a) => (a.startsWith('*.') ? origin.endsWith(a.slice(2)) : origin === a))) {
        return cb(null, true);
      }
      cb(new Error('CORS_BLOCKED'), false);
    },
    credentials: true,
  });
  await app.register(sensible);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: err.code, details: err.details });
    }
    req.log.error(err);
    return reply.code(500).send({ error: 'INTERNAL_ERROR' });
  });

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

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

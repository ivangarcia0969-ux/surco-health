import type { FastifyInstance } from 'fastify';
import { loginSchema, registerClinicSchema, refreshTokenSchema } from '@surco/shared';
import * as svc from './auth.service';

export default async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
    }
    const result = await svc.login(parsed.data, req.ip, req.headers['user-agent'] ?? null);
    return reply.send(result);
  });

  app.post('/register', async (req, reply) => {
    const parsed = registerClinicSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'VALIDATION', issues: parsed.error.issues });
    }
    const result = await svc.registerClinic(parsed.data);
    return reply.code(201).send(result);
  });

  app.post('/refresh', async (req, reply) => {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION' });
    const result = await svc.refreshSession(parsed.data.refreshToken, req.ip, req.headers['user-agent'] ?? null);
    return reply.send(result);
  });

  app.post('/logout', async (req, reply) => {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'VALIDATION' });
    await svc.logout(parsed.data.refreshToken);
    return reply.code(204).send();
  });
}

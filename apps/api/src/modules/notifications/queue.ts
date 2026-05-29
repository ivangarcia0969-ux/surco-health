/**
 * BullMQ — definición de colas y conexión Redis compartida.
 *
 * Cola única: `appointment-reminder`. Jobs delayed se encolan al crear cita
 * con `jobId: reminder:<appointmentId>` (idempotente).
 *
 * El scheduler/sweeper (`reminder-sweeper.ts`) corre cada N minutos y reencola
 * cualquier cita 24h-próxima cuyo recordatorio falte (defensa contra Redis caído).
 */
import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../../config/env';

let _redis: IORedis | null = null;
let _queue: Queue<ReminderJobData> | null = null;
let _events: QueueEvents | null = null;

export interface ReminderJobData {
  appointmentId: string;
  tenantId: string;
}

function getRedis(): IORedis {
  if (_redis) return _redis;
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL no configurada — el worker WhatsApp requiere Redis');
  }
  _redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
  _redis.on('error', (e) => console.error('[redis]', e.message));
  return _redis;
}

export function getReminderQueue(): Queue<ReminderJobData> {
  if (_queue) return _queue;
  _queue = new Queue<ReminderJobData>('appointment-reminder', {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 60_000 }, // 1m, 2m, 4m, 8m, 16m
      removeOnComplete: { age: 7 * 24 * 3600, count: 5000 }, // 7 días
      removeOnFail: { age: 30 * 24 * 3600, count: 5000 }, // 30 días para auditoría
    },
  });
  return _queue;
}

export function getReminderEvents(): QueueEvents {
  if (_events) return _events;
  _events = new QueueEvents('appointment-reminder', { connection: getRedis() });
  return _events;
}

/**
 * Encolar recordatorio. Idempotente — si se llama dos veces para la misma cita,
 * BullMQ rechaza el segundo (mismo jobId).
 *
 * Calcula delay = reminderAt - now. Si reminderAt es pasado, NO encola.
 */
export async function enqueueReminder(
  appointmentId: string,
  tenantId: string,
  reminderAt: Date,
): Promise<{ enqueued: boolean; reason?: string }> {
  const now = Date.now();
  const delay = reminderAt.getTime() - now;
  if (delay <= 0) {
    return { enqueued: false, reason: 'reminder time already passed' };
  }
  // BullMQ no recomienda delays > 24 días; el sweeper se encarga si pasa de eso.
  if (delay > 30 * 24 * 3600_000) {
    return { enqueued: false, reason: 'delay too far in future — sweeper handles it' };
  }

  try {
    await getReminderQueue().add(
      'send',
      { appointmentId, tenantId },
      {
        jobId: `reminder:${appointmentId}`,
        delay,
      },
    );
    return { enqueued: true };
  } catch (err: any) {
    // Si ya existe un job con ese jobId, BullMQ lanza error — ignorable
    if (String(err.message).includes('Duplicated job')) {
      return { enqueued: false, reason: 'already enqueued' };
    }
    throw err;
  }
}

/** Cancela un recordatorio (al cancelar la cita) */
export async function cancelReminder(appointmentId: string): Promise<void> {
  const queue = getReminderQueue();
  const job = await queue.getJob(`reminder:${appointmentId}`);
  if (job) {
    try {
      await job.remove();
    } catch {
      /* job ya estaba ejecutándose o terminado */
    }
  }
}

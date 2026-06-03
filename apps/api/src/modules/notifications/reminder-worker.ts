/**
 * Worker BullMQ — procesa recordatorios de cita.
 *
 * Flujo:
 *   1) Toma job con appointmentId
 *   2) Vuelve a cargar la cita (fuente de verdad — puede haber cambiado)
 *   3) Si cancelada/atendida/movida → SKIP
 *   4) Resuelve qué WhatsappAccount usar (siteId → default, FASE 6 multi-bot)
 *   5) Renderiza plantilla
 *   6) Envía a Meta Graph
 *   7) Marca Appointment.reminderSentAt + crea NotificationLog
 *   8) Audit log
 *
 * Falla limpiamente: si Meta responde 4xx por número inválido, marca SKIPPED;
 * si responde 5xx o timeout, deja reintentar.
 */
import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '../../plugins/prisma';
import { env } from '../../config/env';
import { resolveAccountForSend } from '../whatsapp/whatsapp.service';
import { logAudit } from '@surco/audit';
import type { ReminderJobData } from './queue';

const META_GRAPH_BASE = 'https://graph.facebook.com';
const META_API_VERSION = 'v22.0';

let worker: Worker<ReminderJobData> | null = null;

export function startReminderWorker(): Worker<ReminderJobData> {
  if (worker) return worker;
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL requerido para el worker WhatsApp');
  }

  const connection = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  worker = new Worker<ReminderJobData>(
    'appointment-reminder',
    async (job) => processReminderJob(job),
    {
      connection,
      concurrency: 10, // 10 envíos en paralelo (Meta tier inicial = 250 msg/s)
      limiter: { max: 50, duration: 1000 }, // hard cap 50/s (margen de seguridad)
    },
  );

  worker.on('completed', (job, result: any) => {
    console.log(`[reminder] ✓ ${job.data.appointmentId} → ${result?.status ?? 'sent'}`);
  });
  worker.on('failed', (job, err) => {
    console.error(`[reminder] ✗ ${job?.data?.appointmentId}: ${err.message}`);
  });

  console.log('🔔 Worker WhatsApp reminder iniciado (concurrency=10, rate=50/s)');
  return worker;
}

interface ProcessResult {
  status: 'SENT' | 'SKIPPED_CANCELLED' | 'SKIPPED_NO_BOT' | 'SKIPPED_NO_PHONE' | 'SKIPPED_ALREADY_SENT';
  messageId?: string;
}

async function processReminderJob(
  job: Job<ReminderJobData>,
): Promise<ProcessResult> {
  const { appointmentId, tenantId } = job.data;

  // 1) Recargar la cita
  const appt = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId },
    include: {
      patient: { select: { fullName: true, phone: true } },
      professional: { select: { fullName: true } },
      site: { select: { id: true, name: true } },
    },
  });
  if (!appt) {
    // Cita borrada — nada que enviar
    return { status: 'SKIPPED_CANCELLED' };
  }

  // Si la cita ya fue atendida, no enviada, cancelada o no se presentó: nada que recordar.
  // AppointmentStatus en el schema: ATTENDED es el equivalente de COMPLETED.
  if (appt.status === 'CANCELLED' || appt.status === 'NO_SHOW' || appt.status === 'ATTENDED') {
    return { status: 'SKIPPED_CANCELLED' };
  }
  if (appt.reminderSentAt) {
    return { status: 'SKIPPED_ALREADY_SENT' };
  }
  if (!appt.patient.phone) {
    return { status: 'SKIPPED_NO_PHONE' };
  }

  // 2) Resolver el bot que debe enviar (siteId → default del tenant)
  const acct = await resolveAccountForSend(tenantId, appt.site?.id ?? null);
  if (!acct) {
    // Marcar como skipped — el tenant no tiene WhatsApp configurado
    await prisma.notificationLog.create({
      data: {
        tenantId,
        recipientId: appt.patientId,
        toContact: appt.patient.phone,
        channel: 'WHATSAPP',
        kind: 'APPOINTMENT_REMINDER',
        body: '(skipped — no whatsapp account configured)',
        status: 'skipped',
        errorMessage: 'NO_WHATSAPP_ACCOUNT',
      },
    });
    return { status: 'SKIPPED_NO_BOT' };
  }

  // 3) Renderizar plantilla (usamos `appointment_reminder` que el tenant debe
  //    pre-aprobar en Meta — si no, fallback a hello_world)
  const phoneTo = appt.patient.phone.replace(/[^\d]/g, '');
  const localDate = appt.startsAt.toLocaleString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });

  // 4) Enviar a Meta
  const url = `${META_GRAPH_BASE}/${META_API_VERSION}/${acct.phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: phoneTo,
    type: 'template',
    template: {
      name: 'appointment_reminder',
      language: { code: acct.templateLang ?? 'es_CO' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: appt.patient.fullName ?? 'paciente' },
            { type: 'text', text: localDate },
            { type: 'text', text: appt.professional.fullName ?? 'profesional' },
          ],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${acct.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    const code = json?.error?.code;
    // 131026 = mensaje no entregable; 131008 = falta plantilla. No reintentar.
    const nonRetryable = [131008, 131026, 131047, 131051, 100];
    if (nonRetryable.includes(code)) {
      await prisma.notificationLog.create({
        data: {
          tenantId,
          recipientId: appt.patientId,
          toContact: phoneTo,
          channel: 'WHATSAPP',
          kind: 'APPOINTMENT_REMINDER',
          body: `(reminder for ${appt.patient.fullName ?? 'patient'} — ${localDate})`,
          status: 'failed',
          errorMessage: `META_${code}: ${json?.error?.message}`,
        },
      });
      return { status: 'SKIPPED_NO_PHONE' };
    }
    // Reintentar para errores transitorios
    throw new Error(`META_${code}: ${json?.error?.message ?? res.statusText}`);
  }

  const messageId = json?.messages?.[0]?.id ?? null;

  // 5) Marcar enviado + log
  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointmentId },
      data: { reminderSentAt: new Date() },
    }),
    prisma.notificationLog.create({
      data: {
        tenantId,
        recipientId: appt.patientId,
        toContact: phoneTo,
        channel: 'WHATSAPP',
        kind: 'APPOINTMENT_REMINDER',
        body: `Recordatorio de cita para ${appt.patient.fullName ?? 'paciente'} el ${localDate}`,
        externalId: messageId,
        status: 'sent',
        sentAt: new Date(),
      },
    }),
  ]);

  await logAudit({
    ctx: { tenantId, actorId: null, actorRole: 'SYSTEM' },
    action: 'SEND_NOTIFICATION',
    entityType: 'Appointment',
    entityId: appointmentId,
    metadata: { channel: 'whatsapp', botId: acct.id, messageId },
  });

  return { status: 'SENT', messageId: messageId ?? undefined };
}

export async function stopReminderWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

/**
 * Sweeper — corre cada 10 minutos. Busca citas en las próximas 26h que NO
 * tengan reminderSentAt y reencola el job (idempotente vía jobId).
 *
 * Defensa contra:
 *   - Redis caído por horas → cuando vuelve, los jobs delayed se pierden
 *   - Citas creadas con appointmentId antes de que Redis estuviera listo
 *   - Worker reiniciado mientras un job estaba ejecutándose
 *   - Migración de datos / cargas masivas iniciales
 */
import { prisma } from '../../plugins/prisma';
import { env } from '../../config/env';
import { enqueueReminder } from './queue';

const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos
const LOOKAHEAD_HOURS = env.WHATSAPP_REMINDER_HOURS_BEFORE + 2; // +2h margen

let timer: NodeJS.Timeout | null = null;
let running = false;

export function startReminderSweeper(): void {
  if (timer) return;
  // Primer sweep inmediato (al boot)
  setTimeout(sweep, 5000);
  timer = setInterval(sweep, SWEEP_INTERVAL_MS);
  console.log(`🧹 Reminder sweeper iniciado (cada ${SWEEP_INTERVAL_MS / 60000}min, lookahead ${LOOKAHEAD_HOURS}h)`);
}

export function stopReminderSweeper(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

async function sweep(): Promise<void> {
  if (running) {
    console.warn('[sweeper] previous sweep still running — skipping');
    return;
  }
  running = true;
  const t0 = Date.now();
  try {
    const now = new Date();
    const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 3600_000);

    // Buscar citas en ventana [now+1h, now+lookahead] sin recordatorio enviado
    // Filtramos también por status activo y patient con teléfono.
    const candidates = await prisma.appointment.findMany({
      where: {
        // AppointmentStatus = REQUESTED | CONFIRMED | CHECKED_IN | IN_PROGRESS | ATTENDED | NO_SHOW | CANCELLED
        // Recordamos solo a las activas que aún NO fueron atendidas
        status: { in: ['REQUESTED', 'CONFIRMED'] },
        startsAt: { gte: new Date(now.getTime() + 60 * 60_000), lte: horizon },
        reminderSentAt: null,
        patient: { phone: { not: null } },
        tenant: {
          isActive: true,
          plan: { whatsappEnabled: true },
          whatsappAccounts: { some: { isActive: true } }, // tenant tiene al menos 1 bot
        },
      },
      select: {
        id: true,
        tenantId: true,
        startsAt: true,
      },
      take: 500, // hard cap por sweep
    });

    if (candidates.length === 0) {
      return;
    }

    const hoursBefore = env.WHATSAPP_REMINDER_HOURS_BEFORE;
    let enqueued = 0;
    let skipped = 0;
    for (const a of candidates) {
      const remindAt = new Date(a.startsAt.getTime() - hoursBefore * 3600_000);
      const r = await enqueueReminder(a.id, a.tenantId, remindAt);
      if (r.enqueued) enqueued++;
      else skipped++;
    }
    const dt = Date.now() - t0;
    console.log(`[sweeper] ${candidates.length} candidatos · ${enqueued} encolados · ${skipped} skipped · ${dt}ms`);
  } catch (err) {
    console.error('[sweeper] error:', (err as Error).message);
  } finally {
    running = false;
  }
}

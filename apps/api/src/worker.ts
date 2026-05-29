/**
 * Surco Health — Worker BullMQ standalone.
 *
 * Corre como container separado (`worker` en docker-compose.prod.yml). NO
 * comparte proceso con la API para que:
 *   - Reiniciar el API no interrumpa jobs delayed (BullMQ los retoma, pero
 *     es mejor no mezclar request-handling con job-processing)
 *   - Escalar uno sin escalar el otro
 *   - El crash de un job no tumba la API
 *
 * Para correr local: `pnpm --filter @surco/api dev:worker`
 * Para correr en prod: `node dist/worker.js`
 */
import { verifyEncryptionSetup } from '@surco/encryption';
import { env } from './config/env';
import { startReminderWorker, stopReminderWorker } from './modules/notifications/reminder-worker';
import { startReminderSweeper, stopReminderSweeper } from './modules/notifications/reminder-sweeper';

async function main() {
  console.log('🚀 Surco Health Worker');
  console.log(`   NODE_ENV: ${env.NODE_ENV}`);
  console.log(`   REDIS_URL: ${env.REDIS_URL ? '✓ configurado' : '✗ FALTA'}`);
  console.log(`   WORKER_ENABLED: ${env.WORKER_ENABLED}`);

  if (!env.WORKER_ENABLED) {
    console.log('   WORKER_ENABLED=false — saliendo (heartbeat para keep-alive container)');
    setInterval(() => {/* keep alive */}, 60_000);
    return;
  }

  if (!env.REDIS_URL) {
    console.error('✗ REDIS_URL es obligatorio para el worker. Configúralo en .env');
    process.exit(1);
  }

  // Verifica encryption setup (algunos jobs descifran tokens WhatsApp)
  await verifyEncryptionSetup();

  // Inicia el worker BullMQ
  startReminderWorker();

  // Inicia el sweeper (recovery de jobs perdidos)
  startReminderSweeper();

  const shutdown = async (sig: string) => {
    console.log(`\n[worker] señal ${sig} — apagando…`);
    stopReminderSweeper();
    await stopReminderWorker();
    console.log('[worker] apagado limpio.');
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log('✅ Worker corriendo. Escuchando jobs de la cola appointment-reminder.');
}

main().catch((err) => {
  console.error('✗ Worker falló al iniciar:', err);
  process.exit(1);
});

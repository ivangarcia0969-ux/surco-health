import { prisma } from '@surco/db';

/**
 * Helpers de encriptación de columnas usando pgcrypto.
 *
 * Patrón:
 *   - Texto plano nunca toca disco — siempre se envía cifrado al INSERT/UPDATE
 *   - Lectura: se descifra con la clave en runtime, solo en memoria
 *   - Clave: ENCRYPTION_KEY del entorno (32 bytes hex; pgcrypto la usa con AES)
 *
 * IMPORTANTE: si pierdes la ENCRYPTION_KEY, los datos cifrados son irrecuperables.
 * Hacer backup de la clave en gestor de secretos (1Password, Vault, AWS Secrets).
 */

function getKey(): string {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || k.length < 32) {
    throw new Error('ENCRYPTION_KEY no configurada o demasiado corta (mínimo 32 caracteres)');
  }
  return k;
}

/** Cifra una cadena de texto a Buffer (bytea de Postgres). Retorna null si input es vacío. */
export async function encryptText(plaintext: string | null | undefined): Promise<Buffer | null> {
  if (plaintext == null || plaintext === '') return null;
  const key = getKey();
  const rows = await prisma.$queryRaw<{ encrypted: Buffer }[]>`
    SELECT pgp_sym_encrypt(${plaintext}::text, ${key}::text) AS encrypted
  `;
  return rows[0]?.encrypted ?? null;
}

/** Descifra un Buffer (bytea) a texto. Retorna null si entrada es null. */
export async function decryptText(encrypted: Buffer | Uint8Array | null | undefined): Promise<string | null> {
  if (!encrypted) return null;
  const key = getKey();
  const buf = Buffer.isBuffer(encrypted) ? encrypted : Buffer.from(encrypted);
  const rows = await prisma.$queryRaw<{ plaintext: string }[]>`
    SELECT pgp_sym_decrypt(${buf}::bytea, ${key}::text) AS plaintext
  `;
  return rows[0]?.plaintext ?? null;
}

/** Descifra varios campos de un objeto en paralelo. */
export async function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[],
): Promise<T> {
  const decrypted: Record<string, string | null> = {};
  await Promise.all(
    fields.map(async (f) => {
      decrypted[f as string] = await decryptText(obj[f]);
    }),
  );
  return { ...obj, ...decrypted } as T;
}

/** Cifra varios campos en paralelo. Solo cifra los que tienen valor. */
export async function encryptFields(
  fields: Record<string, string | null | undefined>,
): Promise<Record<string, Buffer | null>> {
  const result: Record<string, Buffer | null> = {};
  await Promise.all(
    Object.entries(fields).map(async ([k, v]) => {
      result[k] = await encryptText(v);
    }),
  );
  return result;
}

/**
 * Health check: prueba que pgcrypto está instalado y la clave funciona.
 * Llamar al boot del servidor — falla rápido si está mal configurado.
 */
export async function verifyEncryptionSetup(): Promise<void> {
  try {
    const encrypted = await encryptText('surco-health-encryption-check');
    if (!encrypted) throw new Error('encryptText devolvió null');
    const decrypted = await decryptText(encrypted);
    if (decrypted !== 'surco-health-encryption-check') {
      throw new Error('Roundtrip fallido (texto descifrado no coincide)');
    }
  } catch (err) {
    throw new Error(
      `❌ Encryption setup failed: ${(err as Error).message}. ` +
        `Verifica que (1) pgcrypto esté en CREATE EXTENSION, (2) ENCRYPTION_KEY esté configurada.`,
    );
  }
}

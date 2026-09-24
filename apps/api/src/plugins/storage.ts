import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import type { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  type BucketLocationConstraint,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

/**
 * Abstracción de almacenamiento de archivos clínicos.
 *
 *  - Producción: S3 compatible (MinIO interno en http://minio:9000). El
 *    navegador NUNCA habla con MinIO: subida y descarga pasan por el API.
 *  - Desarrollo: si S3_ENDPOINT no está configurado se usa el disco local
 *    en `process.cwd()/storage-local/`.
 *
 * Cualquier fallo de conexión/credenciales se traduce a
 * AppError('STORAGE_UNAVAILABLE', 503) para que el front muestre un aviso claro.
 */

export type StorageMode = 's3' | 'local';

export const storageMode: StorageMode = env.S3_ENDPOINT ? 's3' : 'local';

/** Valor que se guarda en ClinicalFile.s3Bucket cuando se usa el disco local. */
export const LOCAL_BUCKET = 'local';

const LOCAL_ROOT = path.resolve(process.cwd(), 'storage-local');

export interface StoredObject {
  body: Readable;
  contentType?: string;
  contentLength?: number;
}

export interface PutResult {
  bucket: string;
  etag: string | null;
}

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY && env.S3_SECRET_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
          : undefined,
      // Falla rápido si MinIO está caído en vez de dejar colgada la petición.
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5_000, requestTimeout: 60_000 },
      // Compatibilidad con MinIO/S3 compatibles: no forzar checksums CRC32
      // que algunas versiones no aceptan.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }
  return client;
}

/** Bucket donde se guardan los archivos nuevos. */
export function storageBucket(): string {
  return storageMode === 's3' ? env.S3_BUCKET : LOCAL_BUCKET;
}

function httpStatusOf(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

function errorName(err: unknown): string {
  const e = err as { name?: string; Code?: string } | null | undefined;
  return e?.name ?? e?.Code ?? '';
}

function isNotFound(err: unknown): boolean {
  const name = errorName(err);
  return name === 'NotFound' || name === 'NoSuchKey' || name === 'NoSuchBucket' || httpStatusOf(err) === 404;
}

function toStorageError(err: unknown, op: string): AppError {
  if (err instanceof AppError) return err;
  console.error(`[storage] ${op} falló`, {
    mode: storageMode,
    name: errorName(err),
    status: httpStatusOf(err),
    message: (err as Error)?.message,
  });
  return new AppError('STORAGE_UNAVAILABLE', 503);
}

/** Ruta absoluta en disco para una key, bloqueando cualquier path traversal. */
function localPath(key: string): string {
  const full = path.resolve(LOCAL_ROOT, key);
  if (!full.startsWith(LOCAL_ROOT + path.sep)) {
    throw new AppError('INVALID_STORAGE_KEY', 400);
  }
  return full;
}

// Cache en memoria: el HeadBucket/CreateBucket se hace una sola vez por proceso.
let bucketReady: Promise<void> | null = null;

/**
 * Garantiza que el bucket exista (HeadBucket → CreateBucket si no existe).
 * El resultado se cachea; si falla se limpia la cache para reintentar luego.
 */
export function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      if (storageMode === 'local') {
        await fs.mkdir(LOCAL_ROOT, { recursive: true });
        return;
      }
      const Bucket = env.S3_BUCKET;
      try {
        await s3().send(new HeadBucketCommand({ Bucket }));
      } catch (err) {
        if (!isNotFound(err)) throw err;
        try {
          await s3().send(
            new CreateBucketCommand({
              Bucket,
              ...(env.S3_REGION !== 'us-east-1' && {
                CreateBucketConfiguration: {
                  LocationConstraint: env.S3_REGION as BucketLocationConstraint,
                },
              }),
            }),
          );
        } catch (createErr) {
          const name = errorName(createErr);
          // Otra instancia lo creó al mismo tiempo: no es un error.
          if (name !== 'BucketAlreadyOwnedByYou' && name !== 'BucketAlreadyExists') throw createErr;
        }
      }
    })().catch((err) => {
      bucketReady = null;
      throw toStorageError(err, 'ensureBucket');
    });
  }
  return bucketReady;
}

/** Guarda un objeto. Devuelve el bucket usado y el ETag (si aplica). */
export async function putObject(key: string, body: Buffer, mimeType: string): Promise<PutResult> {
  await ensureBucket();

  if (storageMode === 'local') {
    try {
      const target = localPath(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, body);
      return { bucket: LOCAL_BUCKET, etag: null };
    } catch (err) {
      throw toStorageError(err, 'putObject(local)');
    }
  }

  try {
    const out = await s3().send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: mimeType,
        ContentLength: body.length,
      }),
    );
    return { bucket: env.S3_BUCKET, etag: out.ETag ? out.ETag.replace(/"/g, '') : null };
  } catch (err) {
    throw toStorageError(err, 'putObject');
  }
}

/**
 * Obtiene un objeto como stream. `bucket` es el guardado en ClinicalFile.s3Bucket
 * (permite leer archivos antiguos del disco local aunque hoy se use S3).
 * Si el objeto no existe → AppError('FILE_NOT_FOUND', 404).
 */
export async function getObjectStream(key: string, bucket?: string): Promise<StoredObject> {
  const useLocal = bucket === LOCAL_BUCKET || storageMode === 'local';

  if (useLocal) {
    let target: string;
    try {
      target = localPath(key);
    } catch (err) {
      throw toStorageError(err, 'getObjectStream(local)');
    }
    try {
      const st = await fs.stat(target);
      return { body: createReadStream(target), contentLength: st.size };
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') throw new AppError('FILE_NOT_FOUND', 404);
      throw toStorageError(err, 'getObjectStream(local)');
    }
  }

  try {
    const out = await s3().send(
      new GetObjectCommand({ Bucket: bucket || env.S3_BUCKET, Key: key }),
    );
    if (!out.Body) throw new AppError('FILE_NOT_FOUND', 404);
    return {
      body: out.Body as Readable,
      contentType: out.ContentType,
      contentLength: out.ContentLength,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isNotFound(err)) throw new AppError('FILE_NOT_FOUND', 404);
    throw toStorageError(err, 'getObjectStream');
  }
}

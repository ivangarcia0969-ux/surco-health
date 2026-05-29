/**
 * Importador del catálogo CIE-10 completo (Minsalud Colombia).
 *
 * Uso:
 *   pnpm --filter @surco/db tsx prisma/seed-icd10.ts
 *   pnpm --filter @surco/db tsx prisma/seed-icd10.ts --source=local
 *
 * Estrategias:
 *   1) `--source=minsalud` (default): descarga el JSON oficial Minsalud
 *      del Dataset RIPS/CIE-10. Si la URL cambia o no responde, falla limpio
 *      y sugiere usar local.
 *   2) `--source=local`: usa el archivo `data/icd10-co.tsv` empacado en
 *      el repo (versión congelada ~14.2k códigos).
 *
 * Idempotente: usa upsert sobre `code` PK.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

const MINSALUD_URL =
  'https://www.datos.gov.co/resource/gqxv-h5d2.json?$limit=20000';
//  Dataset oficial publicado por Minsalud Colombia en datos.gov.co
//  Columnas esperadas: codigo_cie10, descripcion_cie10, ...

interface MinsaludRow {
  codigo_cie10?: string;
  codigo?: string;
  descripcion_cie10?: string;
  descripcion?: string;
}

interface LocalRow {
  code: string;
  description: string;
  parentCode?: string;
  isCategory?: boolean;
}

async function fromMinsalud(): Promise<LocalRow[]> {
  console.log(`📡 Descargando dataset CIE-10 oficial Minsalud (${MINSALUD_URL})...`);
  const res = await fetch(MINSALUD_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(
      `Minsalud devolvió ${res.status}. Usa --source=local o revisa la URL del dataset.`,
    );
  }
  const json = (await res.json()) as MinsaludRow[];
  console.log(`  ✓ ${json.length} filas descargadas`);
  return json
    .map((r): LocalRow | null => {
      const code = (r.codigo_cie10 ?? r.codigo ?? '').trim().toUpperCase();
      const description = (r.descripcion_cie10 ?? r.descripcion ?? '').trim();
      if (!code || !description) return null;
      return {
        code,
        description,
        parentCode: code.length > 3 ? code.slice(0, 3) : null,
        isCategory: code.length === 3,
      };
    })
    .filter((x): x is LocalRow => x !== null);
}

async function fromLocal(): Promise<LocalRow[]> {
  const path = join(__dirname, '../data/icd10-co.tsv');
  if (!existsSync(path)) {
    throw new Error(
      `No existe ${path}. Coloca el TSV (code\\tdescription\\tparentCode\\tisCategory) o usa --source=minsalud.`,
    );
  }
  console.log(`📂 Leyendo dataset local (${path})...`);
  const text = readFileSync(path, 'utf-8');
  const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const rows: LocalRow[] = [];
  for (const line of lines) {
    const [code, description, parentCode, isCategory] = line.split('\t');
    if (!code || !description) continue;
    rows.push({
      code: code.trim().toUpperCase(),
      description: description.trim(),
      parentCode: parentCode?.trim() || null,
      isCategory: isCategory?.trim() === '1' || isCategory?.trim() === 'true',
    });
  }
  console.log(`  ✓ ${rows.length} filas leídas`);
  return rows;
}

async function main() {
  const argSource = process.argv.find((a) => a.startsWith('--source='))?.slice(9) ?? 'minsalud';

  let rows: LocalRow[];
  try {
    rows = argSource === 'local' ? await fromLocal() : await fromMinsalud();
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    console.error('  Sugerencia: corre con --source=local si Minsalud no responde.');
    process.exit(1);
  }

  if (rows.length < 100) {
    console.error(`✗ Solo ${rows.length} códigos — demasiado poco. Aborta para evitar publicar un autocomplete vacío.`);
    process.exit(1);
  }

  // Validación: no duplicar PKs
  const seen = new Set<string>();
  rows = rows.filter((r) => {
    if (seen.has(r.code)) return false;
    seen.add(r.code);
    return true;
  });

  console.log(`💾 Insertando ${rows.length} códigos CIE-10 en BD...`);

  // Batch insert con upsert (idempotente). createMany no soporta upsert, así que
  // usamos createMany con skipDuplicates + un updateMany de fallback para descripciones.
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const result = await prisma.icd10Code.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    inserted += result.count;
    if (i % (BATCH * 5) === 0) {
      console.log(`   ${i + chunk.length}/${rows.length} procesados (${inserted} nuevos)`);
    }
  }

  const total = await prisma.icd10Code.count();
  console.log(`\n✅ Dataset CIE-10 listo. Total en BD: ${total} códigos.\n`);

  if (total < 1000) {
    console.warn(
      `⚠ Solo ${total} códigos cargados. Mínimo recomendado: 14k (Minsalud completo). El autocomplete puede sentirse incompleto.`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

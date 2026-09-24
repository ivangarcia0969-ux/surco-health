import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Renderiza el formato simple de los consentimientos, construyendo elementos
 * React (sin librerías y sin HTML crudo — nada de dangerouslySetInnerHTML):
 *  - `# Título`, `## Subtítulo`, `### Subtítulo menor` al inicio de línea
 *  - `**negrita**`
 *  - `- viñeta` (o `• viñeta`) y listas numeradas `1. …`
 *  - `---` línea separadora
 *  - párrafos separados por línea en blanco (los saltos simples se respetan)
 */

type Block =
  | { kind: 'h1' | 'h2' | 'h3'; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul' | 'ol'; items: string[] }
  | { kind: 'hr' };

const BULLET_RE = /^\s*(?:[-•]|\*(?!\*))\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+[.)]\s+(.*)$/;

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { kind: 'ul' | 'ol'; items: string[] } | null = null;

  const flushPara = () => { if (para.length) { blocks.push({ kind: 'p', lines: para }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) { flushPara(); flushList(); continue; }

    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flushPara(); flushList();
      const level = heading[1].length as 1 | 2 | 3;
      blocks.push({ kind: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3', text: heading[2] });
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) { flushPara(); flushList(); blocks.push({ kind: 'hr' }); continue; }

    const bullet = BULLET_RE.exec(line);
    const numbered = bullet ? null : NUMBERED_RE.exec(line);
    if (bullet || numbered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list && list.kind !== kind) flushList();
      if (!list) list = { kind, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    // Línea normal: si venía una lista, una línea con sangría continúa el último ítem
    if (list && /^\s{2,}/.test(raw) && list.items.length) {
      list.items[list.items.length - 1] += ` ${trimmed}`;
      continue;
    }
    flushList();
    para.push(trimmed);
  }
  flushPara(); flushList();
  return blocks;
}

/** `**negrita**` → <strong>. Los asteriscos sueltos se muestran tal cual. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<strong key={i++} className="font-semibold text-gray-900">{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface ConsentBodyProps {
  text: string;
  /** `sm` para papel/PDF (letra más compacta). */
  size?: 'md' | 'sm';
  className?: string;
}

export function ConsentBody({ text, size = 'md', className }: ConsentBodyProps) {
  const blocks = parse(text ?? '');
  const sm = size === 'sm';

  return (
    <div
      className={cn(
        'text-gray-700 print:text-gray-900',
        sm ? 'text-[12.5px] leading-relaxed' : 'text-[15px] leading-7',
        className,
      )}
    >
      {blocks.map((b, idx) => {
        const first = idx === 0;
        switch (b.kind) {
          case 'h1':
            return (
              <h2 key={idx} className={cn('font-bold text-gray-900', sm ? 'text-base' : 'text-lg', !first && 'mt-6', 'mb-2')}>
                {inline(b.text)}
              </h2>
            );
          case 'h2':
            return (
              <h3
                key={idx}
                className={cn(
                  'flex items-center gap-2 break-after-avoid font-bold uppercase tracking-wide text-brand-700 print:text-gray-900',
                  sm ? 'text-[11.5px]' : 'text-[13px]',
                  first ? 'mb-2' : sm ? 'mb-1.5 mt-4' : 'mb-2 mt-7',
                )}
              >
                <span aria-hidden className="h-3.5 w-1 shrink-0 rounded-full bg-brand-500 print:bg-gray-700" />
                {inline(b.text)}
              </h3>
            );
          case 'h3':
            return (
              <h4 key={idx} className={cn('font-semibold text-gray-900', !first && (sm ? 'mt-3' : 'mt-5'), 'mb-1')}>
                {inline(b.text)}
              </h4>
            );
          case 'hr':
            return <hr key={idx} className={cn('border-gray-200', sm ? 'my-3' : 'my-5')} />;
          case 'ul':
            return (
              <ul key={idx} className={cn('space-y-1.5', sm ? 'my-1.5 space-y-0.5' : 'my-3')}>
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span aria-hidden className={cn('shrink-0 rounded-full bg-brand-500 print:bg-gray-700', sm ? 'mt-[0.55em] h-1 w-1' : 'mt-[0.7em] h-1.5 w-1.5')} />
                    <span className="min-w-0 flex-1">{inline(it)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className={cn('space-y-1.5', sm ? 'my-1.5 space-y-0.5' : 'my-3')}>
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-2.5">
                    <span className="shrink-0 font-semibold tabular-nums text-brand-700 print:text-gray-900">{j + 1}.</span>
                    <span className="min-w-0 flex-1">{inline(it)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'p':
            return (
              <p key={idx} className={cn(!first && (sm ? 'mt-2' : 'mt-3'))}>
                {b.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(l)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

/** Texto plano sin marcas ni merge tags (para resúmenes cortos en tarjetas). */
export function consentPlainText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/^#{1,3}\s+/, '').replace(/^\s*[-•]\s+/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\{\{[^}]*\}\}/g, '…')
    .replace(/\s+/g, ' ')
    .trim();
}

const TEMPLATE_META: { match: RegExp; icon: string; summary: string }[] = [
  { match: /habeas|datos personales/i, icon: '🔒', summary: 'Autorización de tratamiento de datos personales y de salud (Ley 1581 de 2012).' },
  { match: /exodoncia|extracci/i, icon: '🩹', summary: 'Extracción dental simple o quirúrgica, incluidas las cordales.' },
  { match: /endodoncia|conductos/i, icon: '🔬', summary: 'Tratamiento de conductos para conservar el diente natural.' },
  { match: /implante/i, icon: '🔩', summary: 'Cirugía de implante, oseointegración y rehabilitación protésica.' },
  { match: /blanqueamiento/i, icon: '✨', summary: 'Aclaramiento dental en consultorio o en casa con férulas.' },
  { match: /ortodoncia/i, icon: '😁', summary: 'Brackets, aparatos o alineadores y fase de retención.' },
  { match: /m[eé]dic/i, icon: '🩺', summary: 'Entrevista clínica, examen físico, fórmula y órdenes médicas.' },
  { match: /odontol/i, icon: '🦷', summary: 'Valoración, radiografías, limpieza, resinas y anestesia local.' },
];

/** Ícono y resumen corto de una plantilla (para tarjetas y listas). */
export function consentTemplateMeta(name: string, body?: string): { icon: string; summary: string } {
  const hit = TEMPLATE_META.find((t) => t.match.test(name));
  if (hit) return { icon: hit.icon, summary: hit.summary };
  let summary = '';
  if (body) {
    // Primer contenido después del primer subtítulo (evita el encabezado con merge tags)
    const afterHeading = body.split(/\n#{1,3}\s+[^\n]*\n/)[1] ?? body;
    summary = consentPlainText(afterHeading).slice(0, 120);
    if (summary.length === 120) summary = `${summary.trimEnd()}…`;
  }
  return { icon: '📄', summary };
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Icd10Code {
  code: string;
  description: string;
}

interface DiagnosisItem {
  icd10Code: string;
  description?: string;
  isPrimary: boolean;
  type: 'PRESUMPTIVE' | 'CONFIRMED' | 'DIFFERENTIAL' | 'RULE_OUT';
}

interface Props {
  value: DiagnosisItem[];
  onChange: (v: DiagnosisItem[]) => void;
}

const TYPE_LABEL: Record<DiagnosisItem['type'], string> = {
  PRESUMPTIVE: 'Presuntivo',
  CONFIRMED: 'Confirmado',
  DIFFERENTIAL: 'Diferencial',
  RULE_OUT: 'A descartar',
};

export function Cie10Search({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Icd10Code[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await apiFetch<Icd10Code[]>(`/api/medical/icd10/search?q=${encodeURIComponent(query)}&limit=10`);
        setResults(r);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function addDiagnosis(code: Icd10Code) {
    if (value.some((d) => d.icd10Code === code.code)) return; // ya está
    const isPrimary = value.length === 0; // primer dx = primario
    onChange([
      ...value,
      {
        icd10Code: code.code,
        description: code.description,
        isPrimary,
        type: 'CONFIRMED',
      },
    ]);
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  }

  function removeDiagnosis(code: string) {
    const next = value.filter((d) => d.icd10Code !== code);
    // si quitamos el primario y quedan otros, marca el primero como primario
    if (next.length > 0 && !next.some((d) => d.isPrimary)) {
      next[0].isPrimary = true;
    }
    onChange(next);
  }

  function setPrimary(code: string) {
    onChange(
      value.map((d) => ({ ...d, isPrimary: d.icd10Code === code })),
    );
  }

  function setType(code: string, type: DiagnosisItem['type']) {
    onChange(
      value.map((d) => (d.icd10Code === code ? { ...d, type } : d)),
    );
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        Diagnósticos (CIE-10)
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder="Busca por código (Z00.0) o descripción (rinofaringitis)…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        {open && (query.length > 0 || results.length > 0) && (
          <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {loading ? (
              <div className="p-3 text-sm text-gray-500">Buscando…</div>
            ) : results.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">Sin resultados.</div>
            ) : (
              <ul>
                {results.map((r) => (
                  <li key={r.code}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addDiagnosis(r)}
                      className="flex w-full items-baseline gap-3 px-3 py-2 text-left text-sm hover:bg-brand-50"
                    >
                      <span className="font-mono font-semibold text-brand-700">{r.code}</span>
                      <span className="text-gray-700">{r.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {value.length > 0 && (
        <ul className="mt-3 space-y-2">
          {value.map((d) => (
            <li key={d.icd10Code} className={cn(
              'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              d.isPrimary ? 'border-brand-300 bg-brand-50' : 'border-gray-200 bg-white',
            )}>
              <span className="font-mono font-semibold text-brand-700">{d.icd10Code}</span>
              <span className="flex-1 truncate text-gray-700">{d.description}</span>

              <select
                value={d.type}
                onChange={(e) => setType(d.icd10Code, e.target.value as any)}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs"
                aria-label="Tipo de diagnóstico"
              >
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {d.isPrimary ? (
                <span className="rounded-full bg-brand-200 px-2 py-0.5 text-xs font-medium text-brand-800">
                  PRIMARIO
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPrimary(d.icd10Code)}
                  className="rounded px-2 py-0.5 text-xs text-brand-600 hover:bg-brand-100"
                >
                  Marcar primario
                </button>
              )}

              <button
                type="button"
                onClick={() => removeDiagnosis(d.icd10Code)}
                className="text-red-500 hover:text-red-700"
                aria-label="Quitar"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type { DiagnosisItem };

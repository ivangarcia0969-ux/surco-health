'use client';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Odontograma interactivo — notación FDI (estándar ISO 3950, más usado en LATAM)
 *
 * Numeración FDI:
 *   Cuadrantes (superior derecha / superior izquierda / inferior izquierda / inferior derecha):
 *     11-18, 21-28, 31-38, 41-48 (adultos)
 *
 * Cada diente tiene 5 superficies clínicas que se pueden marcar:
 *   - O (Oclusal / Incisal): cara superior masticatoria
 *   - V (Vestibular): cara hacia el labio/mejilla
 *   - L/P (Lingual/Palatal): cara hacia la lengua/paladar
 *   - M (Mesial): cara hacia la línea media
 *   - D (Distal): cara opuesta a la línea media
 *
 * Cada superficie se renderiza como un triángulo o cuadrado dentro del diente.
 */

type Condition =
  | 'HEALTHY'
  | 'CARIES'
  | 'FILLING_AMALGAM'
  | 'FILLING_RESIN'
  | 'FILLING_TEMP'
  | 'CROWN'
  | 'IMPLANT'
  | 'EXTRACTION_NEEDED'
  | 'EXTRACTED'
  | 'ROOT_CANAL'
  | 'BRIDGE'
  | 'SEALANT'
  | 'FRACTURE'
  | 'MOBILITY'
  | 'ABSENT';

type Surface = 'occlusal' | 'vestibular' | 'lingual' | 'mesial' | 'distal';

type ToothState = Partial<Record<Surface | 'whole', Condition>>;
type ChartState = Record<string, ToothState>;

// Color por condición — visualización inmediata
const CONDITION_COLOR: Record<Condition, string> = {
  HEALTHY: '#ffffff',
  CARIES: '#ef4444',
  FILLING_AMALGAM: '#1f2937',
  FILLING_RESIN: '#3b82f6',
  FILLING_TEMP: '#a3a3a3',
  CROWN: '#f59e0b',
  IMPLANT: '#8b5cf6',
  EXTRACTION_NEEDED: '#dc2626',
  EXTRACTED: '#000000',
  ROOT_CANAL: '#ec4899',
  BRIDGE: '#0891b2',
  SEALANT: '#10b981',
  FRACTURE: '#fbbf24',
  MOBILITY: '#f97316',
  ABSENT: '#9ca3af',
};

const CONDITION_LABEL: Record<Condition, string> = {
  HEALTHY: 'Sano',
  CARIES: 'Caries',
  FILLING_AMALGAM: 'Obturación amalgama',
  FILLING_RESIN: 'Obturación resina',
  FILLING_TEMP: 'Obturación temporal',
  CROWN: 'Corona',
  IMPLANT: 'Implante',
  EXTRACTION_NEEDED: 'Extracción necesaria',
  EXTRACTED: 'Extraído',
  ROOT_CANAL: 'Endodoncia',
  BRIDGE: 'Puente',
  SEALANT: 'Sellante',
  FRACTURE: 'Fractura',
  MOBILITY: 'Movilidad',
  ABSENT: 'Ausente',
};

// Cuadrantes según FDI — orden visual de izquierda a derecha del observador
const UPPER_RIGHT = ['18', '17', '16', '15', '14', '13', '12', '11'];
const UPPER_LEFT = ['21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER_LEFT = ['31', '32', '33', '34', '35', '36', '37', '38'];
const LOWER_RIGHT = ['48', '47', '46', '45', '44', '43', '42', '41'];

interface OdontogramProps {
  state: ChartState;
  onChange: (state: ChartState) => void;
  selectedCondition: Condition;
  readOnly?: boolean;
}

export function Odontogram({ state, onChange, selectedCondition, readOnly }: OdontogramProps) {
  const setSurface = (tooth: string, surface: Surface | 'whole') => {
    if (readOnly) return;
    const next = { ...state };
    const current = next[tooth] ?? {};
    // Si se marca whole con EXTRACTED/ABSENT/IMPLANT, sustituye toda la pieza
    if (surface === 'whole' || ['EXTRACTED', 'ABSENT', 'IMPLANT', 'CROWN'].includes(selectedCondition)) {
      next[tooth] = { whole: selectedCondition };
    } else {
      // Si ya tenía un whole y vamos a marcar superficie, removemos el whole
      const { whole, ...others } = current;
      next[tooth] = { ...others, [surface]: selectedCondition };
    }
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {/* Maxilar superior */}
      <div>
        <p className="mb-1 text-center text-xs font-medium text-gray-500">Maxilar superior</p>
        <div className="flex justify-center gap-2 overflow-x-auto">
          <div className="flex gap-1">{UPPER_RIGHT.map((n) => <Tooth key={n} num={n} state={state[n]} onSurface={setSurface} upper />)}</div>
          <div className="mx-2 border-l border-gray-300" />
          <div className="flex gap-1">{UPPER_LEFT.map((n) => <Tooth key={n} num={n} state={state[n]} onSurface={setSurface} upper />)}</div>
        </div>
      </div>

      {/* Maxilar inferior */}
      <div>
        <div className="flex justify-center gap-2 overflow-x-auto">
          <div className="flex gap-1">{LOWER_RIGHT.map((n) => <Tooth key={n} num={n} state={state[n]} onSurface={setSurface} />)}</div>
          <div className="mx-2 border-l border-gray-300" />
          <div className="flex gap-1">{LOWER_LEFT.map((n) => <Tooth key={n} num={n} state={state[n]} onSurface={setSurface} />)}</div>
        </div>
        <p className="mt-1 text-center text-xs font-medium text-gray-500">Maxilar inferior</p>
      </div>
    </div>
  );
}

function Tooth({
  num, state = {}, onSurface, upper,
}: {
  num: string;
  state?: ToothState;
  onSurface: (tooth: string, surface: Surface | 'whole') => void;
  upper?: boolean;
}) {
  // Si tiene whole, pintamos el diente entero
  const wholeCondition = state.whole;
  const isExtracted = wholeCondition === 'EXTRACTED' || wholeCondition === 'ABSENT';

  return (
    <div className="flex w-[40px] flex-col items-center">
      <div className={cn('mb-0.5 text-[10px] font-mono text-gray-500', !upper && 'order-2')}>{num}</div>

      <svg viewBox="0 0 40 40" className="h-10 w-10">
        {wholeCondition ? (
          // Diente completo con una sola condición
          <g>
            <rect x="2" y="2" width="36" height="36" rx="6"
                  fill={CONDITION_COLOR[wholeCondition]}
                  stroke="#374151" strokeWidth="0.8"
                  onClick={() => onSurface(num, 'whole')}
                  className="cursor-pointer hover:opacity-80" />
            {isExtracted && (
              <>
                <line x1="4" y1="4" x2="36" y2="36" stroke="#fff" strokeWidth="3" />
                <line x1="36" y1="4" x2="4" y2="36" stroke="#fff" strokeWidth="3" />
              </>
            )}
          </g>
        ) : (
          // 5 superficies: occlusal centro, los 4 lados como trapecios
          <g>
            {/* Outer frame */}
            <rect x="2" y="2" width="36" height="36" rx="4" fill="#fff" stroke="#374151" strokeWidth="0.8" />
            {/* Top - Vestibular (cara externa) */}
            <polygon points="2,2 38,2 28,12 12,12"
                     fill={state.vestibular ? CONDITION_COLOR[state.vestibular] : '#fff'}
                     stroke="#9ca3af" strokeWidth="0.5"
                     onClick={() => onSurface(num, 'vestibular')}
                     className="cursor-pointer hover:opacity-70" />
            {/* Bottom - Lingual */}
            <polygon points="12,28 28,28 38,38 2,38"
                     fill={state.lingual ? CONDITION_COLOR[state.lingual] : '#fff'}
                     stroke="#9ca3af" strokeWidth="0.5"
                     onClick={() => onSurface(num, 'lingual')}
                     className="cursor-pointer hover:opacity-70" />
            {/* Left - Mesial (o Distal según cuadrante, simplificamos) */}
            <polygon points="2,2 12,12 12,28 2,38"
                     fill={state.mesial ? CONDITION_COLOR[state.mesial] : '#fff'}
                     stroke="#9ca3af" strokeWidth="0.5"
                     onClick={() => onSurface(num, 'mesial')}
                     className="cursor-pointer hover:opacity-70" />
            {/* Right - Distal */}
            <polygon points="28,12 38,2 38,38 28,28"
                     fill={state.distal ? CONDITION_COLOR[state.distal] : '#fff'}
                     stroke="#9ca3af" strokeWidth="0.5"
                     onClick={() => onSurface(num, 'distal')}
                     className="cursor-pointer hover:opacity-70" />
            {/* Center - Occlusal */}
            <rect x="12" y="12" width="16" height="16"
                  fill={state.occlusal ? CONDITION_COLOR[state.occlusal] : '#fff'}
                  stroke="#9ca3af" strokeWidth="0.5"
                  onClick={() => onSurface(num, 'occlusal')}
                  className="cursor-pointer hover:opacity-70" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** Paleta de condiciones para seleccionar */
export function ConditionPalette({
  selected, onSelect,
}: { selected: Condition; onSelect: (c: Condition) => void }) {
  const conditions = useMemo(() => Object.keys(CONDITION_COLOR) as Condition[], []);
  return (
    <div className="flex flex-wrap gap-2">
      {conditions.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onSelect(c)}
          className={cn(
            'flex items-center gap-2 rounded-lg border px-2 py-1 text-xs transition',
            selected === c ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-gray-300 hover:bg-gray-50',
          )}
        >
          <span className="h-3 w-3 rounded border border-gray-400" style={{ background: CONDITION_COLOR[c] }} />
          {CONDITION_LABEL[c]}
        </button>
      ))}
    </div>
  );
}

export type { Condition, ChartState };

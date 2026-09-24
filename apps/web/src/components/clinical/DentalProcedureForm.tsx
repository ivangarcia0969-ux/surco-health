'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { cn, formatCop } from '@/lib/utils';

/** Tipos de trabajo odontológico → condición que queda en el odontograma. */
export const DENTAL_WORK: { condition: string; label: string; icon: string; wholeTooth: boolean }[] = [
  { condition: 'FILLING_RESIN', label: 'Resina (obturación)', icon: '🔵', wholeTooth: false },
  { condition: 'FILLING_AMALGAM', label: 'Amalgama', icon: '⚫', wholeTooth: false },
  { condition: 'ROOT_CANAL', label: 'Endodoncia', icon: '🩷', wholeTooth: true },
  { condition: 'EXTRACTED', label: 'Exodoncia (extracción)', icon: '✖️', wholeTooth: true },
  { condition: 'CROWN', label: 'Corona', icon: '👑', wholeTooth: true },
  { condition: 'IMPLANT', label: 'Implante', icon: '🔩', wholeTooth: true },
  { condition: 'BRIDGE', label: 'Puente', icon: '🌉', wholeTooth: true },
  { condition: 'SEALANT', label: 'Sellante', icon: '🟢', wholeTooth: false },
  { condition: 'FILLING_TEMP', label: 'Obturación temporal', icon: '⚪', wholeTooth: false },
  { condition: 'HEALTHY', label: 'Profilaxis / limpieza', icon: '✨', wholeTooth: true },
];

const SURFACES: { key: string; short: string; label: string }[] = [
  { key: 'OCCLUSAL', short: 'O', label: 'Oclusal' },
  { key: 'MESIAL', short: 'M', label: 'Mesial' },
  { key: 'DISTAL', short: 'D', label: 'Distal' },
  { key: 'VESTIBULAR', short: 'V', label: 'Vestibular' },
  { key: 'LINGUAL', short: 'L/P', label: 'Lingual / Palatino' },
];

const UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];

interface Service { id: string; name: string; priceParticular: string | number; specialty: string | null }

interface Row {
  key: number;
  toothNumber: string;
  surfaces: string[];
  condition: string;
  treatment: string;
  cost: string;
  done: boolean;
}

let rowSeq = 0;
function emptyRow(tooth = ''): Row {
  return { key: ++rowSeq, toothNumber: tooth, surfaces: [], condition: 'FILLING_RESIN', treatment: '', cost: '', done: false };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  patientId: string;
  appointmentId?: string;
  /** Diente preseleccionado (p.ej. desde el odontograma). */
  initialTooth?: string;
}

/**
 * Agregar procedimientos al plan de tratamiento dental. Cada fila = un diente
 * con el trabajo a realizar, superficies y costo (autocompletado desde el
 * catálogo). Crea un ClinicalRecord DENTAL_TREATMENT y actualiza el odontograma.
 */
export function DentalProcedureForm({ open, onClose, onCreated, patientId, appointmentId, initialTooth }: Props) {
  const [rows, setRows] = useState<Row[]>([emptyRow(initialTooth)]);
  const [activeRow, setActiveRow] = useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState('');
  const [applyToChart, setApplyToChart] = useState(true);
  const [signNow, setSignNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows([emptyRow(initialTooth)]);
    setActiveRow(0);
    setNotes('');
    apiFetch<Service[]>('/api/catalog/services?specialty=DENTAL')
      .then(setServices)
      .catch(() => setServices([]));
  }, [open, initialTooth]);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.cost) || 0), 0), [rows]);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function pickService(i: number, serviceId: string) {
    const s = services.find((x) => x.id === serviceId);
    if (!s) return;
    const name = s.name.toLowerCase();
    // Sugerir el tipo de trabajo según el nombre del servicio del catálogo
    const guess =
      name.includes('endodon') ? 'ROOT_CANAL'
        : name.includes('extrac') || name.includes('exodon') ? 'EXTRACTED'
        : name.includes('corona') ? 'CORONA'
        : name.includes('implant') ? 'IMPLANT'
        : name.includes('sellant') ? 'SEALANT'
        : name.includes('amalgam') ? 'FILLING_AMALGAM'
        : name.includes('limpieza') || name.includes('profilax') || name.includes('detartraje') ? 'HEALTHY'
        : name.includes('resina') ? 'FILLING_RESIN'
        : null;
    update(i, {
      treatment: s.name,
      cost: String(Number(s.priceParticular)),
      ...(guess === 'CORONA' ? { condition: 'CROWN' } : guess ? { condition: guess } : {}),
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Profilaxis/limpieza puede ir sin diente: se registra como "GEN" (boca completa)
    const clean = rows
      .filter((r) => r.toothNumber.trim() || r.condition === 'HEALTHY')
      .map((r) => (r.toothNumber.trim() ? r : { ...r, toothNumber: 'GEN' }));
    if (clean.length === 0) {
      toast.error('Indica al menos un diente (puedes tocarlo en el esquema).');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/dental/treatments', {
        method: 'POST',
        body: {
          patientId,
          appointmentId,
          notes: notes.trim() || undefined,
          applyToChart,
          signNow,
          procedures: clean.map((r) => {
            const work = DENTAL_WORK.find((w) => w.condition === r.condition);
            return {
              toothNumber: r.toothNumber.trim(),
              surfaces: work?.wholeTooth ? [] : r.surfaces,
              condition: r.condition,
              treatment: r.treatment.trim() || work?.label,
              cost: r.cost ? Number(r.cost) : undefined,
              status: r.done ? 'COMPLETED' : 'PLANNED',
            };
          }),
        },
      });
      toast.success(`${clean.length} procedimiento${clean.length === 1 ? '' : 's'} agregado${clean.length === 1 ? '' : 's'} al plan`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible guardar los procedimientos.'));
    } finally {
      setSubmitting(false);
    }
  }

  const current = rows[activeRow];

  return (
    <Modal open={open} onClose={onClose} title="Agregar procedimientos al plan" size="xl">
      <form onSubmit={onSubmit} className="max-h-[78vh] space-y-4 overflow-y-auto pr-1">
        {/* Selector visual de dientes (FDI) para la fila activa */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-medium text-gray-600">
            Toca el diente para la fila {activeRow + 1}
            {current?.toothNumber && <span className="ml-1 font-semibold text-brand-700">· seleccionado: {current.toothNumber}</span>}
          </div>
          {[UPPER, LOWER].map((arch, ai) => (
            <div key={ai} className={cn('flex justify-center gap-0.5 overflow-x-auto', ai === 0 && 'mb-1.5')}>
              {arch.map((t, idx) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => update(activeRow, { toothNumber: t })}
                  className={cn(
                    'h-8 w-7 shrink-0 rounded-md border text-[11px] font-semibold transition sm:w-8',
                    idx === 8 && 'ml-2',
                    current?.toothNumber === t
                      ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                      : rows.some((r) => r.toothNumber === t)
                        ? 'border-brand-300 bg-brand-50 text-brand-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {rows.map((r, i) => {
            const work = DENTAL_WORK.find((w) => w.condition === r.condition);
            return (
              <div
                key={r.key}
                onClick={() => setActiveRow(i)}
                className={cn(
                  'rounded-xl border p-3 transition',
                  i === activeRow ? 'border-brand-300 bg-brand-50/40 ring-2 ring-brand-100' : 'border-gray-200 bg-white',
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Procedimiento {i + 1}</span>
                  {rows.length > 1 && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setRows(rows.filter((_, idx) => idx !== i)); setActiveRow(0); }}
                            className="text-xs text-red-500 hover:underline">Quitar</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-12">
                  <label className="col-span-1 md:col-span-2">
                    <span className="mb-1 block text-xs text-gray-600">Diente</span>
                    <input value={r.toothNumber} onChange={(e) => update(i, { toothNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 2) })}
                           placeholder="Ej. 36" inputMode="numeric"
                           className="w-full rounded-lg border border-gray-300 px-2 py-2 text-center font-mono text-sm font-semibold" />
                  </label>
                  <label className="col-span-1 md:col-span-4">
                    <span className="mb-1 block text-xs text-gray-600">Trabajo</span>
                    <select value={r.condition} onChange={(e) => update(i, { condition: e.target.value })}
                            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm">
                      {DENTAL_WORK.map((w) => <option key={w.condition} value={w.condition}>{w.icon} {w.label}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 md:col-span-4">
                    <span className="mb-1 block text-xs text-gray-600">Servicio del catálogo (autocompleta precio)</span>
                    <select value="" onChange={(e) => pickService(i, e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm">
                      <option value="">{r.treatment ? `✓ ${r.treatment}` : '— Elegir servicio —'}</option>
                      {services.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatCop(s.priceParticular)}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 md:col-span-2">
                    <span className="mb-1 block text-xs text-gray-600">Valor (COP)</span>
                    <input value={r.cost} onChange={(e) => update(i, { cost: e.target.value.replace(/[^0-9]/g, '') })}
                           inputMode="numeric" placeholder="0"
                           className="w-full rounded-lg border border-gray-300 px-2 py-2 text-right text-sm" />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!work?.wholeTooth && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-gray-500">Superficies:</span>
                      {SURFACES.map((s) => {
                        const on = r.surfaces.includes(s.key);
                        return (
                          <button key={s.key} type="button" title={s.label}
                                  onClick={() => update(i, { surfaces: on ? r.surfaces.filter((x) => x !== s.key) : [...r.surfaces, s.key] })}
                                  className={cn('rounded-md border px-2 py-0.5 text-xs font-semibold',
                                    on ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-gray-600')}>
                            {s.short}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <input value={r.treatment} onChange={(e) => update(i, { treatment: e.target.value })}
                         placeholder="Descripción (opcional)"
                         className="min-w-[160px] flex-1 rounded-lg border border-gray-200 px-2 py-1 text-xs" />
                  <label className="flex items-center gap-1.5 text-xs text-gray-700">
                    <input type="checkbox" checked={r.done} onChange={(e) => update(i, { done: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                    Realizado hoy
                  </label>
                </div>
              </div>
            );
          })}
          <button type="button" onClick={() => { setRows([...rows, emptyRow()]); setActiveRow(rows.length); }}
                  className="w-full rounded-xl border-2 border-dashed border-gray-300 py-2 text-sm font-medium text-gray-600 hover:border-brand-400 hover:text-brand-700">
            + Agregar otro diente
          </button>
        </div>

        <Textarea label="Notas clínicas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Hallazgos, anestesia utilizada, recomendaciones…" />

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={applyToChart} onChange={(e) => setApplyToChart(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Actualizar el odontograma
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={signNow} onChange={(e) => setSignNow(e.target.checked)} className="h-4 w-4 accent-brand-600" />
            Firmar registro clínico
          </label>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-white pt-3">
          <div className="text-sm text-gray-600">
            Total: <span className="text-lg font-bold text-gray-900">{formatCop(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={submitting}>Guardar en el plan</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

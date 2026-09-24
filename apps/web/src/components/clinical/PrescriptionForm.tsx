'use client';
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Se llama con la receta creada (id y número visible). */
  onCreated?: (created: { id: string; number: string }) => void;
  patientId: string;
  /** Resumen de alergias del paciente (Patient.allergiesSummary). */
  allergies?: string | null;
}

interface DraftItem {
  key: number;
  drugName: string;
  presentation: string;
  dose: string;
  frequency: string;
  durationDays: string;
  quantity: string;
  instructions: string;
}

type Preset = Omit<DraftItem, 'key'> & { label: string; hint: string };

/** Atajos rápidos de odontología: agregan una fila prellenada y editable. */
const DENTAL_PRESETS: Preset[] = [
  {
    label: 'Amoxicilina 500 mg', hint: 'Antibiótico · c/8 h · 7 días',
    drugName: 'Amoxicilina 500 mg', presentation: 'Cápsulas · vía oral', dose: '1 cápsula',
    frequency: 'Cada 8 horas', durationDays: '7', quantity: '21 (veintiún) cápsulas',
    instructions: 'Completar todo el tratamiento aunque desaparezcan los síntomas.',
  },
  {
    label: 'Ibuprofeno 400 mg', hint: 'Analgésico / AINE · c/8 h · 3 días',
    drugName: 'Ibuprofeno 400 mg', presentation: 'Tabletas · vía oral', dose: '1 tableta',
    frequency: 'Cada 8 horas', durationDays: '3', quantity: '9 (nueve) tabletas',
    instructions: 'Tomar después de las comidas.',
  },
  {
    label: 'Acetaminofén 500 mg', hint: 'Analgésico · c/6 h si dolor',
    drugName: 'Acetaminofén 500 mg', presentation: 'Tabletas · vía oral', dose: '1 tableta',
    frequency: 'Cada 6 horas si hay dolor', durationDays: '3', quantity: '12 (doce) tabletas',
    instructions: 'No exceder 4 tabletas de 1 g (8 de 500 mg) al día.',
  },
  {
    label: 'Naproxeno 250 mg', hint: 'AINE · c/12 h · 3 días',
    drugName: 'Naproxeno 250 mg', presentation: 'Tabletas · vía oral', dose: '1 tableta',
    frequency: 'Cada 12 horas', durationDays: '3', quantity: '6 (seis) tabletas',
    instructions: 'Tomar con alimentos.',
  },
  {
    label: 'Clindamicina 300 mg', hint: 'Alérgicos a penicilina · c/8 h · 7 días',
    drugName: 'Clindamicina 300 mg', presentation: 'Cápsulas · vía oral', dose: '1 cápsula',
    frequency: 'Cada 8 horas', durationDays: '7', quantity: '21 (veintiún) cápsulas',
    instructions: 'Alternativa en pacientes alérgicos a la penicilina. Tomar con un vaso de agua y completar el tratamiento.',
  },
  {
    label: 'Metronidazol 500 mg', hint: 'Antibiótico · c/8 h · 7 días',
    drugName: 'Metronidazol 500 mg', presentation: 'Tabletas · vía oral', dose: '1 tableta',
    frequency: 'Cada 8 horas', durationDays: '7', quantity: '21 (veintiún) tabletas',
    instructions: 'No consumir bebidas alcohólicas durante el tratamiento ni 48 horas después.',
  },
  {
    label: 'Clorhexidina 0,12 %', hint: 'Enjuague bucal · c/12 h · 7 días',
    drugName: 'Clorhexidina 0,12 %', presentation: 'Enjuague bucal · uso tópico oral', dose: '15 ml',
    frequency: 'Cada 12 horas', durationDays: '7', quantity: '1 (un) frasco',
    instructions: 'Enjuagar durante 30 segundos y escupir. NO INGERIR. No comer ni beber en los 30 minutos siguientes.',
  },
  {
    label: 'Nimesulida 100 mg', hint: 'AINE · c/12 h · 3 días',
    drugName: 'Nimesulida 100 mg', presentation: 'Tabletas · vía oral', dose: '1 tableta',
    frequency: 'Cada 12 horas', durationDays: '3', quantity: '6 (seis) tabletas',
    instructions: 'Tomar después de las comidas.',
  },
  {
    label: 'Dexametasona 4 mg', hint: 'Dosis única · post quirúrgico',
    drugName: 'Dexametasona 4 mg', presentation: 'Tabletas · vía oral', dose: '1 tableta',
    frequency: 'Dosis única', durationDays: '', quantity: '1 (una) tableta',
    instructions: 'Tomar una sola vez después del procedimiento quirúrgico, con alimentos.',
  },
];

const FREQUENCY_OPTIONS = [
  'Cada 4 horas', 'Cada 6 horas', 'Cada 8 horas', 'Cada 12 horas', 'Cada 24 horas',
  'Cada 6 horas si hay dolor', 'Cada 8 horas si hay dolor', 'Dosis única', 'Antes de dormir',
];

let keySeq = 0;
const emptyItem = (): DraftItem => ({
  key: ++keySeq, drugName: '', presentation: '', dose: '', frequency: '',
  durationDays: '', quantity: '', instructions: '',
});

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const PENICILLINS = ['amoxicilina', 'ampicilina', 'penicilina', 'dicloxacilina', 'oxacilina'];
const NSAIDS = ['ibuprofeno', 'naproxeno', 'nimesulida', 'diclofenaco', 'ketorolaco', 'meloxicam', 'aspirina'];

/** Coincidencia simple entre el medicamento y las alergias registradas. */
function allergyConflict(drugName: string, allergies?: string | null): boolean {
  if (!allergies || !drugName.trim()) return false;
  const a = normalize(allergies);
  if (/^\s*(ninguna|niega|no refiere|sin alergias|no)\s*\.?\s*$/.test(a)) return false;
  const first = normalize(drugName).split(/[\s/,(]+/)[0] ?? '';
  if (first.length >= 4 && a.includes(first)) return true;
  if (PENICILLINS.includes(first) && /penicil|betalact/.test(a)) return true;
  if (NSAIDS.includes(first) && /\baines?\b|antiinflamatori/.test(a)) return true;
  return false;
}

function isBlank(it: DraftItem): boolean {
  return !it.drugName.trim() && !it.dose.trim() && !it.frequency.trim() && !it.presentation.trim() &&
    !it.quantity.trim() && !it.instructions.trim() && !it.durationDays.trim();
}

function itemErrors(it: DraftItem) {
  const days = Number(it.durationDays);
  return {
    drugName: it.drugName.trim().length < 2,
    dose: !it.dose.trim(),
    frequency: !it.frequency.trim(),
    durationDays: !!it.durationDays.trim() && !(Number.isFinite(days) && days >= 1 && days <= 365),
  };
}

export function PrescriptionForm({ open, onClose, onCreated, patientId, allergies }: Props) {
  const [diagnosis, setDiagnosis] = useState('');
  const [items, setItems] = useState<DraftItem[]>(() => [emptyItem()]);
  const [notes, setNotes] = useState('');
  const [signNow, setSignNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  /** Receta recién emitida (muestra la vista de éxito con el botón de imprimir). */
  const [created, setCreated] = useState<{ id: string; number: string } | null>(null);

  const hasAllergies = !!allergies?.trim();

  function reset() {
    setDiagnosis(''); setItems([emptyItem()]); setNotes(''); setSignNow(true);
    setError(null); setShowErrors(false); setCreated(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  /** Esc / clic fuera: si ya hay datos escritos, pide confirmación antes de descartar. */
  function requestClose() {
    if (submitting) return;
    const dirty = !!diagnosis.trim() || !!notes.trim() || items.some((it) => !isBlank(it));
    if (dirty && !created && !window.confirm('¿Descartar esta receta? Se perderán los datos escritos.')) return;
    handleClose();
  }

  function update(key: number, field: keyof Omit<DraftItem, 'key'>, value: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
  }

  function removeItem(key: number) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : [emptyItem()]));
  }

  function addPreset(p: Preset) {
    const next: DraftItem = {
      key: ++keySeq,
      drugName: p.drugName, presentation: p.presentation, dose: p.dose, frequency: p.frequency,
      durationDays: p.durationDays, quantity: p.quantity, instructions: p.instructions,
    };
    setItems((prev) => {
      // Si la única fila está vacía, la reemplaza en vez de dejarla colgando
      const onlyEmpty = prev.length === 1 && isBlank(prev[0]);
      return onlyEmpty ? [next] : [...prev, next];
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const filled = items.filter((it) => !isBlank(it));
    if (filled.length === 0) {
      setShowErrors(true);
      setError('Agrega al menos un medicamento (puedes usar los atajos rápidos).');
      return;
    }
    const invalid = filled.some((it) => Object.values(itemErrors(it)).some(Boolean));
    if (invalid) {
      setShowErrors(true);
      setError('Completa el nombre, la dosis y la frecuencia de cada medicamento.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ id: string; number: string }>('/api/prescriptions', {
        method: 'POST',
        body: {
          patientId,
          diagnosis: diagnosis.trim() || undefined,
          notes: notes.trim() || undefined,
          signNow,
          items: filled.map((it) => ({
            drugName: it.drugName.trim(),
            presentation: it.presentation.trim() || undefined,
            dose: it.dose.trim(),
            frequency: it.frequency.trim(),
            durationDays: it.durationDays.trim() ? Math.round(Number(it.durationDays)) : undefined,
            quantity: it.quantity.trim() || undefined,
            instructions: it.instructions.trim() || undefined,
          })),
        },
      });
      onCreated?.({ id: res.id, number: res.number });

      if (!signNow) {
        toast.success(`Borrador de receta N.º ${res.number} guardado.`);
        handleClose();
        return;
      }

      toast.success(`Receta N.º ${res.number} firmada y emitida.`);
      setCreated({ id: res.id, number: res.number });
    } catch (err) {
      const code = (err as { message?: string })?.message;
      setError(
        code === 'PATIENT_NOT_FOUND' ? 'Paciente no encontrado.'
          : code === 'VALIDATION' ? 'Revisa los campos de la receta.'
            : errorMessage(err, 'No fue posible guardar la receta.'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  // --- Vista de éxito: receta firmada, lista para imprimir / PDF / WhatsApp ---
  // Se navega en la MISMA pestaña (navegación de cliente): la sesión ya está
  // cargada y «← Volver» regresa a la ficha del paciente.
  if (created) {
    return (
      <Modal open={open} onClose={handleClose} title="Receta emitida" size="md">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-3xl ring-8 ring-brand-50/50">
            ✅
          </div>
          <div>
            <p className="text-base font-semibold text-gray-900">Fórmula médica N.º {created.number}</p>
            <p className="mt-1 text-sm text-gray-500">
              Quedó firmada y registrada en la historia clínica. Ábrela para imprimirla, guardarla en PDF o enviarla por WhatsApp.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href={`/imprimir/receta/${created.id}`}
              onClick={handleClose}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
            >
              🖨️ Ver, imprimir o enviar
            </Link>
            <Button variant="secondary" onClick={handleClose}>Cerrar</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={requestClose} title="Nueva receta · Fórmula médica" size="xl">
      <form onSubmit={onSubmit} noValidate>
        <div className="-mr-2 max-h-[68vh] space-y-5 overflow-y-auto pr-2">
          {hasAllergies && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <span className="text-lg leading-none" aria-hidden>⚠️</span>
              <div>
                <p className="font-semibold">Paciente con alergias registradas</p>
                <p className="mt-0.5">{allergies}</p>
              </div>
            </div>
          )}

          <Input
            label="Diagnóstico / impresión diagnóstica"
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            maxLength={300}
            placeholder="Ej: K04.0 Pulpitis irreversible pieza 36 · Post exodoncia de cordal 48"
          />

          {/* ATAJOS */}
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-900">⚡ Atajos odontológicos</h4>
              <span className="text-xs text-gray-500">Un clic agrega el medicamento prellenado; luego puedes ajustarlo.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DENTAL_PRESETS.map((p) => {
                const conflict = allergyConflict(p.drugName, allergies);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => addPreset(p)}
                    title={`${p.dose} · ${p.frequency}${p.durationDays ? ` · ${p.durationDays} días` : ''}`}
                    className={cn(
                      'group flex flex-col items-start rounded-xl border px-3 py-1.5 text-left transition',
                      conflict
                        ? 'border-red-200 bg-red-50 hover:border-red-300'
                        : 'border-brand-200 bg-brand-50 hover:border-brand-500 hover:bg-white',
                    )}
                  >
                    <span className={cn('text-sm font-medium', conflict ? 'text-red-700' : 'text-brand-900')}>
                      {conflict ? '⚠️ ' : '+ '}{p.label}
                    </span>
                    <span className={cn('text-[11px]', conflict ? 'text-red-600' : 'text-brand-700')}>
                      {conflict ? 'Revisar alergias' : p.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* MEDICAMENTOS */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-gray-200 pb-2">
              <h4 className="font-semibold text-gray-900">
                <span className="mr-1 font-serif text-lg italic text-brand-700">Rp/</span> Medicamentos
              </h4>
              <span className="text-xs text-gray-500">{items.filter((it) => !isBlank(it)).length} en la receta</span>
            </div>

            <datalist id="rx-frequency-options">
              {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f} />)}
            </datalist>

            {items.map((it, idx) => {
              const errs = showErrors && !isBlank(it) ? itemErrors(it) : null;
              const conflict = allergyConflict(it.drugName, allergies);
              return (
                <div
                  key={it.key}
                  className={cn(
                    'rounded-xl border bg-white p-4 shadow-sm',
                    conflict ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-brand-600 px-2 text-xs font-bold text-white">
                      {idx + 1}
                    </span>
                    {conflict && (
                      <span className="flex-1 text-xs font-medium text-red-700">
                        ⚠️ Posible alergia: el paciente reporta «{allergies}»
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(it.key)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Quitar medicamento ${idx + 1}`}
                    >
                      ✕ Quitar
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <Field
                      className="sm:col-span-7" label="Medicamento (nombre genérico y concentración) *"
                      value={it.drugName} onChange={(v) => update(it.key, 'drugName', v)}
                      placeholder="Ej: Amoxicilina 500 mg" maxLength={150} invalid={errs?.drugName}
                    />
                    <Field
                      className="sm:col-span-5" label="Presentación / vía"
                      value={it.presentation} onChange={(v) => update(it.key, 'presentation', v)}
                      placeholder="Cápsulas · vía oral" maxLength={100}
                    />
                    <Field
                      className="sm:col-span-3" label="Dosis *"
                      value={it.dose} onChange={(v) => update(it.key, 'dose', v)}
                      placeholder="1 cápsula" maxLength={80} invalid={errs?.dose}
                    />
                    <Field
                      className="sm:col-span-3" label="Frecuencia *" list="rx-frequency-options"
                      value={it.frequency} onChange={(v) => update(it.key, 'frequency', v)}
                      placeholder="Cada 8 horas" maxLength={80} invalid={errs?.frequency}
                    />
                    <Field
                      className="sm:col-span-2" label="Duración (días)" type="number" min={1} max={365}
                      value={it.durationDays} onChange={(v) => update(it.key, 'durationDays', v)}
                      placeholder="7" invalid={errs?.durationDays}
                    />
                    <Field
                      className="sm:col-span-4" label="Cantidad (números y letras)"
                      value={it.quantity} onChange={(v) => update(it.key, 'quantity', v)}
                      placeholder="21 (veintiún) cápsulas" maxLength={60}
                    />
                    <Field
                      className="sm:col-span-12" label="Indicaciones"
                      value={it.instructions} onChange={(v) => update(it.key, 'instructions', v)}
                      placeholder="Ej: Tomar después de las comidas" maxLength={300}
                    />
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
              disabled={items.length >= 20}
              className="w-full rounded-xl border-2 border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-600 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              + Agregar otro medicamento
            </button>
          </section>

          <Textarea
            label="Recomendaciones para el paciente"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Ej: Dieta blanda y fría las primeras 24 horas. No escupir ni usar pitillo. Aplicar hielo 20 min cada hora. Control en 8 días."
          />

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={signNow}
                onChange={(e) => setSignNow(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span>
                <strong>Firmar y emitir ahora</strong>
                <br />
                <span className="text-xs text-gray-600">
                  La receta se firma con tu firma registrada y un sello SHA-256 del contenido (Ley 527 de 1999),
                  queda en la historia clínica y se abre lista para imprimir o enviar por WhatsApp.
                  Si lo desmarcas, queda como borrador.
                </span>
              </span>
            </label>
          </div>
        </div>

        {error && <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="mt-4 flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={requestClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>
            {signNow ? '✍️ Firmar y emitir receta' : 'Guardar borrador'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label, value, onChange, className, invalid, ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'className'>) {
  return (
    <label className={cn('block', className)}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100',
          invalid && 'border-red-400 bg-red-50/40',
        )}
      />
    </label>
  );
}

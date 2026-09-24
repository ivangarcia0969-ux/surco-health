'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn, formatDateTime } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { SignaturePad, type SignaturePadHandle } from '@/components/ui/SignaturePad';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { ConsentBody, consentTemplateMeta } from './ConsentBody';

// ============================================================
// Tipos (respuestas de /api/consents)
// ============================================================

interface ConsentTemplateItem {
  id: string;
  name: string;
  bodyMarkdown: string;
  version: number;
  isActive: boolean;
}

interface ConsentListItem {
  id: string;
  templateId: string;
  templateName: string;
  templateVersion: number;
  signedAt: string | null;
  createdAt: string;
  bodyHashShort: string;
  procedureDetail: string | null;
}

interface PreviewResponse {
  bodyRendered: string;
  template: { id: string; name: string; version: number };
  patient: { id: string; fullName: string; documentType: string; documentId: string };
}

interface IssueResponse {
  id: string;
  signedAt: string;
  bodyHash: string;
  bodyHashShort: string;
  templateName: string;
}

const CAN_SIGN_ROLES = ['CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST'];

const DOC_LABEL: Record<string, string> = {
  CC: 'C.C.', TI: 'T.I.', CE: 'C.E.', RC: 'R.C.', PA: 'Pasaporte', PASSPORT: 'Pasaporte',
  DNI: 'DNI', RFC: 'RFC', OTHER: 'Documento',
};

const CONSENT_ERRORS: Record<string, string> = {
  SIGNATURE_REQUIRED: 'Falta la firma del paciente.',
  SIGNATURE_INVALID: 'La firma no es válida. Límpiela y vuelva a firmar.',
  TEMPLATE_NOT_FOUND: 'La plantilla ya no está disponible. Elija otra.',
  PATIENT_NOT_FOUND: 'Paciente no encontrado.',
  CONSENT_NOT_FOUND: 'Consentimiento no encontrado.',
  HTTP_413: 'La firma es demasiado pesada. Límpiela y firme de nuevo.',
};

function consentError(err: unknown, fallback: string): string {
  const code = (err as { message?: string })?.message ?? '';
  return CONSENT_ERRORS[code] ?? errorMessage(err, fallback);
}

const linkBtn = {
  base: 'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition',
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
  secondary: 'border border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-50',
};

// ============================================================
// Panel del paciente
// ============================================================

export function ConsentsPanel({ patientId }: { patientId: string }) {
  const role = useAuth((s) => s.user?.role);
  const canSign = !!role && CAN_SIGN_ROLES.includes(role);

  const [items, setItems] = useState<ConsentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await apiFetch<ConsentListItem[]>(`/api/consents?patientId=${encodeURIComponent(patientId)}`);
      setItems(Array.isArray(r) ? r : []);
    } catch (err) {
      setLoadError(consentError(err, 'No fue posible cargar los consentimientos.'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            Consentimientos informados
            {items.length > 0 && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{items.length}</span>
            )}
          </CardTitle>
          <p className="mt-1 text-sm text-gray-500">
            Firmados por el paciente en tablet o celular, con fecha, hora y huella digital.
          </p>
        </div>
        {canSign && items.length > 0 && (
          <Button onClick={() => setCreating(true)}>+ Nuevo consentimiento</Button>
        )}
      </div>

      {loading ? (
        <ul className="mt-5 space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <li key={i} className="flex animate-pulse items-center gap-4 rounded-xl border border-gray-100 p-4">
              <div className="h-11 w-11 rounded-xl bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/2 rounded bg-gray-100" />
                <div className="h-3 w-1/3 rounded bg-gray-100" />
              </div>
            </li>
          ))}
        </ul>
      ) : loadError ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <Button size="sm" variant="secondary" onClick={() => { setLoading(true); load(); }}>Reintentar</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-b from-brand-50/60 to-white px-6 py-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm ring-1 ring-gray-100">✍️</div>
          <h4 className="mt-4 text-base font-semibold text-gray-900">Aún no hay consentimientos firmados</h4>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            Elija una plantilla, entréguele la tablet o el celular al paciente para que lea el documento y
            firme con el dedo. Queda guardado con validez legal y listo para imprimir.
          </p>
          {canSign && (
            <div className="mt-5">
              <Button size="lg" onClick={() => setCreating(true)}>+ Nuevo consentimiento</Button>
            </div>
          )}
          <p className="mt-4 text-[11px] text-gray-400">Ley 23 de 1981 · Resolución 1995 de 1999 · Ley 527 de 1999</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((c) => {
            const meta = consentTemplateMeta(c.templateName);
            return (
              <li
                key={c.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-sm sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">{meta.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-gray-900">{c.templateName}</h4>
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-100">
                        ✓ Firmado
                      </span>
                    </div>
                    {c.procedureDetail && (
                      <p className="mt-0.5 truncate text-sm text-gray-600">{c.procedureDetail}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                      <span>🕒 {formatDateTime(c.signedAt ?? c.createdAt)}</span>
                      <span title="Huella digital SHA-256 (inicio)" className="font-mono text-gray-400">
                        🔒 {c.bodyHashShort}…
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href={`/imprimir/consentimiento/${c.id}`}
                  className={cn(linkBtn.base, linkBtn.secondary, 'shrink-0 px-3 py-1.5 text-sm')}
                >
                  🖨️ Ver / imprimir
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {creating && (
        <NewConsentModal
          patientId={patientId}
          onClose={() => setCreating(false)}
          onSigned={() => { load(); }}
        />
      )}
    </Card>
  );
}

// ============================================================
// Flujo "Nuevo consentimiento" (pensado para pasar la tablet al paciente)
// ============================================================

type Step = 1 | 2 | 3 | 'done';

const STEPS: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: 'Plantilla' },
  { n: 2, label: 'Lectura' },
  { n: 3, label: 'Firma' },
];

function Stepper({ step }: { step: Step }) {
  const current = step === 'done' ? 4 : step;
  return (
    <ol className="flex items-center">
      {STEPS.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <li key={s.n} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition',
                  done && 'bg-brand-600 text-white',
                  active && 'bg-brand-600 text-white ring-4 ring-brand-100',
                  !done && !active && 'bg-gray-100 text-gray-500',
                )}
              >
                {done ? '✓' : s.n}
              </span>
              <span className={cn('text-sm font-medium', !active && 'hidden sm:inline', active ? 'text-gray-900' : done ? 'text-brand-700' : 'text-gray-400')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-3 h-0.5 flex-1 rounded-full', current > s.n ? 'bg-brand-500' : 'bg-gray-200')} />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function NewConsentModal({ patientId, onClose, onSigned }: {
  patientId: string;
  onClose: () => void;
  onSigned: () => void;
}) {
  const [step, setStep] = useState<Step>(1);

  // Paso 1
  const [templates, setTemplates] = useState<ConsentTemplateItem[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [procedure, setProcedure] = useState('');

  // Paso 2
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [readToEnd, setReadToEnd] = useState(false);
  const readerRef = useRef<HTMLDivElement | null>(null);

  // Paso 3
  const padRef = useRef<SignaturePadHandle | null>(null);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<IssueResponse | null>(null);

  const loadTemplates = useCallback(async () => {
    setTemplatesError(null);
    try {
      const r = await apiFetch<ConsentTemplateItem[]>('/api/consents/templates');
      setTemplates(Array.isArray(r) ? r : []);
    } catch (err) {
      setTemplates([]);
      setTemplatesError(consentError(err, 'No fue posible cargar las plantillas.'));
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // Al abrir el paso 2: ¿el texto cabe sin scroll? entonces ya está "leído".
  useEffect(() => {
    if (step !== 2) return;
    const el = readerRef.current;
    if (!el) return;
    el.scrollTop = 0;
    const id = window.setTimeout(() => {
      if (el.scrollHeight <= el.clientHeight + 24) setReadToEnd(true);
    }, 60);
    return () => window.clearTimeout(id);
  }, [step, preview]);

  const dirty = step !== 'done' && (step !== 1 || !!templateId || !!procedure.trim());

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm('¿Salir sin guardar? Se perderá el consentimiento en curso.')) return;
    onClose();
  }

  async function goToReading() {
    if (!templateId) return;
    setLoadingPreview(true);
    try {
      const r = await apiFetch<PreviewResponse>('/api/consents/preview', {
        method: 'POST',
        body: { patientId, templateId, procedureDetail: procedure.trim() || undefined },
      });
      setPreview(r);
      setAccepted(false);
      setReadToEnd(false);
      setStep(2);
    } catch (err) {
      toast.error(consentError(err, 'No fue posible preparar el documento.'));
      if ((err as { message?: string })?.message === 'TEMPLATE_NOT_FOUND') {
        setTemplateId(null);
        loadTemplates();
      }
    } finally {
      setLoadingPreview(false);
    }
  }

  function onReaderScroll() {
    const el = readerRef.current;
    if (!el || readToEnd) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 32) setReadToEnd(true);
  }

  function scrollReaderDown() {
    const el = readerRef.current;
    if (!el) return;
    el.scrollBy({ top: Math.round(el.clientHeight * 0.85), behavior: 'smooth' });
  }

  function backToReading() {
    setHasInk(false);
    setStep(2);
  }

  async function signAndSave() {
    if (!templateId || !accepted) return;
    const signatureImg = padRef.current?.toDataUrl() ?? null;
    if (!signatureImg) {
      toast.error('Falta la firma del paciente. Firme dentro del recuadro.');
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch<IssueResponse>('/api/consents', {
        method: 'POST',
        body: { patientId, templateId, procedureDetail: procedure.trim() || undefined, signatureImg },
      });
      setResult(r);
      setStep('done');
      toast.success('Consentimiento firmado y guardado.');
      onSigned();
    } catch (err) {
      toast.error(consentError(err, 'No fue posible guardar el consentimiento.'));
    } finally {
      setSaving(false);
    }
  }

  const patient = preview?.patient;
  const docText = patient ? `${DOC_LABEL[patient.documentType] ?? patient.documentType} ${patient.documentId}` : '';

  return (
    <Modal open onClose={requestClose} title="Nuevo consentimiento informado" size="xl">
      <div className="flex max-h-[calc(100vh-9rem)] flex-col supports-[height:100dvh]:max-h-[calc(100dvh-9rem)]">
        <div className="shrink-0">
          <Stepper step={step} />
        </div>

        {/* ───────── Paso 1: plantilla ───────── */}
        {step === 1 && (
          <div className="-mx-1 mt-5 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
            <p className="text-sm text-gray-600">Elija el tipo de consentimiento que va a firmar el paciente.</p>

            {templates === null ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[88px] animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
                ))}
              </div>
            ) : templatesError ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <span>{templatesError}</span>
                <Button size="sm" variant="secondary" onClick={() => { setTemplates(null); loadTemplates(); }}>Reintentar</Button>
              </div>
            ) : templates.length === 0 ? (
              <div className="mt-4 rounded-xl border-2 border-dashed border-gray-200 px-6 py-8 text-center text-sm text-gray-600">
                <div className="text-3xl">📄</div>
                <p className="mt-2 font-medium text-gray-900">No hay plantillas activas</p>
                <p className="mt-1">El dueño de la clínica puede crearlas o activarlas en Ajustes → Consentimientos.</p>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Plantillas de consentimiento">
                {templates.map((t) => {
                  const meta = consentTemplateMeta(t.name, t.bodyMarkdown);
                  const isSel = t.id === templateId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={isSel}
                      onClick={() => setTemplateId(t.id)}
                      className={cn(
                        'group relative flex items-start gap-3 rounded-xl border bg-white p-4 text-left transition',
                        isSel
                          ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/25'
                          : 'border-gray-200 hover:border-brand-200 hover:shadow-sm',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl transition',
                          isSel ? 'bg-white shadow-sm' : 'bg-gray-50 group-hover:bg-brand-50',
                        )}
                      >
                        {meta.icon}
                      </span>
                      <span className="min-w-0 flex-1 pr-6">
                        <span className="block text-sm font-semibold leading-snug text-gray-900">{t.name}</span>
                        {meta.summary && (
                          <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-gray-500">{meta.summary}</span>
                        )}
                      </span>
                      <span
                        aria-hidden
                        className={cn(
                          'absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition',
                          isSel ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300 bg-white text-transparent',
                        )}
                      >
                        ✓
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5">
              <Input
                label="Procedimiento / detalle (opcional)"
                placeholder="Ej.: Exodoncia del diente 38"
                value={procedure}
                maxLength={300}
                onChange={(e) => setProcedure(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && templateId) goToReading(); }}
                hint="Aparece en el documento. Si lo deja vacío se indica «según el plan de tratamiento explicado por el profesional»."
              />
            </div>
          </div>
        )}

        {/* ───────── Paso 2: lectura ───────── */}
        {step === 2 && preview && (
          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex shrink-0 items-center gap-3 rounded-xl bg-brand-50 px-4 py-2.5 text-sm text-brand-900">
              <span className="text-xl" aria-hidden>📱</span>
              <span>
                <strong>Entregue el dispositivo al paciente</strong> para que lea con calma el documento antes de firmar.
              </span>
            </div>

            <div className="relative flex min-h-[14rem] flex-1 flex-col">
              <div
                ref={readerRef}
                onScroll={onReaderScroll}
                className="min-h-0 flex-1 overflow-y-auto rounded-2xl bg-gray-100 p-2 sm:p-3"
              >
                <article className="mx-auto max-w-2xl rounded-xl bg-white px-5 py-6 shadow-sm ring-1 ring-gray-200 sm:px-9 sm:py-8">
                  <header className="mb-5 border-b border-gray-100 pb-4 text-center">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Consentimiento informado</div>
                    <h4 className="mt-1 text-lg font-bold leading-snug text-gray-900">{preview.template.name}</h4>
                  </header>
                  <ConsentBody text={preview.bodyRendered} />
                </article>
              </div>
              {!readToEnd && (
                <button
                  type="button"
                  onClick={scrollReaderDown}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-900/80 px-4 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur transition hover:bg-gray-900"
                >
                  Desliza para leer todo ↓
                </button>
              )}
            </div>

            <label
              className={cn(
                'mt-3 flex shrink-0 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition',
                accepted ? 'border-brand-500 bg-brand-50/70' : 'border-gray-200 bg-white hover:border-brand-200',
              )}
            >
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-brand-600"
              />
              <span className="text-gray-800">
                <strong>He leído y comprendido</strong> el contenido de este documento. Se me explicaron los beneficios, riesgos
                y alternativas, pude hacer preguntas y fueron resueltas. Acepto de manera libre y voluntaria.
              </span>
            </label>
          </div>
        )}

        {/* ───────── Paso 3: firma ───────── */}
        {step === 3 && preview && (
          <div className="-mx-1 mt-5 min-h-0 flex-1 overflow-y-auto px-1 pb-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">{preview.template.name}</span>
              {procedure.trim() && (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700">{procedure.trim()}</span>
              )}
              {accepted && (
                <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-700">✓ Documento leído y aceptado</span>
              )}
            </div>

            <h4 className="mt-4 text-base font-semibold text-gray-900">Firma del paciente</h4>
            <p className="text-sm text-gray-500">Firme dentro del recuadro con el dedo o con un lápiz digital.</p>

            <div className="mt-3">
              <SignaturePad
                ref={padRef}
                height={200}
                onChange={setHasInk}
                hint="Firme aquí con el dedo o el lápiz"
              />
            </div>

            <div className="mx-auto mt-4 max-w-sm text-center">
              <div className="border-t border-gray-800 pt-1.5 text-sm font-semibold text-gray-900">{patient?.fullName}</div>
              <div className="text-xs text-gray-600">{docText}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-400">Paciente o representante legal</div>
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-xl bg-gray-50 px-3.5 py-3 text-xs leading-relaxed text-gray-500">
              <span aria-hidden>🔒</span>
              <span>
                Al firmar se registran la fecha y la hora, la dirección IP y el dispositivo, y se genera una huella digital
                SHA-256 que garantiza que el documento no pueda alterarse (Ley 527 de 1999).
              </span>
            </p>
          </div>
        )}

        {/* ───────── Listo ───────── */}
        {step === 'done' && result && (
          <div className="mt-6 min-h-0 flex-1 overflow-y-auto pb-2 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-3xl ring-8 ring-green-50/60">✅</div>
            <h4 className="mt-4 text-lg font-semibold text-gray-900">Consentimiento firmado y guardado</h4>
            <p className="mt-1 text-sm text-gray-600">
              {result.templateName} · {formatDateTime(result.signedAt)}
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1 font-mono text-[11px] text-gray-500 ring-1 ring-gray-100">
              🔒 SHA-256 {result.bodyHashShort}…
            </p>
            <p className="mx-auto mt-4 max-w-md text-sm text-gray-500">
              Ya quedó en la historia del paciente. Puede abrir la versión imprimible para entregarle una copia o guardarla en PDF.
            </p>
            <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose}>Cerrar</Button>
              <Link
                href={`/imprimir/consentimiento/${result.id}`}
                className={cn(linkBtn.base, linkBtn.primary, 'px-4 py-2 text-sm')}
              >
                🖨️ Ver / imprimir
              </Link>
            </div>
          </div>
        )}

        {/* ───────── Pie con acciones ───────── */}
        {step !== 'done' && (
          <div className="mt-5 flex shrink-0 flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            {step === 1 ? (
              <Button variant="ghost" onClick={requestClose}>Cancelar</Button>
            ) : (
              <Button variant="ghost" onClick={step === 3 ? backToReading : () => setStep(1)} disabled={saving}>
                ← Atrás
              </Button>
            )}

            {step === 1 && (
              <Button onClick={goToReading} disabled={!templateId} loading={loadingPreview}>
                Continuar a la lectura →
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={!accepted}>
                Continuar a la firma →
              </Button>
            )}
            {step === 3 && (
              <Button size="lg" onClick={signAndSave} disabled={!hasInk || !accepted} loading={saving}>
                ✍️ Firmar y guardar
              </Button>
            )}
          </div>
        )}

      </div>
    </Modal>
  );
}

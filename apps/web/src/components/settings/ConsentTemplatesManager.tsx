'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { useClinic } from '@/components/print/PrintShell';
import { ConsentBody, consentTemplateMeta } from '@/components/clinical/ConsentBody';

/**
 * Gestor de plantillas de consentimiento informado (Ajustes · dueño de la clínica).
 * - La primera carga crea automáticamente las plantillas por defecto.
 * - Editar el texto crea una nueva versión; lo ya firmado conserva su snapshot.
 */

interface ConsentTemplate {
  id: string;
  name: string;
  bodyMarkdown: string;
  version: number;
  isActive: boolean;
  createdAt: string;
}

const MERGE_TAGS: { tag: string; label: string }[] = [
  { tag: '{{paciente.nombre}}', label: 'Nombre del paciente' },
  { tag: '{{paciente.documento}}', label: 'Tipo y número de documento' },
  { tag: '{{paciente.edad}}', label: 'Edad (ej. «34 años»)' },
  { tag: '{{clinica.nombre}}', label: 'Nombre de la clínica' },
  { tag: '{{profesional.nombre}}', label: 'Profesional que emite' },
  { tag: '{{profesional.registro}}', label: 'Registro profesional' },
  { tag: '{{fecha}}', label: 'Fecha larga del día de la firma' },
  { tag: '{{procedimiento}}', label: 'Procedimiento / detalle escrito al emitir' },
];

const STARTER_BODY = `Yo, **{{paciente.nombre}}**, identificado(a) con **{{paciente.documento}}**, de {{paciente.edad}} de edad, declaro que el(la) profesional **{{profesional.nombre}}**, con registro profesional {{profesional.registro}}, de **{{clinica.nombre}}**, me explicó en lenguaje claro la siguiente información.

**Procedimiento / detalle:** {{procedimiento}}

## 1. Descripción del procedimiento

Describa en qué consiste el procedimiento, cómo se realiza y cuánto dura.

## 2. Beneficios esperados

- Beneficio 1
- Beneficio 2

## 3. Riesgos y complicaciones frecuentes

- Riesgo 1
- Riesgo 2

## 4. Alternativas

Explique las alternativas disponibles, incluida la de no realizar el tratamiento.

## 5. Cuidados posteriores

- Cuidado 1
- Cuidado 2

## Declaración del paciente

Declaro que se me explicaron los beneficios, riesgos y alternativas, que pude hacer preguntas y que fueron resueltas. En consecuencia, **otorgo mi consentimiento** para la realización del procedimiento descrito.

## Revocatoria

Sé que puedo revocar este consentimiento en cualquier momento antes del procedimiento, sin que ello afecte mi atención.

Se firma electrónicamente el {{fecha}}.`;

const TEMPLATE_ERRORS: Record<string, string> = {
  TEMPLATE_NOT_FOUND: 'La plantilla ya no existe.',
  VALIDATION: 'Revise el nombre (mínimo 2 caracteres) y el texto (mínimo 20 caracteres).',
};

function templateError(err: unknown, fallback: string): string {
  const code = (err as { message?: string })?.message ?? '';
  return TEMPLATE_ERRORS[code] ?? errorMessage(err, fallback);
}

/** Reemplaza los merge tags con datos de ejemplo para la vista previa. */
function useSampleRenderer() {
  const clinic = useClinic();
  const fullName = useAuth((s) => s.user?.fullName);
  return useCallback((body: string) => {
    const sample: Record<string, string> = {
      'paciente.nombre': 'María Fernanda Gómez Rojas',
      'paciente.documento': 'C.C. 1.144.052.318',
      'paciente.edad': '34 años',
      'clinica.nombre': clinic?.tradeName ?? 'Su clínica',
      'profesional.nombre': fullName ?? 'Dra. Laura Martínez',
      'profesional.registro': 'RP 12345',
      'fecha': new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(new Date()),
      'procedimiento': 'Exodoncia del diente 38',
    };
    return body.replace(/\{\{\s*([a-zA-Z_.]+)\s*\}\}/g, (m, key: string) => sample[key] ?? m);
  }, [clinic?.tradeName, fullName]);
}

// ============================================================
// Tarjeta principal
// ============================================================

export function ConsentTemplatesManager() {
  const role = useAuth((s) => s.user?.role);
  const isOwner = role === 'CLINIC_OWNER';

  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ConsentTemplate | 'new' | null>(null);
  const [previewing, setPreviewing] = useState<ConsentTemplate | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const r = await apiFetch<ConsentTemplate[]>('/api/consents/templates?includeInactive=true');
      setTemplates(Array.isArray(r) ? r : []);
    } catch (err) {
      setLoadError(templateError(err, 'No fue posible cargar las plantillas.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(t: ConsentTemplate) {
    setTogglingId(t.id);
    try {
      const updated = await apiFetch<ConsentTemplate>(`/api/consents/templates/${t.id}`, {
        method: 'PATCH',
        body: { isActive: !t.isActive },
      });
      setTemplates((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      toast.success(updated.isActive ? `«${updated.name}» activada.` : `«${updated.name}» desactivada.`);
    } catch (err) {
      toast.error(templateError(err, 'No fue posible cambiar el estado.'));
    } finally {
      setTogglingId(null);
    }
  }

  function onSaved(saved: ConsentTemplate, isNew: boolean) {
    setTemplates((list) => (isNew ? [...list, saved] : list.map((x) => (x.id === saved.id ? saved : x))));
    setEditing(null);
  }

  const activeCount = templates.filter((t) => t.isActive).length;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-lg">
          <CardTitle>Plantillas de consentimiento informado</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Textos que el paciente lee y firma en la tablet o el celular. Si cambia el texto se crea una nueva
            versión; los consentimientos ya firmados no se modifican.
          </p>
        </div>
        {isOwner && !loading && !loadError && (
          <Button onClick={() => setEditing('new')}>+ Nueva plantilla</Button>
        )}
      </div>

      {loading ? (
        <ul className="mt-5 space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-[68px] animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
          ))}
        </ul>
      ) : loadError ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{loadError}</span>
          <Button size="sm" variant="secondary" onClick={() => { setLoading(true); load(); }}>Reintentar</Button>
        </div>
      ) : templates.length === 0 ? (
        <div className="mt-5 rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center">
          <div className="text-4xl">📄</div>
          <h4 className="mt-3 font-semibold text-gray-900">Aún no hay plantillas</h4>
          <p className="mt-1 text-sm text-gray-600">Cree la primera plantilla de consentimiento para su consultorio.</p>
          {isOwner && (
            <div className="mt-4"><Button onClick={() => setEditing('new')}>+ Nueva plantilla</Button></div>
          )}
        </div>
      ) : (
        <>
          <ul className="mt-5 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200">
            {templates.map((t) => {
              const meta = consentTemplateMeta(t.name, t.bodyMarkdown);
              return (
                <li
                  key={t.id}
                  className={cn(
                    'flex flex-col gap-3 bg-white px-4 py-3.5 transition sm:flex-row sm:items-center',
                    !t.isActive && 'bg-gray-50/70',
                  )}
                >
                  <div className={cn('flex min-w-0 flex-1 items-start gap-3', !t.isActive && 'opacity-60')}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg">{meta.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{t.name}</span>
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600">v{t.version}</span>
                        {!t.isActive && (
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-600">
                            Inactiva
                          </span>
                        )}
                      </div>
                      {meta.summary && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{meta.summary}</p>}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pl-[3.25rem] sm:pl-0">
                    <Button size="sm" variant="ghost" onClick={() => setPreviewing(t)}>👁 Vista previa</Button>
                    {isOwner && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(t)}>Editar</Button>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={t.isActive}
                          aria-label={t.isActive ? 'Desactivar plantilla' : 'Activar plantilla'}
                          title={t.isActive ? 'Activa · clic para desactivar' : 'Inactiva · clic para activar'}
                          disabled={togglingId === t.id}
                          onClick={() => toggleActive(t)}
                          className={cn(
                            'relative ml-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50',
                            t.isActive ? 'bg-brand-600' : 'bg-gray-300',
                          )}
                        >
                          <span
                            className={cn(
                              'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
                              t.isActive ? 'translate-x-[22px]' : 'translate-x-0.5',
                            )}
                          />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-500">
            {activeCount} de {templates.length} plantillas activas · Solo las activas aparecen al emitir un consentimiento.
          </p>
        </>
      )}

      {editing && (
        <TemplateEditorModal
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
      {previewing && (
        <TemplatePreviewModal
          template={previewing}
          canEdit={isOwner}
          onClose={() => setPreviewing(null)}
          onEdit={() => { setEditing(previewing); setPreviewing(null); }}
        />
      )}
    </Card>
  );
}

// ============================================================
// Vista previa (datos de ejemplo)
// ============================================================

function PaperPreview({ name, body }: { name: string; body: string }) {
  const render = useSampleRenderer();
  const text = useMemo(() => render(body), [render, body]);
  return (
    <div className="rounded-2xl bg-gray-100 p-2 sm:p-3">
      <article className="mx-auto max-w-2xl rounded-xl bg-white px-5 py-6 shadow-sm ring-1 ring-gray-200 sm:px-9 sm:py-8">
        <header className="mb-5 border-b border-gray-100 pb-4 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">Consentimiento informado</div>
          <h4 className="mt-1 text-lg font-bold leading-snug text-gray-900">{name || 'Sin nombre'}</h4>
        </header>
        {text.trim() ? (
          <ConsentBody text={text} />
        ) : (
          <p className="text-center text-sm text-gray-400">El texto aparecerá aquí.</p>
        )}
      </article>
    </div>
  );
}

function TemplatePreviewModal({ template, canEdit, onClose, onEdit }: {
  template: ConsentTemplate;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Vista previa de la plantilla" size="xl">
      <div className="flex max-h-[calc(100vh-9rem)] flex-col supports-[height:100dvh]:max-h-[calc(100dvh-9rem)]">
        <p className="shrink-0 text-xs text-gray-500">
          Se muestra con <strong>datos de ejemplo</strong>. Al emitir, se usan los datos reales del paciente y del profesional.
        </p>
        <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
          <PaperPreview name={template.name} body={template.bodyMarkdown} />
        </div>
        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          {canEdit && <Button onClick={onEdit}>Editar plantilla</Button>}
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Editor (crear / editar)
// ============================================================

function TemplateEditorModal({ template, onClose, onSaved }: {
  template: ConsentTemplate | null;
  onClose: () => void;
  onSaved: (t: ConsentTemplate, isNew: boolean) => void;
}) {
  const isNew = !template;
  const [name, setName] = useState(template?.name ?? '');
  const [body, setBody] = useState(template?.bodyMarkdown ?? STARTER_BODY);
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const initialName = template?.name ?? '';
  const initialBody = template?.bodyMarkdown ?? STARTER_BODY;
  const bodyChanged = body.trim() !== initialBody.trim();
  const dirty = name !== initialName || bodyChanged || (!isNew && isActive !== template.isActive);

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm('¿Descartar los cambios de la plantilla?')) return;
    onClose();
  }

  function insertTag(tag: string) {
    const el = bodyRef.current;
    if (tab !== 'edit' || !el) {
      setBody((b) => `${b}${tag}`);
      return;
    }
    // setRangeText deja el cursor justo después del tag; React ve el mismo valor
    // en el DOM y no mueve el cursor al actualizar el estado.
    el.focus();
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.setRangeText(tag, start, end, 'end');
    setBody(el.value);
  }

  async function save() {
    setErr(null);
    if (name.trim().length < 2) { setErr('Escriba un nombre para la plantilla (mínimo 2 caracteres).'); return; }
    if (body.trim().length < 20) { setErr('El texto de la plantilla es muy corto (mínimo 20 caracteres).'); return; }
    setSaving(true);
    try {
      let saved: ConsentTemplate;
      if (isNew) {
        saved = await apiFetch<ConsentTemplate>('/api/consents/templates', {
          method: 'POST',
          body: { name: name.trim(), bodyMarkdown: body, isActive },
        });
        toast.success(`Plantilla «${saved.name}» creada.`);
      } else {
        const patch: Record<string, unknown> = {};
        if (name.trim() !== template.name) patch.name = name.trim();
        if (bodyChanged) patch.bodyMarkdown = body;
        if (isActive !== template.isActive) patch.isActive = isActive;
        if (Object.keys(patch).length === 0) { onClose(); return; }
        saved = await apiFetch<ConsentTemplate>(`/api/consents/templates/${template.id}`, { method: 'PATCH', body: patch });
        toast.success(
          saved.version > template.version
            ? `Plantilla guardada como versión ${saved.version}.`
            : 'Plantilla actualizada.',
        );
      }
      onSaved(saved, isNew);
    } catch (e) {
      setErr(templateError(e, 'No fue posible guardar la plantilla.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={requestClose} title={isNew ? 'Nueva plantilla de consentimiento' : 'Editar plantilla'} size="xl">
      <div className="flex max-h-[calc(100vh-9rem)] flex-col supports-[height:100dvh]:max-h-[calc(100dvh-9rem)]">
        <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-1">
          <Input
            label="Nombre de la plantilla *"
            value={name}
            maxLength={150}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej.: Consentimiento para cirugía periodontal"
          />

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Texto del consentimiento *</span>
              <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-sm">
                {(['edit', 'preview'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={cn(
                      'rounded-md px-3 py-1 font-medium transition',
                      tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
                    )}
                  >
                    {k === 'edit' ? '✏️ Editar' : '👁 Vista previa'}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'edit' ? (
              <Textarea
                ref={bodyRef}
                value={body}
                rows={16}
                spellCheck
                onChange={(e) => setBody(e.target.value)}
                className="min-h-[18rem] font-mono text-[13px] leading-relaxed"
              />
            ) : (
              <PaperPreview name={name} body={body} />
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
              <div className="text-xs font-semibold text-gray-700">Datos automáticos (clic para insertar)</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {MERGE_TAGS.map((m) => (
                  <button
                    key={m.tag}
                    type="button"
                    title={m.label}
                    onClick={() => insertTag(m.tag)}
                    className="rounded-md border border-brand-200 bg-white px-2 py-1 font-mono text-[11px] text-brand-700 transition hover:bg-brand-50"
                  >
                    {m.tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs text-gray-600 md:w-60">
              <div className="font-semibold text-gray-700">Formato</div>
              <ul className="mt-1.5 space-y-1">
                <li><code className="rounded bg-white px-1 font-mono text-gray-800">## Título</code> subtítulo</li>
                <li><code className="rounded bg-white px-1 font-mono text-gray-800">**texto**</code> negrita</li>
                <li><code className="rounded bg-white px-1 font-mono text-gray-800">- texto</code> viñeta</li>
                <li>Línea en blanco = nuevo párrafo</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-brand-600"
              />
              Plantilla <strong>activa</strong> (disponible al emitir consentimientos)
            </label>
            {!isNew && (
              <span className={cn('text-xs', bodyChanged ? 'font-medium text-amber-700' : 'text-gray-500')}>
                {bodyChanged
                  ? `Se guardará como versión ${template.version + 1}. Lo ya firmado no cambia.`
                  : `Versión actual: v${template.version}`}
              </span>
            )}
          </div>

          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
        </div>

        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={requestClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} loading={saving}>{isNew ? 'Crear plantilla' : 'Guardar cambios'}</Button>
        </div>
      </div>
    </Modal>
  );
}

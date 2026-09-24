'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { cn, formatDateTime, SPECIALTY_LABEL } from '@/lib/utils';
import { PrescriptionForm } from './PrescriptionForm';

export interface PrescriptionItemRow {
  id: string;
  drugName: string;
  presentation?: string | null;
  dose: string;
  frequency: string;
  durationDays?: number | null;
  quantity?: string | null;
  instructions?: string | null;
}

export interface PrescriptionRow {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'DELIVERED' | 'CANCELLED';
  diagnosis?: string | null;
  notes?: string | null;
  issuedAt?: string | null;
  signedAt?: string | null;
  createdAt: string;
  items: PrescriptionItemRow[];
  professional: { id: string; fullName: string; specialty?: string | null; licenseNumber?: string | null };
}

const STATUS: Record<PrescriptionRow['status'], { label: string; classes: string }> = {
  DRAFT: { label: 'Borrador', classes: 'bg-gray-100 text-gray-700 ring-gray-200' },
  ISSUED: { label: 'Emitida', classes: 'bg-green-50 text-green-700 ring-green-200' },
  DELIVERED: { label: 'Entregada', classes: 'bg-blue-50 text-blue-700 ring-blue-200' },
  CANCELLED: { label: 'Anulada', classes: 'bg-red-50 text-red-700 ring-red-200' },
};

const MAX_VISIBLE_ITEMS = 3;

function posology(it: PrescriptionItemRow): string {
  const parts = [it.dose, it.frequency.toLowerCase()];
  if (it.durationDays) parts.push(`${it.durationDays} ${it.durationDays === 1 ? 'día' : 'días'}`);
  return parts.join(' · ');
}

export function PrescriptionsPanel({ patientId, allergies }: { patientId: string; allergies?: string | null }) {
  const user = useAuth((s) => s.user);
  const canPrescribe = user?.role === 'PROFESSIONAL' || user?.role === 'CLINIC_OWNER';

  const [rows, setRows] = useState<PrescriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toCancel, setToCancel] = useState<PrescriptionRow | null>(null);
  const [issuingId, setIssuingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const data = await apiFetch<PrescriptionRow[]>(`/api/prescriptions?patientId=${encodeURIComponent(patientId)}`);
      setRows(data);
    } catch (err) {
      setLoadError(errorMessage(err, 'No fue posible cargar las recetas.'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const canManage = (p: PrescriptionRow) =>
    user?.role === 'CLINIC_OWNER' || p.professional.id === user?.id;

  async function issue(p: PrescriptionRow) {
    setIssuingId(p.id);
    try {
      await apiFetch(`/api/prescriptions/${p.id}/issue`, { method: 'POST', body: {} });
      toast.success(`Receta N.º ${p.number} firmada y emitida.`);
      await load();
    } catch (err) {
      const code = (err as { message?: string })?.message;
      toast.error(code === 'ONLY_AUTHOR_CAN_SIGN'
        ? 'Solo el profesional que la elaboró puede firmarla.'
        : errorMessage(err, 'No fue posible firmar la receta.'));
    } finally {
      setIssuingId(null);
    }
  }

  const issuedCount = rows.filter((r) => r.status !== 'CANCELLED').length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <CardTitle>💊 Recetas y fórmulas médicas</CardTitle>
          <p className="mt-0.5 text-xs text-gray-500">
            {rows.length === 0
              ? 'Firmadas digitalmente, listas para imprimir, guardar en PDF o enviar por WhatsApp.'
              : `${issuedCount} vigente${issuedCount === 1 ? '' : 's'} · ${rows.length} en total`}
          </p>
        </div>
        {canPrescribe && (
          <Button onClick={() => setFormOpen(true)}>+ Nueva receta</Button>
        )}
      </Card>

      {allergies?.trim() && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <span aria-hidden>⚠️</span>
          <span><strong>Alergias:</strong> {allergies}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-gray-100 bg-white" />
          ))}
        </div>
      ) : loadError ? (
        <Card className="flex items-center justify-between gap-3 text-sm text-red-700">
          <span>{loadError}</span>
          <Button size="sm" variant="secondary" onClick={() => { setLoading(true); load(); }}>Reintentar</Button>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-4xl ring-8 ring-brand-50/60">
            💊
          </div>
          <h3 className="mt-5 text-base font-semibold text-gray-900">Este paciente aún no tiene recetas</h3>
          <p className="mt-1 max-w-sm text-sm text-gray-500">
            Emite una fórmula médica en segundos con los atajos odontológicos. Sale con el logo de la clínica,
            tu firma y tu registro profesional.
          </p>
          {canPrescribe && (
            <Button className="mt-5" onClick={() => setFormOpen(true)}>+ Crear la primera receta</Button>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => {
            const st = STATUS[p.status] ?? STATUS.DRAFT;
            const cancelled = p.status === 'CANCELLED';
            const visible = p.items.slice(0, MAX_VISIBLE_ITEMS);
            const hidden = p.items.length - visible.length;
            const specialty = p.professional.specialty ? SPECIALTY_LABEL[p.professional.specialty] : null;
            return (
              <li key={p.id}>
                <Card className={cn('p-0 transition', cancelled && 'opacity-75')}>
                  <div className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          N.º <span className="font-mono tracking-wide">{p.number}</span>
                        </span>
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', st.classes)}>
                          {p.status === 'ISSUED' && '✓ '}{st.label}
                        </span>
                        <span className="text-xs text-gray-500">{formatDateTime(p.issuedAt ?? p.createdAt)}</span>
                      </div>
                      <div className="text-right text-xs text-gray-500">
                        <div className="font-medium text-gray-700">{p.professional.fullName}</div>
                        {specialty && <div>{specialty}</div>}
                      </div>
                    </div>

                    {p.diagnosis && (
                      <p className="mt-2 text-sm">
                        <span className="font-medium text-gray-600">Dx: </span>
                        <span className="text-gray-900">{p.diagnosis}</span>
                      </p>
                    )}

                    <ul className={cn('mt-3 space-y-1.5', cancelled && 'line-through decoration-red-300')}>
                      {visible.map((it) => (
                        <li key={it.id} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 text-brand-600" aria-hidden>•</span>
                          <span>
                            <span className="font-medium text-gray-900">{it.drugName}</span>
                            {it.presentation && <span className="text-gray-500"> ({it.presentation})</span>}
                            <span className="text-gray-600"> — {posology(it)}</span>
                          </span>
                        </li>
                      ))}
                      {hidden > 0 && (
                        <li className="pl-4 text-xs text-gray-500">+ {hidden} medicamento{hidden === 1 ? '' : 's'} más</li>
                      )}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-2.5">
                    {p.status === 'DRAFT' && p.professional.id === user?.id && (
                      <Button size="sm" onClick={() => issue(p)} loading={issuingId === p.id}>
                        ✍️ Firmar y emitir
                      </Button>
                    )}
                    {/* Misma pestaña (navegación de cliente): la sesión ya está cargada y «Volver» regresa aquí */}
                    <Link
                      href={`/imprimir/receta/${p.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
                    >
                      🖨️ Ver / imprimir
                    </Link>
                    {!cancelled && canManage(p) && (
                      <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setToCancel(p)}>
                        Anular
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {canPrescribe && (
        <PrescriptionForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onCreated={() => { load(); }}
          patientId={patientId}
          allergies={allergies}
        />
      )}

      <CancelDialog
        prescription={toCancel}
        onClose={() => setToCancel(null)}
        onDone={() => { setToCancel(null); load(); }}
      />
    </div>
  );
}

function CancelDialog({ prescription, onClose, onDone }: {
  prescription: PrescriptionRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (prescription) setReason(''); }, [prescription]);

  async function confirm() {
    if (!prescription) return;
    setSaving(true);
    try {
      await apiFetch(`/api/prescriptions/${prescription.id}/cancel`, {
        method: 'POST',
        body: { reason: reason.trim() || undefined },
      });
      toast.success(`Receta N.º ${prescription.number} anulada.`);
      onDone();
    } catch (err) {
      const code = (err as { message?: string })?.message;
      toast.error(code === 'PRESCRIPTION_ALREADY_CANCELLED'
        ? 'Esta receta ya estaba anulada.'
        : errorMessage(err, 'No fue posible anular la receta.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={!!prescription} onClose={() => !saving && onClose()} title="Anular receta" size="md">
      {prescription && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            La receta <strong className="font-mono text-gray-900">N.º {prescription.number}</strong> quedará marcada como
            <strong className="text-red-700"> ANULADA</strong> y no será válida para dispensar. No se borra: queda en la
            historia clínica y en la auditoría.
          </p>
          <Textarea
            label="Motivo (opcional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={2}
            placeholder="Ej: Error en la dosis, se emite una nueva receta"
          />
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
            <Button variant="secondary" onClick={onClose} disabled={saving}>Volver</Button>
            <Button variant="danger" onClick={confirm} loading={saving}>Anular receta</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

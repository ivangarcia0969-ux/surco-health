'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { cn, formatCop, formatDateTime } from '@/lib/utils';

export interface AccountData {
  planTotal: number;
  completedTotal: number;
  paid: number;
  balance: number;
  credit: number;
  payments: {
    id: string; invoiceId: string; number: string; concept: string;
    method: string; amount: number; reference?: string | null; paidAt: string;
  }[];
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia / Nequi',
  INSURER: 'Aseguradora',
  MIXED: 'Mixto',
};

export function usePatientAccount(patientId: string) {
  const [account, setAccount] = useState<AccountData | null>(null);
  const load = useCallback(async () => {
    try {
      setAccount(await apiFetch<AccountData>(`/api/billing/patients/${patientId}/account`));
    } catch {
      setAccount(null);
    }
  }, [patientId]);
  useEffect(() => { load(); }, [load]);
  return { account, reload: load };
}

/** Modal para registrar un abono. Devuelve el recibo creado vía onCreated. */
export function PaymentForm({
  open, onClose, onCreated, patientId, suggestedAmount,
}: {
  open: boolean; onClose: () => void; onCreated: (receiptId: string) => void;
  patientId: string; suggestedAmount?: number;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [concept, setConcept] = useState('Abono a tratamiento odontológico');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAmount(suggestedAmount ? String(Math.round(suggestedAmount)) : '');
      setReference('');
    }
  }, [open, suggestedAmount]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) { toast.error('Ingresa un valor mayor a cero.'); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch<{ id: string; number: string }>('/api/billing/payments', {
        method: 'POST',
        body: { patientId, amount: value, method, concept: concept.trim() || 'Abono', reference: reference.trim() || undefined },
      });
      toast.success(`Abono registrado · Recibo ${r.number}`);
      onCreated(r.id);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible registrar el abono.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Registrar abono" size="md">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Valor recibido (COP)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
            <input
              value={amount ? Number(amount).toLocaleString('es-CO') : ''}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric" autoFocus placeholder="0"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-7 pr-3 text-right text-xl font-bold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {suggestedAmount ? (
            <p className="mt-1 text-xs text-gray-500">Saldo pendiente: {formatCop(suggestedAmount)}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PAYMENT_METHOD_LABEL).filter(([k]) => k !== 'MIXED').map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMethod(k)}
                    className={cn('rounded-lg border px-3 py-2 text-sm font-medium transition',
                      method === k ? 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-100' : 'border-gray-200 text-gray-700 hover:bg-gray-50')}>
              {k === 'CASH' ? '💵' : k === 'CARD' ? '💳' : k === 'TRANSFER' ? '📲' : '🏥'} {label}
            </button>
          ))}
        </div>
        <Input label="Concepto" value={concept} onChange={(e) => setConcept(e.target.value)} />
        {method !== 'CASH' && (
          <Input label="Referencia / N.º de transacción (opcional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>Registrar abono</Button>
        </div>
      </form>
    </Modal>
  );
}

/** Pestaña "Pagos" del paciente: estado de cuenta + historial de recibos. */
export function PatientAccount({ patientId }: { patientId: string }) {
  const { account, reload } = usePatientAccount(patientId);
  const [open, setOpen] = useState(false);

  if (!account) return <Card className="h-40 animate-pulse bg-gray-100" />;

  const progress = account.planTotal > 0 ? Math.min(100, Math.round((account.paid / account.planTotal) * 100)) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total del plan" value={formatCop(account.planTotal)} />
        <Stat label="Abonado" value={formatCop(account.paid)} tone="positive" />
        <Stat label="Saldo pendiente" value={formatCop(account.balance)} tone={account.balance > 0 ? 'warning' : 'positive'} />
        <Stat label="Tratamientos realizados" value={formatCop(account.completedTotal)} />
      </div>

      {account.planTotal > 0 && (
        <Card className="p-4">
          <div className="mb-1 flex justify-between text-xs text-gray-600">
            <span>Avance de pagos</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all" style={{ width: `${progress}%` }} />
          </div>
          {account.credit > 0 && (
            <p className="mt-2 text-xs font-medium text-green-700">Saldo a favor del paciente: {formatCop(account.credit)}</p>
          )}
        </Card>
      )}

      <Card className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-5 py-4">
          <CardTitle>Recibos de caja</CardTitle>
          <div className="flex gap-2">
            <Link href={`/imprimir/presupuesto/${patientId}`} target="_blank"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              📄 Presupuesto
            </Link>
            <Button size="sm" onClick={() => setOpen(true)}>💵 Registrar abono</Button>
          </div>
        </div>
        {account.payments.length === 0 ? (
          <div className="py-10 text-center">
            <div className="text-4xl">💵</div>
            <p className="mt-2 text-sm font-medium text-gray-900">Sin abonos registrados</p>
            <p className="text-xs text-gray-500">Cada abono genera un recibo de caja imprimible.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {account.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-500">{p.number}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{PAYMENT_METHOD_LABEL[p.method] ?? p.method}</span>
                  </div>
                  <div className="truncate text-sm text-gray-900">{p.concept}</div>
                  <div className="text-xs text-gray-500">{formatDateTime(p.paidAt)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base font-bold text-gray-900">{formatCop(p.amount)}</span>
                  <Link href={`/imprimir/recibo/${p.invoiceId}`} target="_blank" className="text-sm font-medium text-brand-600 hover:underline">
                    Recibo
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PaymentForm open={open} onClose={() => setOpen(false)} onCreated={() => reload()}
                   patientId={patientId} suggestedAmount={account.balance || undefined} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'warning' }) {
  return (
    <Card className={cn('p-4', tone === 'positive' && 'border-green-200', tone === 'warning' && 'border-amber-200')}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn('mt-1 text-xl font-bold', tone === 'positive' && 'text-green-700', tone === 'warning' && 'text-amber-700')}>{value}</div>
    </Card>
  );
}

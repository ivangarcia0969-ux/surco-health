'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { PAYMENT_METHOD_LABEL } from '@/components/billing/PatientAccount';
import { cn, formatCop, formatTime, isoDate } from '@/lib/utils';

interface ReceiptRow {
  id: string; number: string; total: number; createdAt: string; concept: string;
  method: string | null; patient: { id: string; fullName: string; documentId: string };
}
interface Summary {
  periodIncome: number; periodPayments: number; todayIncome: number; todayPayments: number;
  byMethod: { method: string; total: number }[];
  pendingTreatments: { count: number; value: number };
  daily: { day: string; total: number }[];
}

export default function CashPage() {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [rows, setRows] = useState<ReceiptRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const load = useCallback(async () => {
    setRows(null);
    try {
      const from = new Date(`${date}T00:00:00`).toISOString();
      const to = new Date(`${date}T23:59:59`).toISOString();
      const [r, s] = await Promise.all([
        apiFetch<ReceiptRow[]>(`/api/billing/receipts?from=${from}&to=${to}`),
        apiFetch<Summary>('/api/billing/summary').catch(() => null),
      ]);
      setRows(r); setSummary(s);
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible cargar la caja.'));
      setRows([]);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const dayTotal = useMemo(() => (rows ?? []).reduce((s, r) => s + r.total, 0), [rows]);
  const byMethodDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(r.method ?? 'OTHER', (m.get(r.method ?? 'OTHER') ?? 0) + r.total);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const isToday = date === isoDate(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Caja</h1>
          <p className="text-sm text-gray-500">Abonos y pagos recibidos. Cada pago genera un recibo imprimible.</p>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label={isToday ? 'Recaudado hoy' : 'Recaudado ese día'} value={formatCop(dayTotal)} hint={`${rows?.length ?? 0} recibos`} dark />
        <Kpi label="Recaudado este mes" value={formatCop(summary?.periodIncome ?? 0)} hint={`${summary?.periodPayments ?? 0} pagos`} />
        <Kpi label="Tratamientos por cobrar" value={formatCop(summary?.pendingTreatments.value ?? 0)} hint={`${summary?.pendingTreatments.count ?? 0} procedimientos pendientes`} />
        <Kpi label="Ticket promedio" value={formatCop(summary && summary.periodPayments ? summary.periodIncome / summary.periodPayments : 0)} hint="del mes" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-0 lg:col-span-2">
          <div className="border-b border-gray-100 px-5 py-4"><CardTitle>Recibos del día</CardTitle></div>
          {rows === null ? (
            <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <div className="text-4xl">🧾</div>
              <p className="mt-2 text-sm font-medium text-gray-900">No hay pagos registrados este día</p>
              <p className="text-xs text-gray-500">Los abonos se registran desde la ficha del paciente → Pagos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-2.5">Hora</th>
                    <th className="px-5 py-2.5">Recibo</th>
                    <th className="px-5 py-2.5">Paciente</th>
                    <th className="px-5 py-2.5">Medio</th>
                    <th className="px-5 py-2.5 text-right">Valor</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-xs text-gray-500">{formatTime(r.createdAt)}</td>
                      <td className="px-5 py-3 font-mono text-xs font-semibold">{r.number}</td>
                      <td className="px-5 py-3">
                        <Link href={`/pacientes/${r.patient.id}?tab=payments`} className="font-medium text-gray-900 hover:text-brand-700">{r.patient.fullName}</Link>
                        <div className="truncate text-xs text-gray-500">{r.concept}</div>
                      </td>
                      <td className="px-5 py-3 text-xs">{r.method ? PAYMENT_METHOD_LABEL[r.method] ?? r.method : '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold">{formatCop(r.total)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/imprimir/recibo/${r.id}`} target="_blank" className="text-xs font-medium text-brand-600 hover:underline">Recibo</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-5 py-3 text-right text-sm font-medium text-gray-700">Total del día</td>
                    <td className="px-5 py-3 text-right text-base font-bold">{formatCop(dayTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Por medio de pago</CardTitle>
          {byMethodDay.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">Sin movimientos.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {byMethodDay.map(([m, total]) => (
                <li key={m}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{PAYMENT_METHOD_LABEL[m] ?? m}</span>
                    <span className="font-semibold">{formatCop(total)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${dayTotal ? (total / dayTotal) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, dark }: { label: string; value: string; hint?: string; dark?: boolean }) {
  return (
    <Card className={cn('p-4', dark && 'border-brand-700 bg-gradient-to-br from-brand-600 to-brand-700 text-white')}>
      <div className={cn('text-xs font-medium', dark ? 'text-white/80' : 'text-gray-500')}>{label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight md:text-2xl">{value}</div>
      {hint && <div className={cn('mt-0.5 text-xs', dark ? 'text-white/70' : 'text-gray-400')}>{hint}</div>}
    </Card>
  );
}

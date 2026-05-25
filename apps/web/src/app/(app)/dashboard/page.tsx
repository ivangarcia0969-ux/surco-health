'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { formatDate, isoDate, SPECIALTY_LABEL } from '@/lib/utils';

interface UsageData {
  plan: { tier: string; name: string; maxProfessionals: number; maxAppointmentsPerMonth: number | null };
  planExpiresAt: string | null;
  trialEndsAt: string | null;
  usage: { professionals: number; monthAppts: number; patients: number };
}

interface Appointment {
  id: string; startsAt: string; endsAt: string; status: string;
  patient: { fullName: string };
  professional: { fullName: string; specialty: string | null };
  service?: { name: string } | null;
}

export default function DashboardPage() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [todays, setTodays] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const today = isoDate(new Date());
        const from = new Date(`${today}T00:00:00`).toISOString();
        const to = new Date(`${today}T23:59:59`).toISOString();
        const [u, appts] = await Promise.all([
          apiFetch<UsageData>('/api/tenants/me/usage'),
          apiFetch<Appointment[]>(`/api/appointments?from=${from}&to=${to}`),
        ]);
        setUsage(u);
        setTodays(appts);
      } catch {/* */}
      setLoading(false);
    })();
  }, []);

  if (loading) return <Card className="text-sm text-gray-500">Cargando…</Card>;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inicio</h1>
          <p className="text-sm text-gray-500">Resumen del día y de tu plan.</p>
        </div>
        <Link href="/agenda" className="text-sm font-medium text-brand-600 hover:underline">Ver agenda completa →</Link>
      </div>

      {usage?.trialEndsAt && new Date(usage.trialEndsAt) > new Date() && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm">
            🎁 Estás en <strong>período de prueba</strong> del plan {usage.plan.name}. Termina el{' '}
            <strong>{formatDate(usage.trialEndsAt)}</strong>.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Citas de hoy" value={todays.length} href="/agenda" />
        <Kpi label="Profesionales" value={`${usage?.usage.professionals ?? 0} / ${usage?.plan.maxProfessionals ?? '—'}`} href="/profesionales" />
        <Kpi label="Pacientes" value={usage?.usage.patients ?? 0} href="/pacientes" />
        <Kpi label="Citas este mes" value={`${usage?.usage.monthAppts ?? 0}${usage?.plan.maxAppointmentsPerMonth ? ` / ${usage.plan.maxAppointmentsPerMonth}` : ''}`} />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <CardTitle>Citas de hoy</CardTitle>
          <Link href="/agenda" className="text-sm text-brand-600 hover:underline">Ver todas →</Link>
        </div>
        {todays.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No hay citas para hoy.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {todays
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <span className="font-medium">{new Date(a.startsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="ml-3">{a.patient.fullName}</span>
                    {a.service && <span className="ml-2 text-gray-500">· {a.service.name}</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {a.professional.fullName}
                    {a.professional.specialty && ` · ${SPECIALTY_LABEL[a.professional.specialty]}`}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const inner = (
    <Card className="h-full transition hover:shadow-md">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

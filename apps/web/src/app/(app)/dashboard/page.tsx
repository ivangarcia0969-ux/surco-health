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
        <Kpi icon="📅" label="Citas de hoy" value={todays.length} href="/agenda" />
        <Kpi icon="👨‍⚕️" label="Profesionales" value={`${usage?.usage.professionals ?? 0} / ${usage?.plan.maxProfessionals ?? '—'}`} href="/profesionales" />
        <Kpi icon="👥" label="Pacientes" value={usage?.usage.patients ?? 0} href="/pacientes" />
        <Kpi icon="📈" label="Citas este mes" value={`${usage?.usage.monthAppts ?? 0}${usage?.plan.maxAppointmentsPerMonth ? ` / ${usage.plan.maxAppointmentsPerMonth}` : ''}`} />
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Citas de hoy</CardTitle>
          <Link href="/agenda" className="text-sm font-medium text-brand-600 hover:underline">Ver todas →</Link>
        </div>
        {todays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl">🗓️</div>
            <p className="mt-3 text-sm font-medium text-gray-900">No hay citas para hoy</p>
            <p className="mt-1 text-xs text-gray-500">Cuando agendes citas para hoy aparecerán aquí.</p>
            <Link href="/agenda" className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700">
              + Agendar cita
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {todays
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((a) => {
                const ini = a.patient.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 transition hover:bg-gray-50">
                    <span className="flex w-14 shrink-0 justify-center rounded-lg bg-brand-50 py-1 font-mono text-xs font-semibold text-brand-700">
                      {new Date(a.startsAt).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600">{ini}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900">{a.patient.fullName}</div>
                      {a.service && <div className="truncate text-xs text-gray-500">{a.service.name}</div>}
                    </div>
                    <div className="hidden text-right text-xs text-gray-500 sm:block">
                      {a.professional.fullName}
                      {a.professional.specialty && <div className="text-[11px] text-gray-400">{SPECIALTY_LABEL[a.professional.specialty]}</div>}
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Kpi({ icon, label, value, href }: { icon: string; label: string; value: string | number; href?: string }) {
  const inner = (
    <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-lg">{icon}</span>
        {href && <span className="text-gray-300">→</span>}
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-gray-900">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-gray-500">{label}</div>
    </Card>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Card, CardTitle } from '@/components/ui/Card';
import { cn, formatCop, formatDate, formatTime, isoDate, SPECIALTY_LABEL } from '@/lib/utils';

interface UsageData {
  plan: { tier: string; name: string; maxProfessionals: number; maxAppointmentsPerMonth: number | null };
  planExpiresAt: string | null;
  trialEndsAt: string | null;
  usage: { professionals: number; monthAppts: number; patients: number };
}

interface Appointment {
  id: string; startsAt: string; endsAt: string; status: string;
  patient: { id: string; fullName: string };
  professional: { fullName: string; specialty: string | null };
  service?: { name: string } | null;
}

interface Summary {
  periodIncome: number; periodPayments: number; todayIncome: number; todayPayments: number;
  pendingTreatments: { count: number; value: number };
  daily: { day: string; total: number }[];
}

const STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  REQUESTED: { label: 'Solicitada', classes: 'bg-gray-100 text-gray-600' },
  CONFIRMED: { label: 'Confirmada', classes: 'bg-blue-50 text-blue-700' },
  CHECKED_IN: { label: 'En espera', classes: 'bg-indigo-50 text-indigo-700' },
  IN_PROGRESS: { label: 'En consulta', classes: 'bg-amber-50 text-amber-700' },
  ATTENDED: { label: 'Atendida', classes: 'bg-green-50 text-green-700' },
  NO_SHOW: { label: 'No asistió', classes: 'bg-red-50 text-red-600' },
  CANCELLED: { label: 'Cancelada', classes: 'bg-gray-100 text-gray-400' },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const role = user?.role;
  const isOwner = role === 'CLINIC_OWNER';
  const seesMoney = role === 'CLINIC_OWNER' || role === 'RECEPTIONIST';
  const clinical = role === 'CLINIC_OWNER' || role === 'PROFESSIONAL';

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [todays, setTodays] = useState<Appointment[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [patientsCount, setPatientsCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = isoDate(new Date());
      const from = new Date(`${today}T00:00:00`).toISOString();
      const to = new Date(`${today}T23:59:59`).toISOString();
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const [u, appts, s, pts] = await Promise.all([
        isOwner ? apiFetch<UsageData>('/api/tenants/me/usage').catch(() => null) : Promise.resolve(null),
        apiFetch<Appointment[]>(`/api/appointments?from=${from}&to=${to}`).catch(() => [] as Appointment[]),
        seesMoney ? apiFetch<Summary>(`/api/billing/summary?from=${monthStart}&to=${new Date().toISOString()}`).catch(() => null) : Promise.resolve(null),
        apiFetch<{ pagination: { total: number } }>('/api/patients?pageSize=1').then((r) => r.pagination.total).catch(() => null),
      ]);
      setUsage(u); setTodays(appts); setSummary(s); setPatientsCount(pts);
      setLoading(false);
    })();
  }, [isOwner, seesMoney]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-16 w-72 animate-pulse rounded-xl bg-gray-100" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  const active = todays.filter((a) => a.status !== 'CANCELLED').sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const attended = todays.filter((a) => a.status === 'ATTENDED').length;
  const next = active.find((a) => ['CONFIRMED', 'CHECKED_IN', 'REQUESTED', 'IN_PROGRESS'].includes(a.status));
  const firstName = user?.fullName.replace(/^(Dra?\.|Dr\.)\s*/i, '').split(' ')[0] ?? '';
  const longToday = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500 first-letter:uppercase">{longToday}</p>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">{greeting()}, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-gray-500">
            {active.length === 0 ? 'No tienes citas para hoy.' : `Hoy hay ${active.length} cita${active.length === 1 ? '' : 's'}; ${attended} atendida${attended === 1 ? '' : 's'}.`}
            {next ? ` Próxima: ${next.patient.fullName} a las ${formatTime(next.startsAt)}.` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/agenda?nueva=1" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">+ Nueva cita</Link>
          <Link href="/pacientes?nuevo=1" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50">+ Nuevo paciente</Link>
        </div>
      </div>

      {usage?.trialEndsAt && new Date(usage.trialEndsAt) > new Date() && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <p className="text-sm">
            🎁 Estás en <strong>período de prueba</strong> del plan {usage.plan.name}. Termina el{' '}
            <strong>{formatDate(usage.trialEndsAt)}</strong>.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon="📅" label="Citas de hoy" value={active.length} hint={`${attended} atendidas`} href="/agenda" />
        {seesMoney ? (
          <Kpi icon="💵" label="Recaudado hoy" value={formatCop(summary?.todayIncome ?? 0)} hint={`${summary?.todayPayments ?? 0} pagos`} href="/caja" dark />
        ) : (
          <Kpi icon="✅" label="Atendidas hoy" value={attended} href="/agenda" />
        )}
        {seesMoney ? (
          <Kpi icon="📈" label="Recaudado este mes" value={formatCop(summary?.periodIncome ?? 0)} hint={`${summary?.periodPayments ?? 0} pagos`} href="/caja" />
        ) : (
          <Kpi icon="⏳" label="Por atender" value={active.filter((a) => ['CONFIRMED', 'CHECKED_IN', 'REQUESTED'].includes(a.status)).length} href="/agenda" />
        )}
        <Kpi icon="👥" label="Pacientes" value={patientsCount ?? usage?.usage.patients ?? '—'}
             hint={seesMoney && summary ? `${formatCop(summary.pendingTreatments.value)} en tratamientos por hacer` : undefined} href="/pacientes" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <CardTitle>Citas de hoy</CardTitle>
            <Link href="/agenda" className="text-sm font-medium text-brand-600 hover:underline">Ver agenda →</Link>
          </div>
          {active.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl">🗓️</div>
              <p className="mt-3 text-sm font-medium text-gray-900">No hay citas para hoy</p>
              <Link href="/agenda" className="mt-4 rounded-full bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700">+ Agendar cita</Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {active.map((a) => {
                const ini = a.patient.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
                const st = STATUS_LABEL[a.status] ?? STATUS_LABEL.CONFIRMED;
                const canAttend = clinical && ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'REQUESTED'].includes(a.status);
                return (
                  <li key={a.id} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 transition hover:bg-gray-50">
                    <span className="flex w-[74px] shrink-0 justify-center whitespace-nowrap rounded-lg bg-brand-50 py-1 font-mono text-[11px] font-semibold text-brand-700">
                      {formatTime(a.startsAt)}
                    </span>
                    <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600 sm:flex">{ini}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/pacientes/${a.patient.id}`} className="block truncate text-sm font-medium text-gray-900 hover:text-brand-700">{a.patient.fullName}</Link>
                      <div className="truncate text-xs text-gray-500">
                        {a.service?.name ?? 'Consulta'}{role !== 'PROFESSIONAL' ? ` · ${a.professional.fullName}` : ''}
                      </div>
                    </div>
                    <span className={cn('hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline', st.classes)}>{st.label}</span>
                    {canAttend && (
                      <button onClick={() => router.push(`/pacientes/${a.patient.id}?atender=${a.id}`)}
                              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                        {a.status === 'IN_PROGRESS' ? 'Continuar' : 'Atender'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {seesMoney && summary ? (
          <IncomeChart daily={summary.daily} total={summary.periodIncome} />
        ) : (
          <Card>
            <CardTitle>Accesos rápidos</CardTitle>
            <div className="mt-4 grid gap-2">
              <QuickLink href="/agenda" icon="📅" label="Mi agenda del día" />
              <QuickLink href="/pacientes" icon="👥" label="Buscar paciente" />
              {role === 'PROFESSIONAL' && <QuickLink href="/mi-perfil" icon="✍️" label="Mi firma para recetas" />}
            </div>
            {user?.specialty && (
              <p className="mt-4 text-xs text-gray-500">Especialidad: {SPECIALTY_LABEL[user.specialty] ?? user.specialty}</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

/** Gráfica de barras del recaudo diario del mes (SVG liviano, sin librerías). */
function IncomeChart({ daily, total }: { daily: { day: string; total: number }[]; total: number }) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const byDay = new Map<number, number>();
  for (const d of daily) {
    // El API agrupa por día en hora de Colombia; la fecha llega como medianoche local
    const date = new Date(d.day);
    byDay.set(date.getUTCDate(), (byDay.get(date.getUTCDate()) ?? 0) + d.total);
  }
  const values = Array.from({ length: daysInMonth }, (_, i) => byDay.get(i + 1) ?? 0);
  const max = Math.max(...values, 1);
  const today = now.getDate();

  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <CardTitle>Recaudo del mes</CardTitle>
        <span className="text-sm font-bold text-gray-900">{formatCop(total)}</span>
      </div>
      <p className="text-xs text-gray-500 first-letter:uppercase">{new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(now)}</p>
      <div className="mt-4 flex h-40 items-end gap-[3px]">
        {values.map((v, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end">
            <div
              className={cn('w-full rounded-t transition', i + 1 === today ? 'bg-brand-600' : v > 0 ? 'bg-brand-300 group-hover:bg-brand-500' : 'bg-gray-100')}
              style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 2)}%` }}
            />
            {v > 0 && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] text-white group-hover:block">
                {i + 1}: {formatCop(v)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>1</span><span>{Math.ceil(daysInMonth / 2)}</span><span>{daysInMonth}</span>
      </div>
    </Card>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50">{icon}</span>{label}
    </Link>
  );
}

function Kpi({ icon, label, value, hint, href, dark }: {
  icon: string; label: string; value: string | number; hint?: string; href?: string; dark?: boolean;
}) {
  const inner = (
    <Card className={cn('h-full p-5 transition hover:-translate-y-0.5 hover:shadow-md',
      dark && 'border-brand-700 bg-gradient-to-br from-brand-600 to-brand-700 text-white')}>
      <div className="flex items-center justify-between">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-lg', dark ? 'bg-white/15' : 'bg-brand-50')}>{icon}</span>
        {href && <span className={dark ? 'text-white/60' : 'text-gray-300'}>→</span>}
      </div>
      <div className="mt-4 text-xl font-bold tracking-tight md:text-2xl">{value}</div>
      <div className={cn('mt-0.5 text-xs font-medium', dark ? 'text-white/80' : 'text-gray-500')}>{label}</div>
      {hint && <div className={cn('mt-0.5 truncate text-[11px]', dark ? 'text-white/60' : 'text-gray-400')}>{hint}</div>}
    </Card>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

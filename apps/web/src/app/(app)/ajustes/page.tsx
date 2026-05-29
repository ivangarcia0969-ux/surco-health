'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { formatDate, SPECIALTY_LABEL } from '@/lib/utils';
import { WhatsappAccountsManager } from '@/components/settings/WhatsappAccountsManager';

interface TenantMe {
  id: string;
  legalName: string;
  tradeName: string;
  slug: string;
  taxId?: string | null;
  taxIdType?: string | null;
  timezone: string;
  currency: string;
  primarySpecialty?: string | null;
  primaryColor?: string | null;
  planExpiresAt?: string | null;
  trialEndsAt?: string | null;
  plan: { tier: string; name: string; priceMonthlyUsd: number };
}

interface Usage {
  plan: { name: string; maxProfessionals: number; maxAppointmentsPerMonth: number | null; whatsappEnabled: boolean; telehealthEnabled: boolean };
  trialEndsAt?: string | null;
  usage: { professionals: number; monthAppts: number; patients: number };
}

export default function SettingsPage() {
  const [tenant, setTenant] = useState<TenantMe | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = useCallback(async () => {
    const [t, u] = await Promise.all([
      apiFetch<TenantMe>('/api/tenants/me'),
      apiFetch<Usage>('/api/tenants/me/usage'),
    ]);
    setTenant(t); setUsage(u);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!tenant || !usage) return <Card className="text-sm text-gray-500">Cargando…</Card>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-sm text-gray-500">Configuración de tu clínica y plan.</p>
      </div>

      <BusinessProfile tenant={tenant} onSaved={load} />
      <PlanInfo tenant={tenant} usage={usage} />
      {usage.plan.whatsappEnabled && <WhatsappAccountsManager />}
    </div>
  );
}

function BusinessProfile({ tenant, onSaved }: { tenant: TenantMe; onSaved: () => void }) {
  const [legalName, setLegalName] = useState(tenant.legalName);
  const [tradeName, setTradeName] = useState(tenant.tradeName);
  const [timezone, setTimezone] = useState(tenant.timezone);
  const [primarySpecialty, setPrimarySpecialty] = useState(tenant.primarySpecialty ?? 'OTHER');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/tenants/me', {
        method: 'PATCH',
        body: { legalName, tradeName, timezone, primarySpecialty },
      });
      setMsg('✓ Guardado');
      onSaved();
      setTimeout(() => setMsg(null), 2000);
    } catch { setMsg('Error al guardar'); }
    finally { setSaving(false); }
  }

  return (
    <Card>
      <CardTitle>Perfil de la clínica</CardTitle>
      <form onSubmit={save} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input label="Razón social" value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        <Input label="Nombre comercial" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
        <Input label="Slug (URL)" value={tenant.slug} disabled />
        <Select label="Especialidad principal" value={primarySpecialty} onChange={(e) => setPrimarySpecialty(e.target.value)}>
          {Object.entries(SPECIALTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <Select label="Zona horaria" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          <option value="America/Bogota">America/Bogota</option>
          <option value="America/Mexico_City">America/Mexico_City</option>
          <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
          <option value="America/Lima">America/Lima</option>
          <option value="America/Santiago">America/Santiago</option>
          <option value="Europe/Madrid">Europe/Madrid</option>
        </Select>
        <div className="md:col-span-2 flex items-center justify-end gap-3">
          {msg && <span className="text-sm text-gray-600">{msg}</span>}
          <Button type="submit" loading={saving}>Guardar</Button>
        </div>
      </form>
    </Card>
  );
}

function PlanInfo({ tenant, usage }: { tenant: TenantMe; usage: Usage }) {
  const profPct = (usage.usage.professionals / usage.plan.maxProfessionals) * 100;
  const apptPct = usage.plan.maxAppointmentsPerMonth
    ? (usage.usage.monthAppts / usage.plan.maxAppointmentsPerMonth) * 100
    : 0;

  return (
    <Card>
      <CardTitle>Plan actual</CardTitle>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-medium text-brand-800">{tenant.plan.name}</span>
        <span className="text-sm text-gray-600">USD {String(tenant.plan.priceMonthlyUsd)} / profesional / mes</span>
        {tenant.trialEndsAt && new Date(tenant.trialEndsAt) > new Date() && (
          <span className="text-xs text-amber-700">🎁 Trial hasta {formatDate(tenant.trialEndsAt)}</span>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <Bar label={`Profesionales: ${usage.usage.professionals} / ${usage.plan.maxProfessionals}`} pct={profPct} />
        <Bar label={`Citas este mes: ${usage.usage.monthAppts}${usage.plan.maxAppointmentsPerMonth ? ` / ${usage.plan.maxAppointmentsPerMonth}` : ' (ilimitadas)'}`}
             pct={apptPct} unlimited={!usage.plan.maxAppointmentsPerMonth} />
        <div className="flex justify-between text-sm">
          <span className="text-gray-700">WhatsApp recordatorios</span>
          <span className={usage.plan.whatsappEnabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
            {usage.plan.whatsappEnabled ? '✓ Incluido' : 'No incluido'}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-700">Teleconsulta</span>
          <span className={usage.plan.telehealthEnabled ? 'text-green-600 font-medium' : 'text-gray-400'}>
            {usage.plan.telehealthEnabled ? '✓ Incluido' : 'No incluido'}
          </span>
        </div>
      </div>
    </Card>
  );
}

function Bar({ label, pct, unlimited }: { label: string; pct: number; unlimited?: boolean }) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-brand-500';
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm"><span>{label}</span></div>
      <div className="h-2 w-full overflow-hidden rounded bg-gray-100">
        <div className={color + ' h-full transition-all'} style={{ width: unlimited ? '5%' : `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

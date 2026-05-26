'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';

interface DentalProcedure {
  id: string;
  toothNumber: string;
  surfaces: string[];
  condition: string;
  treatment?: string | null;
  cost?: string | number | null;
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  performedAt?: string | null;
  clinicalRecord: {
    id: string;
    createdAt: string;
    professional: { id: string; fullName: string };
  };
}

const CONDITION_LABEL: Record<string, string> = {
  HEALTHY: 'Sano',
  CARIES: 'Caries',
  FILLING_AMALGAM: 'Obturación amalgama',
  FILLING_RESIN: 'Obturación resina',
  FILLING_TEMP: 'Obturación temporal',
  CROWN: 'Corona',
  IMPLANT: 'Implante',
  EXTRACTION_NEEDED: 'Extracción necesaria',
  EXTRACTED: 'Extraído',
  ROOT_CANAL: 'Endodoncia',
  BRIDGE: 'Puente',
  SEALANT: 'Sellante',
  FRACTURE: 'Fractura',
  MOBILITY: 'Movilidad',
  ABSENT: 'Ausente',
};

const STATUS_INFO: Record<DentalProcedure['status'], { label: string; color: string; icon: string }> = {
  PLANNED:     { label: 'Planificado', color: 'bg-gray-100 text-gray-700 border-gray-200',     icon: '📋' },
  IN_PROGRESS: { label: 'En curso',    color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: '🔧' },
  COMPLETED:   { label: 'Terminado',   color: 'bg-green-100 text-green-700 border-green-200',  icon: '✅' },
  CANCELLED:   { label: 'Cancelado',   color: 'bg-red-100 text-red-700 border-red-200',        icon: '❌' },
};

function formatCop(n: string | number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));
}

export function DentalTreatmentPlan({ patientId }: { patientId: string }) {
  const role = useAuth((s) => s.user?.role);
  const canEdit = role === 'PROFESSIONAL' || role === 'CLINIC_OWNER';

  const [procedures, setProcedures] = useState<DentalProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | DentalProcedure['status']>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DentalProcedure[]>(`/api/dental/procedures/${patientId}`);
      setProcedures(data);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'ALL' ? procedures : procedures.filter((p) => p.status === filter);

  const totals = useMemo(() => {
    const t = {
      total: 0,
      planned: 0,
      inProgress: 0,
      completed: 0,
      cost: 0,
      costCompleted: 0,
      costPending: 0,
    };
    for (const p of procedures) {
      t.total++;
      const c = p.cost != null ? Number(p.cost) : 0;
      t.cost += c;
      if (p.status === 'PLANNED') { t.planned++; t.costPending += c; }
      if (p.status === 'IN_PROGRESS') { t.inProgress++; t.costPending += c; }
      if (p.status === 'COMPLETED') { t.completed++; t.costCompleted += c; }
    }
    return t;
  }, [procedures]);

  async function updateStatus(id: string, status: DentalProcedure['status']) {
    await apiFetch(`/api/dental/procedures/${id}/status`, {
      method: 'PATCH', body: { status },
    });
    load();
  }

  if (loading) return <Card className="text-sm text-gray-500">Cargando plan de tratamiento…</Card>;

  if (procedures.length === 0) {
    return (
      <Card className="text-center py-12">
        <div className="text-5xl mb-3">🦷</div>
        <h3 className="font-semibold text-gray-900">Sin plan de tratamiento</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-md mx-auto">
          Los procedimientos creados desde una nueva consulta dental con tipo
          DENTAL_TREATMENT aparecerán aquí con su costo, estado y total del plan.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen del plan */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Procedimientos" value={`${totals.completed}/${totals.total}`} hint={`${totals.planned} planificados`} />
        <SummaryCard label="Total del plan" value={formatCop(totals.cost)} highlight />
        <SummaryCard label="Cobrado" value={formatCop(totals.costCompleted)} tone="positive" />
        <SummaryCard label="Pendiente" value={formatCop(totals.costPending)} tone="warning" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>
          Todos ({procedures.length})
        </FilterChip>
        {(Object.keys(STATUS_INFO) as DentalProcedure['status'][]).map((s) => {
          const count = procedures.filter((p) => p.status === s).length;
          if (count === 0) return null;
          return (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {STATUS_INFO[s].icon} {STATUS_INFO[s].label} ({count})
            </FilterChip>
          );
        })}
      </div>

      {/* Tabla de procedimientos */}
      <Card className="overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Diente</th>
              <th className="px-4 py-3">Condición / Tratamiento</th>
              <th className="px-4 py-3">Profesional</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3 text-right">Costo</th>
              <th className="px-4 py-3">Estado</th>
              {canEdit && <th className="px-4 py-3"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((p) => (
              <tr key={p.id} className={p.status === 'CANCELLED' ? 'opacity-50' : ''}>
                <td className="px-4 py-3 font-mono font-semibold">{p.toothNumber}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{CONDITION_LABEL[p.condition] ?? p.condition}</div>
                  {p.surfaces.length > 0 && (
                    <div className="text-xs text-gray-500">
                      Sup: {p.surfaces.map((s) => s.charAt(0)).join(' ')}
                    </div>
                  )}
                  {p.treatment && <div className="text-xs text-gray-600 mt-0.5">{p.treatment}</div>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{p.clinicalRecord.professional.fullName}</td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {p.performedAt ? formatDate(p.performedAt) : formatDate(p.clinicalRecord.createdAt)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {p.cost != null ? formatCop(p.cost) : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', STATUS_INFO[p.status].color)}>
                    <span>{STATUS_INFO[p.status].icon}</span>
                    {STATUS_INFO[p.status].label}
                  </span>
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <StatusActions current={p.status} onChange={(s) => updateStatus(p.id, s)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                Total del plan
              </td>
              <td className="px-4 py-3 text-right text-base font-bold text-gray-900">
                {formatCop(totals.cost)}
              </td>
              <td colSpan={canEdit ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint, highlight, tone }: {
  label: string; value: string; hint?: string; highlight?: boolean;
  tone?: 'positive' | 'warning';
}) {
  return (
    <Card className={cn(
      'p-4',
      highlight && 'border-brand-300 bg-brand-50/30',
      tone === 'positive' && 'border-green-200',
      tone === 'warning' && 'border-amber-200',
    )}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={cn(
        'mt-1 text-xl font-bold',
        tone === 'positive' && 'text-green-700',
        tone === 'warning' && 'text-amber-700',
      )}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
    </Card>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
      )}
    >
      {children}
    </button>
  );
}

function StatusActions({
  current, onChange,
}: { current: DentalProcedure['status']; onChange: (s: DentalProcedure['status']) => void }) {
  if (current === 'COMPLETED' || current === 'CANCELLED') {
    return <span className="text-xs text-gray-400">—</span>;
  }
  if (current === 'PLANNED') {
    return (
      <div className="flex gap-1">
        <button onClick={() => onChange('IN_PROGRESS')} className="text-xs text-brand-600 hover:underline">Iniciar</button>
        <span className="text-gray-300">·</span>
        <button onClick={() => onChange('CANCELLED')} className="text-xs text-red-500 hover:underline">Cancelar</button>
      </div>
    );
  }
  if (current === 'IN_PROGRESS') {
    return (
      <button onClick={() => onChange('COMPLETED')} className="text-xs font-medium text-green-700 hover:underline">
        ✓ Terminar
      </button>
    );
  }
  return null;
}

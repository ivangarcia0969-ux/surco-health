'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SPECIALTY_LABEL, cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';

interface ClinicalService {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceParticular: string | number;
  priceInsurer?: string | number | null;
  specialty: string | null;
  defaultCieCode?: string | null;
  isActive: boolean;
}

const SPECIALTY_ICON: Record<string, string> = {
  MEDICAL_GENERAL: '🩺', DENTAL: '🦷', PSYCHOLOGY: '🧠', PSYCHIATRY: '💭',
  PEDIATRICS: '👶', GYNECOLOGY: '👩‍⚕️', DERMATOLOGY: '🧴', CARDIOLOGY: '❤️',
  NUTRITION: '🥗', PHYSIOTHERAPY: '💪', AESTHETICS: '💆', OPHTHALMOLOGY: '👁️',
  ORTHOPEDICS: '🦴', OTORHINOLARYNGOLOGY: '👂', OTHER: '📋',
};

function formatCop(n: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));
}

export default function CatalogoPage() {
  const role = useAuth((s) => s.user?.role);
  const isOwner = role === 'CLINIC_OWNER';

  const [items, setItems] = useState<ClinicalService[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<ClinicalService | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (includeInactive) params.set('includeInactive', 'true');
      if (search) params.set('q', search);
      const data = await apiFetch<ClinicalService[]>(`/api/catalog/services?${params}`);
      setItems(data);
    } finally { setLoading(false); }
  }, [includeInactive, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Agrupar por especialidad
  const grouped = useMemo(() => {
    const filtered = filter
      ? items.filter((s) => s.specialty === filter)
      : items;
    const groups = new Map<string, ClinicalService[]>();
    for (const s of filtered) {
      const key = s.specialty ?? 'OTHER';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return Array.from(groups.entries()).sort((a, b) =>
      (SPECIALTY_LABEL[a[0]] ?? a[0]).localeCompare(SPECIALTY_LABEL[b[0]] ?? b[0]),
    );
  }, [items, filter]);

  const specialtiesPresent = useMemo(() => {
    const set = new Set<string>();
    for (const s of items) if (s.specialty) set.add(s.specialty);
    return Array.from(set).sort();
  }, [items]);

  async function toggleActive(s: ClinicalService) {
    if (!isOwner) return;
    await apiFetch(`/api/catalog/services/${s.id}`, {
      method: 'PATCH',
      body: { isActive: !s.isActive },
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de servicios</h1>
          <p className="text-sm text-gray-500">
            {items.length} servicio{items.length === 1 ? '' : 's'}
            {specialtiesPresent.length > 0 && ` · ${specialtiesPresent.length} especialidad${specialtiesPresent.length === 1 ? '' : 'es'}`}
          </p>
        </div>
        {isOwner && (
          <Button onClick={() => { setEditing(null); setOpenForm(true); }}>
            + Nuevo servicio
          </Button>
        )}
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nombre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4"
          />
          Mostrar inactivos
        </label>
      </Card>

      {specialtiesPresent.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === null} onClick={() => setFilter(null)}>
            Todos ({items.length})
          </FilterChip>
          {specialtiesPresent.map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {SPECIALTY_ICON[s] ?? '📋'} {SPECIALTY_LABEL[s] ?? s} ({items.filter((i) => i.specialty === s).length})
            </FilterChip>
          ))}
        </div>
      )}

      {loading ? (
        <Card className="text-sm text-gray-500">Cargando…</Card>
      ) : grouped.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="font-semibold text-gray-900">Sin servicios todavía</h3>
          <p className="mt-2 text-sm text-gray-500">
            {isOwner ? 'Crea tu primer servicio clínico para que tus profesionales puedan agendar citas.' : 'El catálogo aún está vacío.'}
          </p>
          {isOwner && (
            <Button className="mt-4" onClick={() => { setEditing(null); setOpenForm(true); }}>
              + Crear primer servicio
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(([specialty, services]) => (
            <SpecialtySection
              key={specialty}
              specialty={specialty}
              services={services}
              isOwner={isOwner}
              onEdit={(s) => { setEditing(s); setOpenForm(true); }}
              onToggle={toggleActive}
            />
          ))}
        </div>
      )}

      {isOwner && (
        <ServiceForm
          open={openForm}
          editing={editing}
          onClose={() => { setOpenForm(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}

function FilterChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function SpecialtySection({
  specialty, services, isOwner, onEdit, onToggle,
}: {
  specialty: string;
  services: ClinicalService[];
  isOwner: boolean;
  onEdit: (s: ClinicalService) => void;
  onToggle: (s: ClinicalService) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 hover:bg-gray-50"
      >
        <h3 className="font-semibold text-gray-900">
          <span className="mr-2 text-xl">{SPECIALTY_ICON[specialty] ?? '📋'}</span>
          {SPECIALTY_LABEL[specialty] ?? specialty}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({services.length} servicio{services.length === 1 ? '' : 's'})
          </span>
        </h3>
        <span className="text-gray-400">{expanded ? '▾' : '▸'}</span>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-100 border-t border-gray-200">
          {services.map((s) => (
            <ServiceRow key={s.id} service={s} isOwner={isOwner} onEdit={onEdit} onToggle={onToggle} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ServiceRow({
  service: s, isOwner, onEdit, onToggle,
}: {
  service: ClinicalService;
  isOwner: boolean;
  onEdit: (s: ClinicalService) => void;
  onToggle: (s: ClinicalService) => void;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 py-4', !s.isActive && 'opacity-50')}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-gray-900">{s.name}</h4>
          {!s.isActive && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Inactivo</span>}
          {s.defaultCieCode && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-mono text-brand-700">CIE-10: {s.defaultCieCode}</span>}
        </div>
        {s.description && <p className="mt-1 text-sm text-gray-600">{s.description}</p>}
        <p className="mt-1 text-xs text-gray-500">⏱ {s.durationMinutes} minutos</p>
      </div>
      <div className="text-right">
        <div className="text-sm">
          <span className="text-gray-500">Particular:</span>
          <span className="ml-1 font-semibold text-gray-900">{formatCop(s.priceParticular)}</span>
        </div>
        {s.priceInsurer != null && (
          <div className="text-sm">
            <span className="text-gray-500">EPS:</span>
            <span className="ml-1 font-semibold text-gray-900">{formatCop(s.priceInsurer)}</span>
          </div>
        )}
        {isOwner && (
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => onEdit(s)}>Editar</Button>
            <Button size="sm" variant={s.isActive ? 'ghost' : 'primary'} onClick={() => onToggle(s)}>
              {s.isActive ? 'Pausar' : 'Activar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceForm({
  open, editing, onClose, onSaved,
}: {
  open: boolean;
  editing: ClinicalService | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    durationMinutes: '30',
    priceParticular: '',
    priceInsurer: '',
    specialty: 'MEDICAL_GENERAL',
    defaultCieCode: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description ?? '',
        durationMinutes: String(editing.durationMinutes),
        priceParticular: String(editing.priceParticular),
        priceInsurer: editing.priceInsurer != null ? String(editing.priceInsurer) : '',
        specialty: editing.specialty ?? 'MEDICAL_GENERAL',
        defaultCieCode: editing.defaultCieCode ?? '',
        isActive: editing.isActive,
      });
    } else {
      setForm({
        name: '', description: '', durationMinutes: '30',
        priceParticular: '', priceInsurer: '',
        specialty: 'MEDICAL_GENERAL', defaultCieCode: '',
        isActive: true,
      });
    }
  }, [editing, open]);

  function set<K extends keyof typeof form>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || undefined,
        durationMinutes: parseInt(form.durationMinutes),
        priceParticular: parseFloat(form.priceParticular),
        priceInsurer: form.priceInsurer ? parseFloat(form.priceInsurer) : undefined,
        specialty: form.specialty,
        defaultCieCode: form.defaultCieCode || undefined,
      };
      if (editing) payload.isActive = form.isActive;

      if (editing) {
        await apiFetch(`/api/catalog/services/${editing.id}`, { method: 'PATCH', body: payload });
      } else {
        await apiFetch('/api/catalog/services', { method: 'POST', body: payload });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError('No fue posible guardar el servicio.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar servicio' : 'Nuevo servicio'} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Nombre del servicio"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required minLength={2}
          placeholder="Ej: Consulta odontológica de primera vez"
        />

        <Textarea
          label="Descripción (opcional)"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          maxLength={500}
          placeholder="Lo que se hace en esta consulta…"
        />

        <div className="grid grid-cols-2 gap-3">
          <Select label="Especialidad" value={form.specialty} onChange={(e) => set('specialty', e.target.value)} required>
            {Object.entries(SPECIALTY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{SPECIALTY_ICON[k]} {v}</option>
            ))}
          </Select>
          <Input
            label="Duración (minutos)"
            type="number"
            min={5}
            max={600}
            value={form.durationMinutes}
            onChange={(e) => set('durationMinutes', e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Precio particular (COP)"
            type="number"
            min={0}
            step="1000"
            value={form.priceParticular}
            onChange={(e) => set('priceParticular', e.target.value)}
            required
            placeholder="120000"
          />
          <Input
            label="Precio con EPS (COP, opcional)"
            type="number"
            min={0}
            step="1000"
            value={form.priceInsurer}
            onChange={(e) => set('priceInsurer', e.target.value)}
            placeholder="60000"
            hint="Si la EPS paga un valor distinto"
          />
        </div>

        <Input
          label="Código CIE-10 sugerido (opcional)"
          value={form.defaultCieCode}
          onChange={(e) => set('defaultCieCode', e.target.value.toUpperCase())}
          maxLength={10}
          placeholder="Z00.0"
          hint="Se autocompletará en el diagnóstico al usar este servicio"
        />

        {editing && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
              className="h-4 w-4"
            />
            Servicio activo
          </label>
        )}

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>{editing ? 'Guardar cambios' : 'Crear servicio'}</Button>
        </div>
      </form>
    </Modal>
  );
}

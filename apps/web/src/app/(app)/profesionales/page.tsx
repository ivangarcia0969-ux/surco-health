'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime, SPECIALTY_LABEL } from '@/lib/utils';

interface Professional {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  specialty: string | null;
  licenseNumber?: string | null;
  licenseAuthority?: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export default function ProfesionalesPage() {
  const [items, setItems] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<Professional[]>('/api/users/professionals');
    setItems(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(p: Professional) {
    await apiFetch(`/api/users/${p.id}`, { method: 'PATCH', body: { isActive: !p.isActive } });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profesionales</h1>
          <p className="text-sm text-gray-500">{items.length} profesional{items.length === 1 ? '' : 'es'} en tu clínica</p>
        </div>
        <Button onClick={() => setOpenForm(true)}>+ Añadir profesional</Button>
      </div>

      {loading ? (
        <Card className="text-sm text-gray-500">Cargando…</Card>
      ) : items.length === 0 ? (
        <Card className="text-center text-sm text-gray-500">
          No hay profesionales aún. Crea el primero para empezar a tomar citas.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Profesional</th>
                <th className="px-4 py-3">Especialidad</th>
                <th className="px-4 py-3">Licencia</th>
                <th className="px-4 py-3">Último acceso</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((p) => (
                <tr key={p.id} className={!p.isActive ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {p.fullName}
                      {!p.isActive && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">Inactivo</span>}
                    </div>
                    <div className="text-xs text-gray-500">{p.email} {p.phone && `· ${p.phone}`}</div>
                  </td>
                  <td className="px-4 py-3">
                    {p.specialty ? (SPECIALTY_LABEL[p.specialty] ?? p.specialty) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {p.licenseNumber ?? '—'}
                    {p.licenseAuthority && <div className="text-gray-400">{p.licenseAuthority}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.lastLoginAt ? formatDateTime(p.lastLoginAt) : 'Nunca'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant={p.isActive ? 'secondary' : 'primary'} onClick={() => toggleActive(p)}>
                      {p.isActive ? 'Deshabilitar' : 'Habilitar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ProfessionalForm open={openForm} onClose={() => setOpenForm(false)} onCreated={load} />
    </div>
  );
}

function ProfessionalForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    specialty: 'MEDICAL_GENERAL',
    licenseNumber: '',
    licenseAuthority: 'Minsalud Colombia',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/users/professionals', {
        method: 'POST',
        body: { ...form, phone: form.phone || undefined },
      });
      setForm({ fullName: '', email: '', phone: '', password: '', specialty: 'MEDICAL_GENERAL', licenseNumber: '', licenseAuthority: 'Minsalud Colombia' });
      onCreated();
      onClose();
    } catch (err: any) {
      if (err.message === 'PLAN_LIMIT_EXCEEDED') {
        const d = err.details as { current: number; max: number; planTier: string };
        setError(`Llegaste al límite de tu plan ${d.planTier} (${d.current}/${d.max}). Actualiza tu plan para añadir más profesionales.`);
      } else if (err.message === 'EMAIL_TAKEN') {
        setError('Ese email ya está registrado.');
      } else {
        setError('No fue posible crear el profesional.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Añadir profesional" size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Nombre completo" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required minLength={2} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
        <Input label="Teléfono" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        <Input label="Contraseña" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} hint="Mínimo 8 caracteres" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select label="Especialidad" value={form.specialty} onChange={(e) => set('specialty', e.target.value)} required>
            {Object.entries(SPECIALTY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="N° de licencia / RM" value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} required />
        </div>
        <Input label="Autoridad emisora" value={form.licenseAuthority} onChange={(e) => set('licenseAuthority', e.target.value)} required />

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>Crear profesional</Button>
        </div>
      </form>
    </Modal>
  );
}

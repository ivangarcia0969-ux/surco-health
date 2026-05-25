'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { addDays, formatTime, isoDate, SPECIALTY_LABEL } from '@/lib/utils';

interface Appointment {
  id: string; startsAt: string; endsAt: string; status: string; channel: string;
  patient: { id: string; fullName: string; phone?: string | null; documentId: string };
  professional: { id: string; fullName: string; specialty: string | null };
  service?: { id: string; name: string } | null;
  room?: { id: string; name: string } | null;
}

const STATUS: Record<string, { label: string; classes: string }> = {
  REQUESTED:   { label: 'Solicitada', classes: 'bg-gray-100 text-gray-700' },
  CONFIRMED:   { label: 'Confirmada', classes: 'bg-blue-100 text-blue-800' },
  CHECKED_IN:  { label: 'Check-in', classes: 'bg-indigo-100 text-indigo-800' },
  IN_PROGRESS: { label: 'En curso', classes: 'bg-yellow-100 text-yellow-800' },
  ATTENDED:    { label: 'Atendida', classes: 'bg-green-100 text-green-800' },
  NO_SHOW:     { label: 'No asistió', classes: 'bg-red-100 text-red-700' },
  CANCELLED:   { label: 'Cancelada', classes: 'bg-gray-200 text-gray-600' },
};

export default function AgendaPage() {
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(`${date}T00:00:00`).toISOString();
      const to = new Date(`${date}T23:59:59`).toISOString();
      const res = await apiFetch<Appointment[]>(`/api/appointments?from=${from}&to=${to}`);
      setItems(res);
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const byProf = useMemo(() => {
    const groups = new Map<string, { name: string; specialty: string | null; items: Appointment[] }>();
    for (const it of items) {
      const g = groups.get(it.professional.id);
      if (g) g.items.push(it);
      else groups.set(it.professional.id, { name: it.professional.fullName, specialty: it.professional.specialty, items: [it] });
    }
    return Array.from(groups.entries()).map(([id, v]) => ({ id, ...v }));
  }, [items]);

  async function updateStatus(id: string, status: string) {
    await apiFetch(`/api/appointments/${id}`, { method: 'PATCH', body: { status } });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500">Citas del día agrupadas por profesional</p>
        </div>
        <Button onClick={() => setOpenForm(true)}>+ Nueva cita</Button>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => setDate(isoDate(addDays(new Date(date), -1)))}>← Anterior</Button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        <Button size="sm" variant="secondary" onClick={() => setDate(isoDate(addDays(new Date(date), 1)))}>Siguiente →</Button>
        <Button size="sm" variant="ghost" onClick={() => setDate(isoDate(new Date()))}>Hoy</Button>
        <div className="ml-auto text-sm text-gray-500">{items.length} cita{items.length === 1 ? '' : 's'}</div>
      </Card>

      {loading ? <Card className="text-sm text-gray-500">Cargando…</Card>
        : items.length === 0 ? <Card className="text-center text-sm text-gray-500">No hay citas para este día.</Card>
        : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {byProf.map((g) => (
            <Card key={g.id}>
              <h3 className="mb-3 font-semibold text-gray-900">
                {g.name}
                {g.specialty && <span className="ml-2 text-xs font-normal text-gray-500">{SPECIALTY_LABEL[g.specialty]}</span>}
              </h3>
              <ul className="divide-y divide-gray-100">
                {g.items
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                  .map((a) => (
                    <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatTime(a.startsAt)} – {formatTime(a.endsAt)}</span>
                          <span className={'rounded-full px-2 py-0.5 text-xs font-medium ' + STATUS[a.status].classes}>{STATUS[a.status].label}</span>
                          {a.channel === 'TELEHEALTH' && <span className="text-xs">🎥</span>}
                        </div>
                        <div className="mt-1 text-sm">{a.patient.fullName}</div>
                        <div className="text-xs text-gray-500">{a.service?.name ?? 'Sin servicio'} {a.room ? `· ${a.room.name}` : ''}</div>
                      </div>
                      <div className="flex gap-1">
                        {a.status === 'CONFIRMED' && <Button size="sm" variant="secondary" onClick={() => updateStatus(a.id, 'CHECKED_IN')}>Check-in</Button>}
                        {(a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS') && <Button size="sm" onClick={() => updateStatus(a.id, 'ATTENDED')}>Finalizar</Button>}
                        {['CONFIRMED', 'CHECKED_IN'].includes(a.status) && <Button size="sm" variant="ghost" onClick={() => updateStatus(a.id, 'CANCELLED')}>Cancelar</Button>}
                      </div>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <AppointmentForm open={openForm} onClose={() => setOpenForm(false)} onCreated={load} defaultDate={date} />
    </div>
  );
}

function AppointmentForm({
  open, onClose, onCreated, defaultDate,
}: { open: boolean; onClose: () => void; onCreated: () => void; defaultDate: string }) {
  const [patients, setPatients] = useState<{ id: string; fullName: string }[]>([]);
  const [professionals, setProfs] = useState<{ id: string; fullName: string; specialty: string | null }[]>([]);
  const [services, setServices] = useState<{ id: string; name: string; durationMinutes: number }[]>([]);
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<{ data: any[] }>('/api/patients?pageSize=100'),
      apiFetch<any[]>('/api/users/professionals'),
      apiFetch<any[]>('/api/tenants/me').then(async () => apiFetch<any[]>(`/api/tenants/me`)).then(() => apiFetch<any[]>(`/api/appointments?from=${new Date().toISOString()}&to=${new Date().toISOString()}`)).catch(() => []),
    ]).then(([p, pr]) => {
      setPatients(p.data);
      setProfs(pr.filter((x: any) => x.isActive));
    });
    // Services
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/tenants/me`).catch(() => {});
  }, [open]);

  useEffect(() => { setDate(defaultDate); }, [defaultDate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!patientId || !professionalId) { setError('Selecciona paciente y profesional.'); return; }
    setSubmitting(true);
    try {
      const startsAt = new Date(`${date}T${time}:00`).toISOString();
      await apiFetch('/api/appointments', {
        method: 'POST',
        body: {
          patientId, professionalId,
          serviceId: serviceId || undefined,
          startsAt, reason: reason || undefined,
        },
      });
      onCreated(); onClose();
      setPatientId(''); setServiceId(''); setReason('');
    } catch (err: any) {
      setError(err.message === 'TIME_SLOT_CONFLICT'
        ? 'El profesional ya tiene una cita en ese horario.'
        : 'No fue posible crear la cita.');
    } finally { setSubmitting(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva cita" size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <Select label="Paciente" value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
          <option value="">— Selecciona —</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </Select>
        <Select label="Profesional" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required>
          <option value="">— Selecciona —</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} {p.specialty ? `· ${SPECIALTY_LABEL[p.specialty]}` : ''}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="Hora" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <Input label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>Crear cita</Button>
        </div>
      </form>
    </Modal>
  );
}

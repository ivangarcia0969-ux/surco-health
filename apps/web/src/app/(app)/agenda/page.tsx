'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { useAuth } from '@/lib/auth-store';
import { addDays, cn, formatCop, formatTime, isoDate, SPECIALTY_LABEL, whatsappLink } from '@/lib/utils';

interface Appointment {
  id: string; startsAt: string; endsAt: string; status: string; channel: string;
  reason?: string | null;
  patient: { id: string; fullName: string; phone?: string | null; documentId: string };
  professional: { id: string; fullName: string; specialty: string | null };
  service?: { id: string; name: string } | null;
  room?: { id: string; name: string } | null;
}

const STATUS: Record<string, { label: string; classes: string; dot: string }> = {
  REQUESTED:   { label: 'Solicitada', classes: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  CONFIRMED:   { label: 'Confirmada', classes: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  CHECKED_IN:  { label: 'En sala de espera', classes: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
  IN_PROGRESS: { label: 'En consulta', classes: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  ATTENDED:    { label: 'Atendida', classes: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  NO_SHOW:     { label: 'No asistió', classes: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  CANCELLED:   { label: 'Cancelada', classes: 'bg-gray-200 text-gray-500', dot: 'bg-gray-300' },
};

export default function AgendaPage() {
  return (
    <Suspense fallback={<Card className="h-40 animate-pulse bg-gray-100" />}>
      <Agenda />
    </Suspense>
  );
}

function Agenda() {
  const router = useRouter();
  const search = useSearchParams();
  const role = useAuth((s) => s.user?.role);
  const clinical = role === 'CLINIC_OWNER' || role === 'PROFESSIONAL';
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [presetPatient, setPresetPatient] = useState<string | undefined>(undefined);
  const [clinicName, setClinicName] = useState('');

  // Desde la ficha del paciente: /agenda?paciente=<id> abre el formulario con el paciente elegido
  useEffect(() => {
    const p = search.get('paciente');
    if (p) { setPresetPatient(p); setOpenForm(true); }
    else if (search.get('nueva')) setOpenForm(true);
  }, [search]);

  useEffect(() => {
    apiFetch<{ tradeName: string }>('/api/tenants/me').then((t) => setClinicName(t.tradeName)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = new Date(`${date}T00:00:00`).toISOString();
      const to = new Date(`${date}T23:59:59`).toISOString();
      const res = await apiFetch<Appointment[]>(`/api/appointments?from=${from}&to=${to}`);
      setItems(res);
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible cargar la agenda.'));
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

  const counts = useMemo(() => {
    const active = items.filter((a) => a.status !== 'CANCELLED');
    return {
      total: active.length,
      attended: items.filter((a) => a.status === 'ATTENDED').length,
      waiting: items.filter((a) => a.status === 'CHECKED_IN').length,
      pending: items.filter((a) => ['CONFIRMED', 'REQUESTED'].includes(a.status)).length,
    };
  }, [items]);

  async function updateStatus(a: Appointment, status: string) {
    try {
      await apiFetch(`/api/appointments/${a.id}`, { method: 'PATCH', body: { status } });
      toast.success(`${a.patient.fullName}: ${STATUS[status].label.toLowerCase()}`);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const isToday = date === isoDate(new Date());
  const longDate = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${date}T12:00:00`));

  function reminderLink(a: Appointment) {
    const when = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(a.startsAt));
    return whatsappLink(
      a.patient.phone,
      `Hola ${a.patient.fullName.split(' ')[0]} 👋, te recordamos tu cita ${a.service ? `de ${a.service.name} ` : ''}el ${when} a las ${formatTime(a.startsAt)} con ${a.professional.fullName}${clinicName ? ` en ${clinicName}` : ''}. Por favor responde SÍ para confirmar. 🦷`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500 first-letter:uppercase">{longDate}{isToday ? ' · hoy' : ''}</p>
        </div>
        <Button onClick={() => { setPresetPatient(undefined); setOpenForm(true); }}>+ Nueva cita</Button>
      </div>

      <Card className="flex flex-wrap items-center gap-2 p-4">
        <Button size="sm" variant="secondary" onClick={() => setDate(isoDate(addDays(new Date(`${date}T12:00:00`), -1)))}>←</Button>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
               className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        <Button size="sm" variant="secondary" onClick={() => setDate(isoDate(addDays(new Date(`${date}T12:00:00`), 1)))}>→</Button>
        {!isToday && <Button size="sm" variant="ghost" onClick={() => setDate(isoDate(new Date()))}>Hoy</Button>}
        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          <Chip label="Citas" value={counts.total} />
          <Chip label="Por atender" value={counts.pending} tone="blue" />
          <Chip label="En espera" value={counts.waiting} tone="indigo" />
          <Chip label="Atendidas" value={counts.attended} tone="green" />
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="py-14 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl">🗓️</div>
          <p className="mt-3 text-sm font-medium text-gray-900">No hay citas para este día</p>
          <Button className="mt-4" size="sm" onClick={() => setOpenForm(true)}>+ Agendar cita</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {byProf.map((g) => (
            <Card key={g.id} className="p-0">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{g.name}</h3>
                  {g.specialty && <span className="text-xs text-gray-500">{SPECIALTY_LABEL[g.specialty]}</span>}
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {g.items.filter((a) => a.status !== 'CANCELLED').length} citas
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {g.items
                  .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                  .map((a) => {
                    const st = STATUS[a.status] ?? STATUS.CONFIRMED;
                    const wa = ['CONFIRMED', 'REQUESTED'].includes(a.status) ? reminderLink(a) : null;
                    return (
                      <li key={a.id} className={cn('flex gap-3 px-5 py-3', a.status === 'CANCELLED' && 'opacity-50')}>
                        <div className="w-[68px] shrink-0 whitespace-nowrap text-center">
                          <div className="font-mono text-sm font-semibold text-gray-900">{formatTime(a.startsAt)}</div>
                          <div className="font-mono text-[11px] text-gray-400">{formatTime(a.endsAt)}</div>
                        </div>
                        <div className={cn('w-1 shrink-0 rounded-full', st.dot)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/pacientes/${a.patient.id}`} className="truncate font-medium text-gray-900 hover:text-brand-700">
                              {a.patient.fullName}
                            </Link>
                            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', st.classes)}>{st.label}</span>
                            {a.channel === 'TELEHEALTH' && <span className="text-xs">🎥</span>}
                          </div>
                          <div className="truncate text-xs text-gray-500">
                            {a.service?.name ?? a.reason ?? 'Consulta'} {a.room ? `· ${a.room.name}` : ''}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {clinical && ['CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'REQUESTED'].includes(a.status) && (
                              <Button size="sm" onClick={() => router.push(`/pacientes/${a.patient.id}?atender=${a.id}`)}>
                                {a.status === 'IN_PROGRESS' ? 'Continuar' : 'Atender'}
                              </Button>
                            )}
                            {a.status === 'CONFIRMED' && (
                              <Button size="sm" variant="secondary" onClick={() => updateStatus(a, 'CHECKED_IN')}>Llegó</Button>
                            )}
                            {wa && (
                              <a href={wa} target="_blank" rel="noreferrer"
                                 className="inline-flex items-center rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100">
                                Recordar por WhatsApp
                              </a>
                            )}
                            {!clinical && (a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS') && (
                              <Button size="sm" variant="secondary" onClick={() => updateStatus(a, 'ATTENDED')}>Finalizar</Button>
                            )}
                            {['CONFIRMED', 'REQUESTED'].includes(a.status) && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => updateStatus(a, 'NO_SHOW')}>No asistió</Button>
                                <Button size="sm" variant="ghost" onClick={() => updateStatus(a, 'CANCELLED')}>Cancelar</Button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <AppointmentForm
        open={openForm}
        onClose={() => { setOpenForm(false); if (search.get('paciente') || search.get('nueva')) router.replace('/agenda'); }}
        onCreated={(d) => { if (d !== date) setDate(d); else load(); }}
        defaultDate={date}
        presetPatientId={presetPatient}
      />
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: number; tone?: 'blue' | 'indigo' | 'green' }) {
  return (
    <span className={cn('rounded-full px-3 py-1 font-medium',
      tone === 'blue' ? 'bg-blue-50 text-blue-700'
        : tone === 'indigo' ? 'bg-indigo-50 text-indigo-700'
        : tone === 'green' ? 'bg-green-50 text-green-700'
        : 'bg-gray-100 text-gray-700')}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

interface ServiceOpt { id: string; name: string; durationMinutes: number; priceParticular: string | number; specialty: string | null }

function AppointmentForm({
  open, onClose, onCreated, defaultDate, presetPatientId,
}: {
  open: boolean; onClose: () => void; onCreated: (date: string) => void;
  defaultDate: string; presetPatientId?: string;
}) {
  const user = useAuth((s) => s.user);
  const [patients, setPatients] = useState<{ id: string; fullName: string; documentId: string }[]>([]);
  const [professionals, setProfs] = useState<{ id: string; fullName: string; specialty: string | null; isActive: boolean }[]>([]);
  const [services, setServices] = useState<ServiceOpt[]>([]);
  const [patientQuery, setPatientQuery] = useState('');
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      apiFetch<{ data: { id: string; fullName: string; documentId: string }[] }>('/api/patients?pageSize=100'),
      apiFetch<{ id: string; fullName: string; specialty: string | null; isActive: boolean }[]>('/api/users/professionals'),
      apiFetch<ServiceOpt[]>('/api/catalog/services').catch(() => [] as ServiceOpt[]),
    ]).then(([p, pr, sv]) => {
      setPatients(p.data);
      const active = pr.filter((x) => x.isActive);
      setProfs(active);
      setServices(sv);
      if (user?.role === 'PROFESSIONAL') setProfessionalId(user.id);
      else if (active.length === 1) setProfessionalId(active[0].id);
      if (presetPatientId) {
        setPatientId(presetPatientId);
        const found = p.data.find((x) => x.id === presetPatientId);
        if (found) setPatientQuery(found.fullName);
      }
    }).catch((err) => toast.error(errorMessage(err, 'No se pudieron cargar los datos.')));
  }, [open, presetPatientId, user]);

  useEffect(() => { setDate(defaultDate); }, [defaultDate]);

  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q) return patients.slice(0, 8);
    return patients.filter((p) => p.fullName.toLowerCase().includes(q) || p.documentId.includes(q)).slice(0, 8);
  }, [patients, patientQuery]);

  const selectedProf = professionals.find((p) => p.id === professionalId);
  const visibleServices = selectedProf?.specialty
    ? services.filter((s) => !s.specialty || s.specialty === selectedProf.specialty)
    : services;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId || !professionalId) { toast.error('Selecciona paciente y profesional.'); return; }
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
      toast.success('Cita agendada');
      onCreated(date); onClose();
      setPatientId(''); setPatientQuery(''); setServiceId(''); setReason('');
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible crear la cita.'));
    } finally { setSubmitting(false); }
  }

  const selectedPatient = patients.find((p) => p.id === patientId);

  return (
    <Modal open={open} onClose={onClose} title="Nueva cita" size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Paciente</label>
          {selectedPatient ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
              <span className="text-sm font-medium text-brand-800">{selectedPatient.fullName} <span className="text-xs text-brand-600">· {selectedPatient.documentId}</span></span>
              <button type="button" onClick={() => { setPatientId(''); setPatientQuery(''); }} className="text-xs text-brand-700 hover:underline">Cambiar</button>
            </div>
          ) : (
            <>
              <Input placeholder="Buscar por nombre o documento…" value={patientQuery} onChange={(e) => setPatientQuery(e.target.value)} autoFocus />
              <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-100">
                {filteredPatients.map((p) => (
                  <button key={p.id} type="button" onClick={() => { setPatientId(p.id); setPatientQuery(p.fullName); }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50">
                    <span>{p.fullName}</span><span className="text-xs text-gray-400">{p.documentId}</span>
                  </button>
                ))}
                {filteredPatients.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-500">Sin resultados. <Link href="/pacientes" className="text-brand-600 hover:underline">Crear paciente</Link></div>
                )}
              </div>
            </>
          )}
        </div>
        <Select label="Profesional" value={professionalId} onChange={(e) => { setProfessionalId(e.target.value); setServiceId(''); }} required
                disabled={user?.role === 'PROFESSIONAL'}>
          <option value="">— Selecciona —</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName} {p.specialty ? `· ${SPECIALTY_LABEL[p.specialty]}` : ''}
            </option>
          ))}
        </Select>
        <Select label="Servicio" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">— Consulta general (30 min) —</option>
          {visibleServices.map((s) => (
            <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {formatCop(s.priceParticular)}</option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <Input label="Hora" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
        </div>
        <Input label="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. dolor en molar inferior derecho" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>Agendar cita</Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { calcAge } from '@/lib/utils';

interface PatientRow {
  id: string;
  documentType: string;
  documentId: string;
  fullName: string;
  birthdate: string;
  gender: string;
  phone?: string | null;
  email?: string | null;
}

interface ListResp {
  data: PatientRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export default function PatientsPage() {
  const [q, setQ] = useState('');
  const [data, setData] = useState<PatientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: '50' });
    if (q) params.set('q', q);
    const res = await apiFetch<ListResp>(`/api/patients?${params}`);
    setData(res.data); setTotal(res.pagination.total);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500">{total} en total</p>
        </div>
        <Button onClick={() => setOpenForm(true)}>+ Nuevo paciente</Button>
      </div>

      <Card>
        <Input placeholder="Buscar por nombre, documento, teléfono o email…" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>

      <Card className="overflow-x-auto p-0">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Cargando…</p>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Sin pacientes.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Paciente</th>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Edad</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{p.fullName}</td>
                  <td className="px-4 py-3 text-gray-600">{p.documentType} {p.documentId}</td>
                  <td className="px-4 py-3 text-gray-600">{calcAge(p.birthdate)} años</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {p.phone ?? '—'}{p.email ? ` · ${p.email}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/pacientes/${p.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      Abrir HCE →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <PatientForm open={openForm} onClose={() => setOpenForm(false)} onCreated={load} />
    </div>
  );
}

function PatientForm({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    documentType: 'CC',
    documentId: '',
    fullName: '',
    birthdate: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY' | 'OTHER',
    phone: '',
    email: '',
    acceptedPrivacy: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.acceptedPrivacy) {
      setError('Debes confirmar que el paciente aceptó la política de privacidad.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/patients', {
        method: 'POST',
        body: {
          ...form,
          birthdate: new Date(`${form.birthdate}T00:00:00`).toISOString(),
          email: form.email || undefined,
        },
      });
      setForm({ documentType: 'CC', documentId: '', fullName: '', birthdate: '', gender: 'MALE', phone: '', email: '', acceptedPrivacy: false });
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message === 'PATIENT_DOCUMENT_TAKEN' ? 'Ya existe un paciente con ese documento.' : 'No fue posible crear el paciente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuevo paciente" size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Select label="Tipo doc." value={form.documentType} onChange={(e) => set('documentType', e.target.value)}>
            <option value="CC">CC</option>
            <option value="TI">TI</option>
            <option value="CE">CE</option>
            <option value="RC">RC</option>
            <option value="PA">Pasaporte</option>
            <option value="RFC">RFC</option>
            <option value="DNI">DNI</option>
            <option value="OTHER">Otro</option>
          </Select>
          <div className="md:col-span-2">
            <Input label="Número de documento" value={form.documentId} onChange={(e) => set('documentId', e.target.value)} required />
          </div>
          <div className="md:col-span-3">
            <Input label="Nombre completo" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required minLength={2} />
          </div>
          <Input label="Fecha de nacimiento" type="date" value={form.birthdate} onChange={(e) => set('birthdate', e.target.value)} required />
          <Select label="Género" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            <option value="FEMALE">Femenino</option>
            <option value="MALE">Masculino</option>
            <option value="NON_BINARY">No binario</option>
            <option value="PREFER_NOT_TO_SAY">Prefiero no decir</option>
            <option value="OTHER">Otro</option>
          </Select>
          <div />
          <Input label="Teléfono" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          <div className="md:col-span-2">
            <Input label="Email (opcional)" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-gray-700">
          <input type="checkbox" checked={form.acceptedPrivacy} onChange={(e) => set('acceptedPrivacy', e.target.checked)} className="mt-0.5 h-4 w-4" required />
          <span>
            <strong>Habeas Data:</strong> Confirmo que el paciente firmó (en papel o digital) la aceptación
            de tratamiento de sus datos personales y la política de privacidad de la clínica.
            La fecha y versión quedan registradas para fines de auditoría.
          </span>
        </label>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>Crear paciente</Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Odontogram, ConditionPalette, type Condition, type ChartState } from '@/components/clinical/Odontogram';
import { calcAge, cn, formatDate, formatDateTime } from '@/lib/utils';

interface Patient {
  id: string;
  fullName: string;
  documentType: string;
  documentId: string;
  birthdate: string;
  gender: string;
  phone?: string | null;
  email?: string | null;
  bloodType: string;
  allergiesSummary?: string | null;
  insurerName?: string | null;
  insurerPlan?: string | null;
  privacyAcceptedAt?: string | null;
  dentalChart?: { state: Record<string, Record<string, string>>; numbering: string } | null;
}

interface ClinicalRecord {
  id: string;
  type: string;
  createdAt: string;
  signedAt?: string | null;
  professional: { id: string; fullName: string; specialty: string | null };
  structuredData: any;
}

type Tab = 'overview' | 'records' | 'odontogram' | 'vitals';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [p, r] = await Promise.all([
      apiFetch<Patient>(`/api/patients/${id}`),
      apiFetch<ClinicalRecord[]>(`/api/clinical/records?patientId=${id}`),
    ]);
    setPatient(p); setRecords(r);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card className="text-sm text-gray-500">Cargando…</Card>;
  if (!patient) return <Card className="text-sm text-red-600">Paciente no encontrado.</Card>;

  return (
    <div className="space-y-6">
      <Link href="/pacientes" className="text-sm text-brand-600 hover:underline">← Pacientes</Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{patient.fullName}</h1>
            <p className="text-sm text-gray-500">
              {patient.documentType} {patient.documentId} · {calcAge(patient.birthdate)} años · {translateGender(patient.gender)}
            </p>
            <p className="text-xs text-gray-500">
              {patient.phone ?? 'Sin teléfono'} {patient.email ? `· ${patient.email}` : ''}
            </p>
          </div>
          <div className="text-right">
            {patient.bloodType !== 'UNKNOWN' && (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                Sangre: {patient.bloodType.replace('_POS', '+').replace('_NEG', '−')}
              </span>
            )}
            {patient.allergiesSummary && (
              <p className="mt-1 text-xs text-amber-700">⚠️ Alergias: {patient.allergiesSummary}</p>
            )}
          </div>
        </div>
      </Card>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6 text-sm">
          <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Resumen</TabBtn>
          <TabBtn active={tab === 'records'} onClick={() => setTab('records')}>HCE ({records.length})</TabBtn>
          <TabBtn active={tab === 'odontogram'} onClick={() => setTab('odontogram')}>Odontograma</TabBtn>
          <TabBtn active={tab === 'vitals'} onClick={() => setTab('vitals')}>Signos vitales</TabBtn>
        </nav>
      </div>

      {tab === 'overview' && <OverviewTab patient={patient} />}
      {tab === 'records' && <RecordsTab records={records} />}
      {tab === 'odontogram' && <OdontogramTab patient={patient} onSaved={load} />}
      {tab === 'vitals' && <VitalSignsTab patientId={patient.id} onSaved={load} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
            className={cn(
              'border-b-2 px-1 py-3 font-medium transition',
              active ? 'border-brand-500 text-brand-700' : 'border-transparent text-gray-600 hover:text-gray-800',
            )}>
      {children}
    </button>
  );
}

function translateGender(g: string) {
  return { MALE: 'Masculino', FEMALE: 'Femenino', NON_BINARY: 'No binario', PREFER_NOT_TO_SAY: 'Prefiere no decir', OTHER: 'Otro' }[g] ?? g;
}

function OverviewTab({ patient }: { patient: Patient }) {
  return (
    <Card>
      <CardTitle>Información del paciente</CardTitle>
      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
        <Field label="Documento">{patient.documentType} {patient.documentId}</Field>
        <Field label="Fecha de nacimiento">{formatDate(patient.birthdate)}</Field>
        <Field label="Tipo de sangre">{patient.bloodType.replace('_POS', '+').replace('_NEG', '−')}</Field>
        <Field label="Asegurador / EPS">{patient.insurerName ?? '—'} {patient.insurerPlan ? `(${patient.insurerPlan})` : ''}</Field>
        <Field label="Teléfono">{patient.phone ?? '—'}</Field>
        <Field label="Email">{patient.email ?? '—'}</Field>
        <Field label="Habeas Data aceptado">
          {patient.privacyAcceptedAt ? `✓ ${formatDate(patient.privacyAcceptedAt)}` : '⚠️ Falta aceptación'}
        </Field>
      </dl>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-gray-900">{children}</dd>
    </div>
  );
}

function RecordsTab({ records }: { records: ClinicalRecord[] }) {
  if (records.length === 0) {
    return <Card className="text-center text-sm text-gray-500">Sin registros en la historia clínica.</Card>;
  }
  return (
    <div className="space-y-3">
      {records.map((r) => (
        <Card key={r.id}>
          <div className="flex justify-between text-sm">
            <div>
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">{translateType(r.type)}</span>
              <span className="ml-2 text-xs text-gray-500">{formatDateTime(r.createdAt)}</span>
              {r.signedAt && <span className="ml-2 text-xs text-green-700">✓ Firmada</span>}
            </div>
            <div className="text-xs text-gray-500">
              {r.professional.fullName}
            </div>
          </div>
          {r.structuredData?.chiefComplaint && (
            <p className="mt-2 text-sm"><strong>Motivo:</strong> {r.structuredData.chiefComplaint}</p>
          )}
        </Card>
      ))}
    </div>
  );
}

function translateType(t: string) {
  const map: Record<string, string> = {
    CONSULTATION: 'Consulta',
    EVOLUTION_NOTE: 'Nota de evolución',
    DENTAL_TREATMENT: 'Tratamiento dental',
    PSYCHOLOGY_SOAP: 'Nota SOAP',
    PSYCHOMETRIC_TEST: 'Test psicométrico',
    PRESCRIPTION: 'Receta',
    AMENDMENT: 'Adenda',
  };
  return map[t] ?? t;
}

function OdontogramTab({ patient, onSaved }: { patient: Patient; onSaved: () => void }) {
  const [state, setState] = useState<ChartState>((patient.dentalChart?.state ?? {}) as ChartState);
  const [selectedCondition, setSelectedCondition] = useState<Condition>('CARIES');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/dental/chart/${patient.id}`, {
        method: 'PUT',
        body: { state, numbering: 'FDI' },
      });
      setMsg('✓ Odontograma actualizado');
      onSaved();
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Selecciona condición y haz click en las superficies de los dientes</CardTitle>
        <div className="mt-3">
          <ConditionPalette selected={selectedCondition} onSelect={setSelectedCondition} />
        </div>
      </Card>

      <Card>
        <Odontogram state={state} onChange={setState} selectedCondition={selectedCondition} />
      </Card>

      <div className="flex items-center justify-end gap-3">
        {msg && <span className={cn('text-sm', msg.startsWith('✓') ? 'text-green-700' : 'text-red-700')}>{msg}</span>}
        <Button onClick={save} loading={saving}>Guardar odontograma</Button>
      </div>
    </div>
  );
}

function VitalSignsTab({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [vitals, setVitals] = useState({
    systolicMmHg: '', diastolicMmHg: '', heartRate: '',
    temperatureC: '', oxygenSaturation: '', weightKg: '', heightCm: '',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    try {
      const cleaned: any = {};
      for (const [k, v] of Object.entries(vitals)) {
        if (v !== '') cleaned[k] = parseFloat(v);
      }
      await apiFetch('/api/medical/vital-signs', {
        method: 'POST',
        body: { patientId, vitals: cleaned },
      });
      setMsg('✓ Signos vitales registrados');
      setVitals({ systolicMmHg: '', diastolicMmHg: '', heartRate: '', temperatureC: '', oxygenSaturation: '', weightKg: '', heightCm: '' });
      onSaved();
      setTimeout(() => setMsg(null), 2000);
    } catch { setMsg('Error al guardar'); }
    finally { setSaving(false); }
  }

  const bmi = vitals.weightKg && vitals.heightCm
    ? (parseFloat(vitals.weightKg) / Math.pow(parseFloat(vitals.heightCm) / 100, 2)).toFixed(2)
    : null;

  return (
    <Card>
      <CardTitle>Registrar signos vitales</CardTitle>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Vital label="TA Sistólica" unit="mmHg" value={vitals.systolicMmHg} onChange={(v) => setVitals({ ...vitals, systolicMmHg: v })} />
        <Vital label="TA Diastólica" unit="mmHg" value={vitals.diastolicMmHg} onChange={(v) => setVitals({ ...vitals, diastolicMmHg: v })} />
        <Vital label="FC" unit="bpm" value={vitals.heartRate} onChange={(v) => setVitals({ ...vitals, heartRate: v })} />
        <Vital label="Temperatura" unit="°C" step="0.1" value={vitals.temperatureC} onChange={(v) => setVitals({ ...vitals, temperatureC: v })} />
        <Vital label="SpO2" unit="%" value={vitals.oxygenSaturation} onChange={(v) => setVitals({ ...vitals, oxygenSaturation: v })} />
        <Vital label="Peso" unit="kg" step="0.1" value={vitals.weightKg} onChange={(v) => setVitals({ ...vitals, weightKg: v })} />
        <Vital label="Talla" unit="cm" step="0.1" value={vitals.heightCm} onChange={(v) => setVitals({ ...vitals, heightCm: v })} />
        {bmi && (
          <div className="flex flex-col justify-end rounded-lg bg-gray-50 p-2 text-xs">
            <span className="text-gray-500">IMC calculado</span>
            <span className="text-xl font-bold">{bmi}</span>
          </div>
        )}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {msg && <span className={cn('text-sm', msg.startsWith('✓') ? 'text-green-700' : 'text-red-700')}>{msg}</span>}
        <Button onClick={save} loading={saving}>Registrar</Button>
      </div>
    </Card>
  );
}

function Vital({
  label, unit, value, onChange, step,
}: { label: string; unit: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="flex flex-col text-xs">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center gap-1">
        <input type="number" inputMode="decimal" step={step ?? '1'} value={value} onChange={(e) => onChange(e.target.value)}
               className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
        <span className="text-gray-500">{unit}</span>
      </div>
    </label>
  );
}

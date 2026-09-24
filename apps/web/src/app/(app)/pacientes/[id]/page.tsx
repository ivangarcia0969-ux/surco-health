'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { PatientAccount } from '@/components/billing/PatientAccount';
import { PatientFiles } from '@/components/clinical/PatientFiles';
import { PrescriptionsPanel } from '@/components/clinical/PrescriptionsPanel';
import { ConsentsPanel } from '@/components/clinical/ConsentsPanel';
import { DentalProcedureForm } from '@/components/clinical/DentalProcedureForm';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Odontogram, ConditionPalette, type Condition, type ChartState } from '@/components/clinical/Odontogram';
import { ConsultationForm } from '@/components/clinical/ConsultationForm';
import { EvolutionNoteForm } from '@/components/clinical/EvolutionNoteForm';
import { SoapNoteForm } from '@/components/clinical/SoapNoteForm';
import { PsychometricTestForm } from '@/components/clinical/PsychometricTestForm';
import { DentalTreatmentPlan } from '@/components/clinical/DentalTreatmentPlan';
import { calcAge, cn, formatDate, formatDateTime, formatTime, whatsappLink } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';

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

interface Diagnosis {
  id: string;
  icd10Code: string;
  description?: string | null;
  isPrimary: boolean;
  type: 'PRESUMPTIVE' | 'CONFIRMED' | 'DIFFERENTIAL' | 'RULE_OUT';
}

interface VitalSignsData {
  systolicMmHg?: number | null;
  diastolicMmHg?: number | null;
  heartRate?: number | null;
  temperatureC?: string | number | null;
  oxygenSaturation?: number | null;
  weightKg?: string | number | null;
  heightCm?: string | number | null;
  bmi?: string | number | null;
}

interface ClinicalRecord {
  id: string;
  type: string;
  createdAt: string;
  signedAt?: string | null;
  professional: { id: string; fullName: string; specialty: string | null };
  structuredData: any;
  diagnoses?: Diagnosis[];
  vitalSigns?: VitalSignsData | null;
  dentalProcedures?: any[];
}

type Tab =
  | 'overview' | 'records' | 'odontogram' | 'dental-plan' | 'payments'
  | 'files' | 'prescriptions' | 'consents' | 'vitals';

interface Appt {
  id: string; startsAt: string; endsAt: string; status: string;
  service?: { name: string } | null;
  professional: { id: string; fullName: string };
}

const CLINICAL_ROLES = ['CLINIC_OWNER', 'PROFESSIONAL'];

export default function PatientDetailPage() {
  return (
    <Suspense fallback={<Card className="h-40 animate-pulse bg-gray-100" />}>
      <PatientDetail />
    </Suspense>
  );
}

function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const role = useAuth((s) => s.user?.role);
  const isClinical = CLINICAL_ROLES.includes(role ?? '');
  const attendId = search.get('atender');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [tab, setTab] = useState<Tab>(() => (search.get('tab') as Tab) || (attendId ? 'odontogram' : 'overview'));
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, r, a] = await Promise.all([
        apiFetch<Patient>(`/api/patients/${id}`),
        isClinical
          ? apiFetch<ClinicalRecord[]>(`/api/clinical/records?patientId=${id}`).catch(() => [] as ClinicalRecord[])
          : Promise.resolve([] as ClinicalRecord[]),
        apiFetch<Appt[]>(`/api/appointments?patientId=${id}`).catch(() => [] as Appt[]),
      ]);
      setPatient(p); setRecords(r); setAppts(a);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [id, isClinical]);

  useEffect(() => { load(); }, [load]);

  // La pestaña queda en la URL: al volver de un documento imprimible se conserva
  function selectTab(t: Tab) {
    setTab(t);
    const params = new URLSearchParams(search.toString());
    params.set('tab', t);
    router.replace(`/pacientes/${id}?${params.toString()}`, { scroll: false });
  }

  const attending = attendId ? appts.find((a) => a.id === attendId) ?? null : null;

  // Al entrar en modo "Atender", la cita pasa a "En curso"
  useEffect(() => {
    if (!attending || !isClinical) return;
    if (attending.status === 'CONFIRMED' || attending.status === 'CHECKED_IN' || attending.status === 'REQUESTED') {
      apiFetch(`/api/appointments/${attending.id}`, { method: 'PATCH', body: { status: 'IN_PROGRESS' } })
        .then(() => setAppts((prev) => prev.map((x) => (x.id === attending.id ? { ...x, status: 'IN_PROGRESS' } : x))))
        .catch(() => {/* sin permiso: seguimos igual */});
    }
  }, [attending, isClinical]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100" />
        <div className="h-10 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }
  if (notFound || !patient) return <Card className="text-sm text-red-600">Paciente no encontrado.</Card>;

  const wa = whatsappLink(patient.phone, `Hola ${patient.fullName.split(' ')[0]}, te escribimos de tu consultorio. `);
  const todayStart = new Date(new Date().toDateString());
  const upcoming = appts
    .filter((a) => new Date(a.startsAt) >= todayStart && !['CANCELLED', 'NO_SHOW', 'ATTENDED'].includes(a.status))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: 'overview', label: 'Resumen', show: true },
    { key: 'odontogram', label: '🦷 Odontograma', show: isClinical },
    { key: 'dental-plan', label: 'Plan y presupuesto', show: true },
    { key: 'payments', label: '💵 Pagos', show: true },
    { key: 'records', label: `Historia clínica (${records.length})`, show: isClinical },
    { key: 'files', label: '🩻 Radiografías', show: isClinical },
    { key: 'prescriptions', label: '💊 Recetas', show: isClinical },
    { key: 'consents', label: '✍️ Consentimientos', show: role !== 'BILLING' },
    { key: 'vitals', label: 'Signos vitales', show: isClinical },
  ];

  return (
    <div className="space-y-6">
      <Link href="/pacientes" className="text-sm text-brand-600 hover:underline">← Pacientes</Link>

      {attending && (
        <AttendBanner
          appt={attending}
          patientId={patient.id}
          onDone={() => { toast.success('Atención finalizada'); router.push('/agenda'); }}
          onChanged={load}
        />
      )}

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-lg font-bold text-brand-700">
              {patient.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
            </span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{patient.fullName}</h1>
              <p className="text-sm text-gray-500">
                {patient.documentType} {patient.documentId} · {calcAge(patient.birthdate)} años · {translateGender(patient.gender)}
              </p>
              <p className="text-xs text-gray-500">
                {patient.phone ?? 'Sin teléfono'} {patient.email ? `· ${patient.email}` : ''}
                {patient.insurerName ? ` · ${patient.insurerName}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {patient.bloodType !== 'UNKNOWN' && (
                  <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                    🩸 {patient.bloodType.replace('_POS', '+').replace('_NEG', '−')}
                  </span>
                )}
                {patient.allergiesSummary && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                    ⚠️ Alergias: {patient.allergiesSummary}
                  </span>
                )}
                {upcoming[0] && (
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                    📅 Próxima cita: {formatDateTime(upcoming[0].startsAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer"
                 className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-95">
                WhatsApp
              </a>
            )}
            <Link href={`/agenda?paciente=${patient.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50">
              📅 Agendar cita
            </Link>
          </div>
        </div>
      </Card>

      <div className="no-scrollbar -mx-4 overflow-x-auto border-b border-gray-200 px-4 md:mx-0 md:px-0">
        <nav className="-mb-px flex min-w-max gap-5 text-sm">
          {tabs.filter((t) => t.show).map((t) => (
            <TabBtn key={t.key} active={tab === t.key} onClick={() => selectTab(t.key)}>{t.label}</TabBtn>
          ))}
        </nav>
      </div>

      {tab === 'overview' && <OverviewTab patient={patient} upcoming={upcoming} />}
      {tab === 'records' && isClinical && <RecordsTab records={records} patientId={patient.id} appointmentId={attending?.id} onSaved={load} />}
      {tab === 'odontogram' && isClinical && <OdontogramTab patient={patient} appointmentId={attending?.id} onSaved={load} />}
      {tab === 'dental-plan' && <DentalTreatmentPlan patientId={patient.id} appointmentId={attending?.id} onChanged={load} />}
      {tab === 'payments' && <PatientAccount patientId={patient.id} />}
      {tab === 'files' && isClinical && <PatientFiles patientId={patient.id} />}
      {tab === 'prescriptions' && isClinical && <PrescriptionsPanel patientId={patient.id} allergies={patient.allergiesSummary} />}
      {tab === 'consents' && <ConsentsPanel patientId={patient.id} />}
      {tab === 'vitals' && isClinical && <VitalSignsTab patientId={patient.id} onSaved={load} />}
    </div>
  );
}

/** Barra fija mientras el profesional atiende una cita (entró desde "Atender" en la agenda). */
function AttendBanner({ appt, patientId, onDone, onChanged }: {
  appt: Appt; patientId: string; onDone: () => void; onChanged: () => void;
}) {
  const [openConsult, setOpenConsult] = useState(false);
  const [openProc, setOpenProc] = useState(false);
  const [finishing, setFinishing] = useState(false);

  async function finish() {
    setFinishing(true);
    try {
      await apiFetch(`/api/appointments/${appt.id}`, { method: 'PATCH', body: { status: 'ATTENDED' } });
      onDone();
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible finalizar la atención.'));
    } finally {
      setFinishing(false);
    }
  }

  const done = appt.status === 'ATTENDED';

  return (
    <div className="sticky top-2 z-30 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-600 to-brand-700 p-4 text-white shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {!done && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />}
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>
          <div>
            <div className="text-sm font-semibold">{done ? 'Cita atendida' : 'Atendiendo cita'}</div>
            <div className="text-xs text-white/80">
              {formatTime(appt.startsAt)} – {formatTime(appt.endsAt)} · {appt.service?.name ?? 'Consulta'} · {appt.professional.fullName}
            </div>
          </div>
        </div>
        {!done && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setOpenConsult(true)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25">🩺 Registrar consulta</button>
            <button onClick={() => setOpenProc(true)} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium hover:bg-white/25">🦷 Procedimientos</button>
            <button onClick={finish} disabled={finishing}
                    className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-brand-700 shadow-sm hover:bg-brand-50 disabled:opacity-60">
              {finishing ? 'Finalizando…' : '✓ Finalizar atención'}
            </button>
          </div>
        )}
      </div>
      <ConsultationForm open={openConsult} onClose={() => setOpenConsult(false)}
                        onCreated={() => { toast.success('Consulta registrada en la historia clínica'); onChanged(); }}
                        patientId={patientId} appointmentId={appt.id} />
      <DentalProcedureForm open={openProc} onClose={() => setOpenProc(false)} onCreated={onChanged}
                           patientId={patientId} appointmentId={appt.id} />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  // En pantallas angostas las pestañas se deslizan: mantener visible la activa
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [active]);
  return (
    <button ref={ref} onClick={onClick}
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

function OverviewTab({ patient, upcoming }: { patient: Patient; upcoming: Appt[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
    <Card className="lg:col-span-2">
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
    <Card>
      <CardTitle>Próximas citas</CardTitle>
      {upcoming.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Sin citas programadas.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {upcoming.slice(0, 5).map((a) => (
            <li key={a.id} className="rounded-xl border border-gray-100 px-3 py-2">
              <div className="text-sm font-medium text-gray-900">{formatDateTime(a.startsAt)}</div>
              <div className="text-xs text-gray-500">{a.service?.name ?? 'Consulta'} · {a.professional.fullName}</div>
            </li>
          ))}
        </ul>
      )}
    </Card>
    </div>
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

function RecordsTab({
  records, patientId, appointmentId, onSaved,
}: { records: ClinicalRecord[]; patientId: string; appointmentId?: string; onSaved: () => void }) {
  const role = useAuth((s) => s.user?.role);
  const specialty = useAuth((s) => s.user?.specialty);
  const canCreate = role === 'PROFESSIONAL' || role === 'CLINIC_OWNER';
  const isPsychology = specialty === 'PSYCHOLOGY' || specialty === 'PSYCHIATRY';

  const [openConsult, setOpenConsult] = useState(false);
  const [openEvolution, setOpenEvolution] = useState(false);
  const [openSoap, setOpenSoap] = useState(false);
  const [openTest, setOpenTest] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = filter === 'ALL' ? records : records.filter((r) => r.type === filter);
  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setOpenConsult(true)}>
            + Nueva consulta
          </Button>
          <Button variant="secondary" onClick={() => setOpenEvolution(true)}>
            + Nota de evolución
          </Button>
          {(isPsychology || role === 'CLINIC_OWNER') && (
            <>
              <Button variant="secondary" onClick={() => setOpenSoap(true)}>
                🧠 + Nota SOAP (psico)
              </Button>
              <Button variant="secondary" onClick={() => setOpenTest(true)}>
                📊 + Test psicométrico
              </Button>
            </>
          )}
        </div>
      )}

      {records.length === 0 ? (
        <Card className="text-center py-12">
          <div className="text-5xl mb-3">📋</div>
          <h3 className="font-semibold text-gray-900">Sin registros todavía</h3>
          <p className="mt-2 text-sm text-gray-500">
            {canCreate
              ? 'Crea la primera consulta para empezar la historia clínica del paciente.'
              : 'El paciente aún no tiene historia clínica registrada.'}
          </p>
          {canCreate && (
            <Button className="mt-4" onClick={() => setOpenConsult(true)}>
              + Crear primera consulta
            </Button>
          )}
        </Card>
      ) : (
        <>
          {/* Filtros tipo chip cuando hay variedad de registros */}
          {Object.keys(counts).length > 1 && (
            <div className="flex flex-wrap gap-2">
              <FilterChip active={filter === 'ALL'} onClick={() => setFilter('ALL')}>
                Todos ({records.length})
              </FilterChip>
              {Object.entries(counts).map(([type, count]) => (
                <FilterChip key={type} active={filter === type} onClick={() => setFilter(type)}>
                  {translateType(type)} ({count})
                </FilterChip>
              ))}
            </div>
          )}

          <div className="space-y-3">
            {filtered.map((r) => <RecordCard key={r.id} record={r} />)}
          </div>
        </>
      )}

      {canCreate && (
        <>
          <ConsultationForm
            open={openConsult}
            onClose={() => setOpenConsult(false)}
            onCreated={onSaved}
            patientId={patientId}
            appointmentId={appointmentId}
          />
          <EvolutionNoteForm
            open={openEvolution}
            onClose={() => setOpenEvolution(false)}
            onCreated={onSaved}
            patientId={patientId}
          />
          <SoapNoteForm
            open={openSoap}
            onClose={() => setOpenSoap(false)}
            onCreated={onSaved}
            patientId={patientId}
          />
          <PsychometricTestForm
            open={openTest}
            onClose={() => setOpenTest(false)}
            onCreated={onSaved}
            patientId={patientId}
          />
        </>
      )}
    </div>
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

const TYPE_BADGE: Record<string, { label: string; icon: string; classes: string }> = {
  CONSULTATION: { label: 'Consulta', icon: '🩺', classes: 'bg-brand-100 text-brand-700' },
  EVOLUTION_NOTE: { label: 'Evolución', icon: '📝', classes: 'bg-indigo-100 text-indigo-700' },
  DENTAL_TREATMENT: { label: 'Tratamiento dental', icon: '🦷', classes: 'bg-amber-100 text-amber-700' },
  PSYCHOLOGY_SOAP: { label: 'Sesión SOAP', icon: '🧠', classes: 'bg-purple-100 text-purple-700' },
  PSYCHOMETRIC_TEST: { label: 'Test psicométrico', icon: '📊', classes: 'bg-pink-100 text-pink-700' },
  AMENDMENT: { label: 'Adenda', icon: '✏️', classes: 'bg-yellow-100 text-yellow-700' },
  PRESCRIPTION: { label: 'Receta', icon: '💊', classes: 'bg-green-100 text-green-700' },
};

const DIAGNOSIS_TYPE_LABEL: Record<Diagnosis['type'], string> = {
  PRESUMPTIVE: 'Presuntivo',
  CONFIRMED: 'Confirmado',
  DIFFERENTIAL: 'Diferencial',
  RULE_OUT: 'A descartar',
};

function RecordCard({ record: r }: { record: ClinicalRecord }) {
  const [expanded, setExpanded] = useState(false);
  const badge = TYPE_BADGE[r.type] ?? { label: r.type, icon: '📋', classes: 'bg-gray-100 text-gray-700' };
  const hasDetails = r.structuredData?.currentIllness || r.structuredData?.physicalExam ||
                    r.structuredData?.plan || (r.diagnoses?.length ?? 0) > 0 ||
                    r.vitalSigns || (r.dentalProcedures?.length ?? 0) > 0;

  return (
    <Card className="p-0">
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', badge.classes)}>
              <span aria-hidden>{badge.icon}</span>
              {badge.label}
            </span>
            <span className="text-xs text-gray-500">{formatDateTime(r.createdAt)}</span>
            {r.signedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                ✓ Firmada
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {r.professional.fullName}
          </div>
        </div>

        {r.structuredData?.chiefComplaint && (
          <p className="mt-3 text-sm">
            <span className="font-medium text-gray-700">Motivo: </span>
            <span className="text-gray-900">{r.structuredData.chiefComplaint}</span>
          </p>
        )}

        {/* Diagnósticos primarios visibles siempre */}
        {(r.diagnoses?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {r.diagnoses!.map((d) => (
              <span
                key={d.id}
                className={cn(
                  'inline-flex items-baseline gap-1 rounded-full px-2 py-0.5 text-xs',
                  d.isPrimary ? 'bg-brand-100 font-medium text-brand-800' : 'bg-gray-100 text-gray-700',
                )}
                title={DIAGNOSIS_TYPE_LABEL[d.type]}
              >
                <span className="font-mono">{d.icd10Code}</span>
                <span>{d.description}</span>
                {d.isPrimary && <span className="text-[10px] uppercase">primario</span>}
              </span>
            ))}
          </div>
        )}

        {hasDetails && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-sm font-medium text-brand-600 hover:underline"
          >
            {expanded ? '▴ Ocultar detalle' : '▾ Ver detalle completo'}
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 space-y-3 text-sm">
          {r.structuredData?.currentIllness && (
            <RecordField label="Enfermedad actual" value={r.structuredData.currentIllness} />
          )}
          {r.structuredData?.physicalExam && (
            <RecordField label="Examen físico" value={r.structuredData.physicalExam} />
          )}
          {r.structuredData?.plan && (
            <RecordField label="Plan" value={r.structuredData.plan} />
          )}
          {r.vitalSigns && <VitalSignsDisplay vs={r.vitalSigns} />}
          {(r.dentalProcedures?.length ?? 0) > 0 && (
            <RecordField
              label="Procedimientos dentales"
              value={r.dentalProcedures!.map((p) => `${p.toothNumber}: ${p.condition}${p.treatment ? ` (${p.treatment})` : ''}`).join(' · ')}
            />
          )}
          {r.structuredData?.kind === 'VITAL_SIGNS' && !r.vitalSigns && (
            <p className="text-xs text-gray-500 italic">Sin datos de signos vitales registrados.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function RecordField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <p className="mt-1 whitespace-pre-wrap text-gray-800">{value}</p>
    </div>
  );
}

function VitalSignsDisplay({ vs }: { vs: VitalSignsData }) {
  const fields = [
    { label: 'TA', value: vs.systolicMmHg && vs.diastolicMmHg ? `${vs.systolicMmHg}/${vs.diastolicMmHg} mmHg` : null },
    { label: 'FC', value: vs.heartRate ? `${vs.heartRate} bpm` : null },
    { label: 'T°', value: vs.temperatureC ? `${vs.temperatureC} °C` : null },
    { label: 'SpO₂', value: vs.oxygenSaturation ? `${vs.oxygenSaturation}%` : null },
    { label: 'Peso', value: vs.weightKg ? `${vs.weightKg} kg` : null },
    { label: 'Talla', value: vs.heightCm ? `${vs.heightCm} cm` : null },
    { label: 'IMC', value: vs.bmi ? String(vs.bmi) : null },
  ].filter((f) => f.value);

  if (fields.length === 0) return null;
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Signos vitales</div>
      <div className="flex flex-wrap gap-3">
        {fields.map((f) => (
          <span key={f.label} className="rounded bg-white border border-gray-200 px-2 py-1 text-xs">
            <strong>{f.label}:</strong> {f.value}
          </span>
        ))}
      </div>
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

function OdontogramTab({ patient, appointmentId, onSaved }: { patient: Patient; appointmentId?: string; onSaved: () => void }) {
  const [state, setState] = useState<ChartState>((patient.dentalChart?.state ?? {}) as ChartState);
  const [selectedCondition, setSelectedCondition] = useState<Condition>('CARIES');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [openProc, setOpenProc] = useState(false);

  // Si el plan de tratamiento actualiza el odontograma, reflejarlo
  useEffect(() => {
    if (!dirty) setState((patient.dentalChart?.state ?? {}) as ChartState);
  }, [patient.dentalChart, dirty]);

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/dental/chart/${patient.id}`, {
        method: 'PUT',
        body: { state, numbering: 'FDI' },
      });
      toast.success('Odontograma guardado');
      setDirty(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible guardar el odontograma.'));
    } finally {
      setSaving(false);
    }
  }

  const findings = Object.values(state).reduce((n, t) => n + Object.values(t ?? {}).filter((c) => c && c !== 'HEALTHY').length, 0);

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Odontograma (notación FDI)</CardTitle>
            <p className="mt-1 text-xs text-gray-500">Elige una condición y toca las superficies de cada diente. {findings} hallazgo{findings === 1 ? '' : 's'} registrado{findings === 1 ? '' : 's'}.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setOpenProc(true)}>🦷 Agregar al plan de tratamiento</Button>
        </div>
        <div className="mt-3">
          <ConditionPalette selected={selectedCondition} onSelect={setSelectedCondition} />
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Odontogram state={state} onChange={(s) => { setState(s); setDirty(true); }} selectedCondition={selectedCondition} />
      </Card>

      <div className="flex items-center justify-end gap-3">
        {dirty && <span className="text-sm text-amber-700">Cambios sin guardar</span>}
        <Button onClick={save} loading={saving} disabled={!dirty}>Guardar odontograma</Button>
      </div>

      <DentalProcedureForm open={openProc} onClose={() => setOpenProc(false)}
                           onCreated={() => { setDirty(false); onSaved(); }}
                           patientId={patient.id} appointmentId={appointmentId} />
    </div>
  );
}

function VitalSignsTab({ patientId, onSaved }: { patientId: string; onSaved: () => void }) {
  const [vitals, setVitals] = useState({
    systolicMmHg: '', diastolicMmHg: '', heartRate: '',
    temperatureC: '', oxygenSaturation: '', weightKg: '', heightCm: '',
  });
  const [saving, setSaving] = useState(false);

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
      toast.success('Signos vitales registrados');
      setVitals({ systolicMmHg: '', diastolicMmHg: '', heartRate: '', temperatureC: '', oxygenSaturation: '', weightKg: '', heightCm: '' });
      onSaved();
    } catch (err) { toast.error(errorMessage(err, 'No fue posible guardar.')); }
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

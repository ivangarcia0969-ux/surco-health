'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PrintShell, PatientBlock, SignatureLine, useClinic } from '@/components/print/PrintShell';
import { formatCop, whatsappLink } from '@/lib/utils';
import type { AccountData } from '@/components/billing/PatientAccount';

interface Patient {
  id: string; fullName: string; documentType: string; documentId: string;
  birthdate: string; phone?: string | null; insurerName?: string | null;
}
interface Procedure {
  id: string; toothNumber: string; surfaces: string[]; condition: string;
  treatment?: string | null; cost?: string | number | null; status: string;
  clinicalRecord: { professional: { fullName: string } };
}

const CONDITION_LABEL: Record<string, string> = {
  HEALTHY: 'Profilaxis', CARIES: 'Caries', FILLING_AMALGAM: 'Obturación en amalgama',
  FILLING_RESIN: 'Obturación en resina', FILLING_TEMP: 'Obturación temporal', CROWN: 'Corona',
  IMPLANT: 'Implante', EXTRACTION_NEEDED: 'Extracción indicada', EXTRACTED: 'Exodoncia',
  ROOT_CANAL: 'Endodoncia', BRIDGE: 'Puente', SEALANT: 'Sellante', FRACTURE: 'Fractura',
  MOBILITY: 'Movilidad', ABSENT: 'Ausente',
};
const SURFACE_SHORT: Record<string, string> = {
  OCCLUSAL: 'O', MESIAL: 'M', DISTAL: 'D', VESTIBULAR: 'V', LINGUAL: 'L', PALATAL: 'P',
};
const STATUS_LABEL: Record<string, string> = {
  PLANNED: 'Pendiente', IN_PROGRESS: 'En curso', COMPLETED: 'Realizado',
};

export default function BudgetPrintPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const clinic = useClinic();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Patient>(`/api/patients/${patientId}`),
      apiFetch<Procedure[]>(`/api/dental/procedures/${patientId}`),
      apiFetch<AccountData>(`/api/billing/patients/${patientId}/account`).catch(() => null),
    ])
      .then(([p, procs, acc]) => {
        setPatient(p);
        setProcedures(procs.filter((x) => x.status !== 'CANCELLED').sort((a, b) => a.toothNumber.localeCompare(b.toothNumber)));
        setAccount(acc);
      })
      .catch(() => setError(true));
  }, [patientId]);

  const total = useMemo(() => procedures.reduce((s, p) => s + (p.cost != null ? Number(p.cost) : 0), 0), [procedures]);
  const professional = procedures[0]?.clinicalRecord.professional.fullName ?? null;

  if (error) return <div className="p-10 text-center text-sm text-red-600">No fue posible cargar el presupuesto.</div>;
  if (!patient) return <div className="p-10 text-center text-sm text-gray-500">Cargando presupuesto…</div>;

  const msg = [
    `Hola ${patient.fullName.split(' ')[0]} 👋, te compartimos tu presupuesto de tratamiento en ${clinic?.tradeName ?? 'la clínica'}:`,
    '',
    ...procedures.map((p) => `• ${p.toothNumber === 'GEN' ? 'General' : `Diente ${p.toothNumber}`}: ${p.treatment || CONDITION_LABEL[p.condition] || p.condition} — ${formatCop(p.cost)}`),
    '',
    `Total: ${formatCop(total)}`,
    account && account.paid > 0 ? `Abonado: ${formatCop(account.paid)} · Saldo: ${formatCop(account.balance)}` : '',
    '',
    'Cualquier inquietud con gusto te atendemos. 🦷',
  ].filter((l) => l !== undefined).join('\n');
  const wa = whatsappLink(patient.phone, msg);
  const validUntil = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  return (
    <PrintShell
      docTitle="Presupuesto de tratamiento"
      docNumber={`P-${patient.documentId.slice(-4)}${String(new Date().getMonth() + 1).padStart(2, '0')}`}
      actions={wa ? (
        <a href={wa} target="_blank" rel="noreferrer"
           className="rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-95">
          Enviar por WhatsApp
        </a>
      ) : null}
    >
      <PatientBlock patient={patient} />

      <section className="mt-6">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">Plan de tratamiento odontológico</h2>
        {procedures.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
            El paciente aún no tiene procedimientos en su plan de tratamiento.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-900 text-left text-[11px] font-bold uppercase tracking-widest">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Diente</th>
                <th className="py-2 pr-2">Procedimiento</th>
                <th className="py-2 pr-2">Estado</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {procedures.map((p, i) => (
                <tr key={p.id} className="border-b border-gray-200 align-top">
                  <td className="py-2 pr-2 text-gray-500">{i + 1}</td>
                  <td className="py-2 pr-2 font-mono font-semibold">{p.toothNumber === 'GEN' ? '—' : p.toothNumber}</td>
                  <td className="py-2 pr-2">
                    <div className="font-medium">{p.treatment || CONDITION_LABEL[p.condition] || p.condition}</div>
                    {p.surfaces.length > 0 && (
                      <div className="text-xs text-gray-500">Superficies: {p.surfaces.map((s) => SURFACE_SHORT[s] ?? s).join(', ')}</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-xs text-gray-600">{STATUS_LABEL[p.status] ?? p.status}</td>
                  <td className="py-2 text-right font-semibold">{formatCop(p.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between border-t-2 border-gray-900 pt-2 text-base font-bold">
              <span>Total del tratamiento</span><span>{formatCop(total)}</span>
            </div>
            {account && account.paid > 0 && (
              <>
                <div className="flex justify-between text-gray-700"><span>Abonado a la fecha</span><span>{formatCop(account.paid)}</span></div>
                <div className="flex justify-between font-semibold"><span>Saldo pendiente</span><span>{formatCop(account.balance)}</span></div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-xl bg-gray-50 p-4 text-xs leading-relaxed text-gray-700 print:bg-white print:ring-1 print:ring-gray-300">
        <div className="mb-1 font-bold uppercase tracking-widest text-gray-500">Condiciones</div>
        <ul className="list-disc space-y-0.5 pl-4">
          <li>Presupuesto válido hasta el {new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(validUntil)}.</li>
          <li>Los valores pueden variar si durante el tratamiento se encuentran hallazgos clínicos no previsibles; cualquier cambio se informará antes de realizarse.</li>
          <li>Se puede pagar por abonos. Cada pago genera un recibo de caja.</li>
          <li>Medios de pago: efectivo, tarjeta débito/crédito y transferencia.</li>
        </ul>
      </section>

      <section className="mt-12 grid grid-cols-2 gap-10">
        <SignatureLine label="Profesional tratante" name={professional} />
        <SignatureLine label="Acepto el presupuesto (paciente)" name={patient.fullName} detail={`${patient.documentType} ${patient.documentId}`} />
      </section>
    </PrintShell>
  );
}

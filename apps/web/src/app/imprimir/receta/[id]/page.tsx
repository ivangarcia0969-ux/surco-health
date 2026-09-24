'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PrintShell, PatientBlock, SignatureLine, useClinic } from '@/components/print/PrintShell';
import { errorMessage } from '@/components/ui/Toaster';
import { cn, formatDateTime, SPECIALTY_LABEL, whatsappLink } from '@/lib/utils';

interface PrescriptionDetail {
  id: string;
  number: string;
  status: 'DRAFT' | 'ISSUED' | 'DELIVERED' | 'CANCELLED';
  diagnosis: string | null;
  notes: string | null;
  isMipres: boolean;
  issuedAt: string | null;
  signedAt: string | null;
  signatureHash: string | null;
  createdAt: string;
  items: {
    id: string;
    drugName: string;
    presentation: string | null;
    dose: string;
    frequency: string;
    durationDays: number | null;
    quantity: string | null;
    instructions: string | null;
  }[];
  patient: {
    id: string;
    fullName: string;
    documentType: string;
    documentId: string;
    birthdate: string;
    phone: string | null;
    insurerName: string | null;
    allergiesSummary: string | null;
  };
  professional: {
    id: string;
    fullName: string;
    specialty: string | null;
    licenseNumber: string | null;
    licenseAuthority: string | null;
    signatureImageUrl: string | null;
  };
}

const days = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

/** Mensaje de WhatsApp con el resumen de la fórmula. */
function buildWhatsappMessage(p: PrescriptionDetail, clinicName?: string | null): string {
  const firstName = p.patient.fullName.trim().split(/\s+/)[0] ?? '';
  const lines = [
    `Hola ${firstName}, te compartimos tu fórmula médica N.º ${p.number}${clinicName ? ` de ${clinicName}` : ''}:`,
    '',
    ...p.items.map((it, i) => {
      const parts = [it.dose, it.frequency.toLowerCase()];
      if (it.durationDays) parts.push(`durante ${days(it.durationDays)}`);
      const head = it.presentation ? `${it.drugName} (${it.presentation})` : it.drugName;
      return `${i + 1}. *${head}*: ${parts.join(', ')}.${it.instructions ? ` ${it.instructions}` : ''}`;
    }),
  ];
  if (p.notes) lines.push('', `Recomendaciones: ${p.notes}`);
  lines.push('', `${p.professional.fullName}`, 'Ante cualquier duda o reacción, escríbenos. ¡Pronta recuperación!');
  return lines.join('\n');
}

export default function PrescriptionPrintPage() {
  const { id } = useParams<{ id: string }>();
  const clinic = useClinic();
  const [p, setP] = useState<PrescriptionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PrescriptionDetail>(`/api/prescriptions/${id}`)
      .then((data) => {
        setP(data);
        document.title = `Fórmula médica N.º ${data.number} · ${data.patient.fullName}`;
      })
      .catch((err) => {
        const code = (err as { message?: string })?.message;
        setError(code === 'PRESCRIPTION_NOT_FOUND'
          ? 'La receta no existe o no pertenece a esta clínica.'
          : errorMessage(err, 'No fue posible cargar la receta.'));
      });
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-100 px-4 text-center">
        <div className="text-4xl" aria-hidden>💊</div>
        <p className="text-sm text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Volver
        </button>
      </div>
    );
  }
  if (!p) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-100 text-sm text-gray-500">Cargando receta…</div>;
  }

  const cancelled = p.status === 'CANCELLED';
  const draft = p.status === 'DRAFT';
  const signed = !!p.signedAt && !draft;
  const specialty = p.professional.specialty
    ? SPECIALTY_LABEL[p.professional.specialty] ?? p.professional.specialty
    : null;
  const signatureDetail = [
    specialty,
    p.professional.licenseNumber ? `Reg. profesional N.º ${p.professional.licenseNumber}` : null,
  ].filter(Boolean).join(' · ');

  const waHref = !cancelled && !draft
    ? whatsappLink(p.patient.phone, buildWhatsappMessage(p, clinic?.tradeName))
    : null;

  const actions = (
    waHref ? (
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1ebe5a]"
      >
        <WhatsappIcon /> Enviar por WhatsApp
      </a>
    ) : (
      <span
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-400"
        title={cancelled ? 'La receta está anulada' : draft ? 'La receta aún no está firmada' : 'El paciente no tiene un celular registrado'}
      >
        <WhatsappIcon /> Enviar por WhatsApp
      </span>
    )
  );

  return (
    <PrintShell
      docTitle="Fórmula médica"
      docNumber={`N.º ${p.number}`}
      docDate={p.issuedAt ?? p.createdAt}
      actions={actions}
      toolbarHint={cancelled ? 'Receta ANULADA · no es válida para dispensar.' : undefined}
    >
      <div className="relative">
        {/* Marca de agua para anuladas / borradores (sale también en papel) */}
        {(cancelled || draft) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden" aria-hidden>
            <span
              className={cn(
                '-rotate-[28deg] select-none whitespace-nowrap rounded-2xl border-[6px] px-8 text-[88px] font-black leading-tight tracking-[0.15em] opacity-[0.18] [-webkit-print-color-adjust:exact] [print-color-adjust:exact]',
                cancelled ? 'border-red-600 text-red-600' : 'border-gray-500 text-gray-500',
              )}
            >
              {cancelled ? 'ANULADA' : 'BORRADOR'}
            </span>
          </div>
        )}

        {cancelled && (
          <div className="mt-5 rounded-lg border-2 border-red-600 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-red-700">
            Fórmula anulada — no válida para dispensar
          </div>
        )}
        {draft && (
          <div className="mt-5 rounded-lg border-2 border-dashed border-gray-400 px-4 py-2 text-center text-sm font-semibold text-gray-600">
            Borrador sin firmar — no válido para dispensar
          </div>
        )}

        <PatientBlock patient={p.patient} />

        {p.patient.allergiesSummary && (
          <section className="mt-3 flex items-start gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-2 text-sm [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
            <span className="font-bold text-amber-800">⚠ ALERGIAS:</span>
            <span className="text-amber-900">{p.patient.allergiesSummary}</span>
          </section>
        )}

        {p.diagnosis && (
          <section className="mt-5 print:mt-3">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Diagnóstico</h3>
            <p className="mt-1 text-sm text-gray-900">{p.diagnosis}</p>
          </section>
        )}

        {/* PRESCRIPCIÓN */}
        <section className="mt-6 print:mt-4">
          <div className="flex items-end gap-3 border-b border-gray-300 pb-2">
            <span className="font-serif text-4xl font-bold italic leading-none text-gray-900 print:text-3xl">Rp/</span>
            <span className="pb-0.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
              Prescripción · {p.items.length} medicamento{p.items.length === 1 ? '' : 's'}
            </span>
          </div>

          <ol className={cn('divide-y divide-gray-200', cancelled && 'line-through decoration-red-400/70')}>
            {p.items.map((it, i) => (
              <li key={it.id} className="flex gap-4 py-3.5 print:py-2 [break-inside:avoid]">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-900 text-xs font-bold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-[15px] font-bold text-gray-900">
                      {it.drugName}
                      {it.presentation && <span className="font-semibold text-gray-700"> — {it.presentation}</span>}
                    </p>
                    {it.quantity && (
                      <p className="text-sm text-gray-700">
                        <span className="text-gray-500">Cant.:</span> <strong>{it.quantity}</strong>
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-800">
                    <strong>{it.dose}</strong>
                    <span className="text-gray-400"> · </span>
                    {it.frequency}
                    {it.durationDays ? (
                      <>
                        <span className="text-gray-400"> · </span>
                        durante <strong>{days(it.durationDays)}</strong>
                      </>
                    ) : null}
                  </p>
                  {it.instructions && (
                    <p className="mt-1 text-[13px] italic text-gray-600">{it.instructions}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {p.notes && (
          <section className="mt-4 rounded-xl border border-gray-300 px-4 py-3 print:mt-3 print:py-2 [break-inside:avoid]">
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Recomendaciones</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{p.notes}</p>
          </section>
        )}

        {p.isMipres && (
          <p className="mt-3 text-xs text-gray-600">
            Medicamento No PBS: requiere prescripción en MIPRES.
          </p>
        )}

        {/* FIRMA */}
        <section className="mt-10 grid grid-cols-1 items-end gap-6 sm:grid-cols-2 print:mt-6 print:grid-cols-2 [break-inside:avoid]">
          <div className="order-2 space-y-1 text-[11px] text-gray-500 sm:order-1">
            {signed ? (
              <>
                <p><span className="font-semibold text-gray-700">Firmada electrónicamente:</span> {formatDateTime(p.signedAt!)}</p>
                {p.signatureHash && (
                  <p className="break-all">
                    <span className="font-semibold text-gray-700">Código de verificación:</span>{' '}
                    <span className="font-mono">{p.signatureHash.slice(0, 16).toUpperCase()}</span>
                  </p>
                )}
                <p>Firma electrónica con sello SHA-256 del contenido (Ley 527 de 1999).</p>
              </>
            ) : (
              <p>Documento sin firma electrónica.</p>
            )}
            {p.professional.licenseAuthority && (
              <p><span className="font-semibold text-gray-700">Registro expedido por:</span> {p.professional.licenseAuthority}</p>
            )}
          </div>
          <div className="order-1 sm:order-2">
            <SignatureLine
              label="Profesional tratante"
              name={p.professional.fullName}
              detail={signatureDetail || null}
              imageSrc={signed ? p.professional.signatureImageUrl : null}
            />
          </div>
        </section>
      </div>
    </PrintShell>
  );
}

function WhatsappIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.84 9.84 0 0 0 12.04 2Zm0 18.15h-.01a8.23 8.23 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.06-.1-.22-.16-.47-.28Z" />
    </svg>
  );
}

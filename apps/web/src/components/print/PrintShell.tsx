'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { LogoMark } from '@/components/brand/Logo';

export interface ClinicInfo {
  legalName: string;
  tradeName: string;
  taxId?: string | null;
  taxIdType?: string | null;
  logoUrl?: string | null;
  sites?: { name: string; address?: string | null; phone?: string | null; email?: string | null }[];
}

/** Carga los datos de la clínica una sola vez (para encabezados de documentos). */
export function useClinic() {
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  useEffect(() => {
    apiFetch<ClinicInfo>('/api/tenants/me').then(setClinic).catch(() => setClinic(null));
  }, []);
  return clinic;
}

interface PrintShellProps {
  /** Título del documento: "Presupuesto", "Fórmula médica", "Consentimiento informado"… */
  docTitle: string;
  /** Número o código del documento, opcional. */
  docNumber?: string;
  docDate?: Date | string;
  children: React.ReactNode;
  /** Texto de la barra superior (no se imprime). */
  toolbarHint?: string;
  /** Acciones extra en la barra superior (p.ej. enviar por WhatsApp). */
  actions?: React.ReactNode;
}

/**
 * Hoja imprimible con el encabezado de la clínica. Patrón tomado de Garrapata
 * (vista de impresión con barra "Volver / Imprimir" que no sale en papel).
 * "Guardar como PDF" = imprimir → destino PDF (funciona en Chrome, Edge, Safari y Android).
 */
export function PrintShell({ docTitle, docNumber, docDate, children, toolbarHint, actions }: PrintShellProps) {
  const clinic = useClinic();
  const router = useRouter();
  const site = clinic?.sites?.[0];
  const date = docDate ? new Date(docDate) : new Date();

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4">
        <span className="text-xs text-gray-500">{toolbarHint ?? 'Vista de impresión · usa «Imprimir / PDF» para imprimir o guardar el documento.'}</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) { router.back(); return; }
              // Abierto en pestaña nueva: cerrarla; si el navegador no deja, ir a pacientes
              window.close();
              setTimeout(() => router.push('/pacientes'), 150);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Volver
          </button>
          {actions}
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            🖨️ Imprimir / PDF
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-3xl bg-white px-8 py-8 text-sm text-gray-900 shadow-sm ring-1 ring-gray-200 print:max-w-none print:px-0 print:py-0 print:shadow-none print:ring-0">
        <header className="flex items-start justify-between gap-4 border-b-2 border-gray-900 pb-5">
          <div className="flex items-start gap-3">
            {clinic?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
            ) : (
              <LogoMark className="h-12 w-12" />
            )}
            <div>
              <div className="text-lg font-bold leading-tight">{clinic?.tradeName ?? '—'}</div>
              <div className="text-xs text-gray-600">
                {clinic?.legalName}
                {clinic?.taxId ? ` · ${clinic.taxIdType ?? 'NIT'} ${clinic.taxId}` : ''}
              </div>
              {site && (
                <div className="text-xs text-gray-600">
                  {[site.address, site.phone, site.email].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">{docTitle}</div>
            {docNumber && <div className="text-xl font-bold">{docNumber}</div>}
            <div className="text-xs text-gray-600">
              {new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' }).format(date)}
            </div>
          </div>
        </header>

        {children}

        <footer className="mt-10 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
          Documento generado con Surco Health · Datos personales tratados conforme a la Ley 1581 de 2012 (Habeas Data)
        </footer>
      </main>
    </div>
  );
}

/** Bloque estándar con los datos del paciente para los documentos. */
export function PatientBlock({ patient }: {
  patient: { fullName: string; documentType: string; documentId: string; birthdate?: string; phone?: string | null; insurerName?: string | null };
}) {
  const age = patient.birthdate
    ? Math.floor((Date.now() - new Date(patient.birthdate).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;
  return (
    <section className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-gray-300 p-4 text-sm">
      <div className="col-span-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">Paciente</div>
      <div className="col-span-2 text-base font-semibold">{patient.fullName}</div>
      <div><span className="text-gray-500">Documento:</span> {patient.documentType} {patient.documentId}</div>
      {age != null && <div><span className="text-gray-500">Edad:</span> {age} años</div>}
      {patient.phone && <div><span className="text-gray-500">Teléfono:</span> {patient.phone}</div>}
      {patient.insurerName && <div><span className="text-gray-500">EPS / Aseguradora:</span> {patient.insurerName}</div>}
    </section>
  );
}

/** Línea de firma (profesional o paciente). */
export function SignatureLine({ label, name, detail, imageSrc }: {
  label: string; name?: string | null; detail?: string | null; imageSrc?: string | null;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-20 w-full items-end justify-center">
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageSrc} alt="Firma" className="max-h-20 max-w-full object-contain" />
        )}
      </div>
      <div className="w-full border-t border-gray-800 pt-1 text-xs font-semibold">{name ?? ' '}</div>
      {detail && <div className="text-[11px] text-gray-600">{detail}</div>}
      <div className="text-[10px] uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/components/ui/Toaster';
import { PrintShell, PatientBlock, SignatureLine } from '@/components/print/PrintShell';
import { ConsentBody } from '@/components/clinical/ConsentBody';

interface ConsentDetail {
  id: string;
  bodyRendered: string;
  signedAt: string | null;
  signatureImg: string | null;
  signatureIp: string | null;
  signatureUserAgent: string | null;
  bodyHash: string;
  createdAt: string;
  procedureDetail: string | null;
  patient: {
    id: string;
    fullName: string;
    documentType: string;
    documentId: string;
    birthdate: string;
    phone: string | null;
    insurerName: string | null;
  };
  template: { id: string; name: string; version: number };
  clinic: {
    tradeName: string;
    legalName: string;
    taxId: string | null;
    taxIdType: string | null;
    timezone: string;
  } | null;
  issuedBy: { fullName: string; licenseNumber: string | null; specialty: string | null } | null;
}

type Integrity = 'checking' | 'ok' | 'mismatch' | 'unavailable';

const DOC_LABEL: Record<string, string> = {
  CC: 'C.C.', TI: 'T.I.', CE: 'C.E.', RC: 'R.C.', PA: 'Pasaporte', PASSPORT: 'Pasaporte',
  DNI: 'DNI', RFC: 'RFC', OTHER: 'Documento',
};

/** "Chrome 128 · Android 14 · tablet" a partir del userAgent. */
function summarizeUserAgent(ua: string | null): string {
  if (!ua) return 'No registrado';
  const major = (re: RegExp) => ua.match(re)?.[1]?.split('.')[0];

  let os = '';
  if (/iPad/.test(ua)) os = 'iPad';
  else if (/iPhone/.test(ua)) os = 'iPhone';
  else if (/Android/.test(ua)) {
    const v = major(/Android\s([\d.]+)/);
    os = `Android${v ? ` ${v}` : ''} · ${/Mobile/.test(ua) ? 'celular' : 'tablet'}`;
  } else if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Mac OS X|Macintosh/.test(ua)) os = 'macOS / iPadOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const browsers: [RegExp, string][] = [
    [/Edg(?:A|iOS)?\/([\d.]+)/, 'Edge'],
    [/SamsungBrowser\/([\d.]+)/, 'Samsung Internet'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/(?:Firefox|FxiOS)\/([\d.]+)/, 'Firefox'],
    [/CriOS\/([\d.]+)/, 'Chrome'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ];
  let browser = '';
  for (const [re, name] of browsers) {
    const v = major(re);
    if (v) { browser = `${name} ${v}`; break; }
  }
  return [browser, os].filter(Boolean).join(' · ') || ua.slice(0, 90);
}

function formatSignedAt(iso: string, timeZone: string): string {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      timeZone, timeZoneName: 'short',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'medium' }).format(d);
  }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function ConsentPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ConsentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<Integrity>('checking');

  useEffect(() => {
    if (!id) return;
    let alive = true;
    apiFetch<ConsentDetail>(`/api/consents/${encodeURIComponent(id)}`)
      .then((r) => { if (alive) setData(r); })
      .catch((err) => {
        if (!alive) return;
        const code = (err as { message?: string })?.message;
        setError(code === 'CONSENT_NOT_FOUND' ? 'Consentimiento no encontrado.' : errorMessage(err, 'No fue posible cargar el consentimiento.'));
      });
    return () => { alive = false; };
  }, [id]);

  // Verificación local de integridad: recalcula la huella SHA-256 en el navegador.
  useEffect(() => {
    if (!data) return;
    let alive = true;
    (async () => {
      try {
        if (!data.signatureImg || typeof window === 'undefined' || !window.crypto?.subtle) {
          if (alive) setIntegrity('unavailable');
          return;
        }
        const hex = await sha256Hex(data.bodyRendered + data.signatureImg);
        if (alive) setIntegrity(hex === data.bodyHash ? 'ok' : 'mismatch');
      } catch {
        if (alive) setIntegrity('unavailable');
      }
    })();
    return () => { alive = false; };
  }, [data]);

  // Título de la pestaña = nombre sugerido del PDF al "Guardar como PDF"
  useEffect(() => {
    if (!data) return;
    const prev = document.title;
    document.title = `Consentimiento - ${data.template.name} - ${data.patient.fullName}`;
    return () => { document.title = prev; };
  }, [data]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-200">
          <div className="text-3xl">📄</div>
          <p className="mt-2 text-sm font-medium text-gray-900">{error}</p>
          <Link href="/pacientes" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
            ← Volver a pacientes
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Cargando consentimiento…</div>
    );
  }

  const tz = data.clinic?.timezone ?? 'America/Bogota';
  const clinicName = data.clinic?.tradeName ?? data.clinic?.legalName ?? 'Institución prestadora';
  const docText = `${DOC_LABEL[data.patient.documentType] ?? data.patient.documentType} ${data.patient.documentId}`;
  const signedIso = data.signedAt ?? data.createdAt;
  const clinicTax = data.clinic?.taxId ? `${data.clinic.taxIdType ?? 'NIT'} ${data.clinic.taxId}` : data.clinic?.legalName ?? null;
  const professionalDetail = data.issuedBy
    ? [data.issuedBy.licenseNumber ? `Reg. prof. ${data.issuedBy.licenseNumber}` : null, clinicName].filter(Boolean).join(' · ')
    : clinicTax;

  return (
    <PrintShell
      docTitle="Consentimiento informado"
      docNumber={`CI-${data.id.slice(-6).toUpperCase()}`}
      docDate={signedIso}
      toolbarHint="Consentimiento firmado · usa «Imprimir / PDF» para entregar una copia al paciente."
    >
      <PatientBlock patient={data.patient} />

      <section className="mt-6 text-center">
        <h1 className="text-[15px] font-bold uppercase tracking-wide text-gray-900">{data.template.name}</h1>
        <p className="mt-0.5 text-[11px] text-gray-500">
          Plantilla versión {data.template.version}
          {data.procedureDetail ? ` · ${data.procedureDetail}` : ''}
        </p>
      </section>

      <section className="mt-5">
        <ConsentBody text={data.bodyRendered} size="sm" />
      </section>

      <section className="mt-10 grid grid-cols-2 gap-10 break-inside-avoid">
        <SignatureLine
          label="Firma del paciente o representante legal"
          name={data.patient.fullName}
          detail={docText}
          imageSrc={data.signatureImg}
        />
        <SignatureLine
          label="Profesional / Institución"
          name={data.issuedBy?.fullName ?? clinicName}
          detail={professionalDetail}
        />
      </section>

      <section className="mt-6 break-inside-avoid rounded-lg border border-gray-300 bg-gray-50 p-3 text-[10.5px] leading-relaxed text-gray-700 print:bg-white">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold uppercase tracking-wider text-gray-800">
            Constancia de firma electrónica (Ley 527 de 1999)
          </span>
          {integrity === 'ok' && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 font-semibold text-green-700 ring-1 ring-green-200">
              ✓ Íntegro: la huella coincide
            </span>
          )}
          {integrity === 'mismatch' && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700 ring-1 ring-red-200">
              ⚠ La huella no coincide
            </span>
          )}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
          <dt className="text-gray-500">Fecha y hora de firma</dt>
          <dd className="font-medium text-gray-900">{formatSignedAt(signedIso, tz)}</dd>
          <dt className="text-gray-500">Dirección IP</dt>
          <dd className="font-mono">{data.signatureIp ?? 'No registrada'}</dd>
          <dt className="text-gray-500">Dispositivo</dt>
          <dd>{summarizeUserAgent(data.signatureUserAgent)}</dd>
          <dt className="text-gray-500">Documento</dt>
          <dd className="font-mono">{data.id}</dd>
          <dt className="text-gray-500">Huella SHA-256</dt>
          <dd className="break-all font-mono text-[9.5px] text-gray-900">{data.bodyHash}</dd>
        </dl>
        <p className="mt-1.5 text-[9.5px] text-gray-500">
          La huella digital se calcula sobre el texto firmado y la imagen de la firma: cualquier modificación posterior
          produce una huella diferente. Firma electrónica con plena validez jurídica conforme a la Ley 527 de 1999 y el
          Decreto 2364 de 2012. Este documento hace parte de la historia clínica del paciente (Resolución 1995 de 1999).
        </p>
      </section>
    </PrintShell>
  );
}

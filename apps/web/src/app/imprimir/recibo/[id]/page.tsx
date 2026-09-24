'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { PrintShell, PatientBlock, SignatureLine, useClinic } from '@/components/print/PrintShell';
import { PAYMENT_METHOD_LABEL } from '@/components/billing/PatientAccount';
import { formatCop, formatDateTime, whatsappLink } from '@/lib/utils';

interface Receipt {
  id: string; number: string; total: string | number; issuedAt: string | null; createdAt: string;
  cashier: string | null;
  items: { id: string; description: string; quantity: number; unitPrice: string | number; lineTotal: string | number }[];
  payments: { id: string; method: string; amount: string | number; reference?: string | null; paidAt: string }[];
  patient: { fullName: string; documentType: string; documentId: string; phone?: string | null; birthdate: string; insurerName?: string | null };
}

/** Convierte un número a letras (pesos colombianos) para el recibo. */
function numberToWords(n: number): string {
  const units = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
    'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
    'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  const below1000 = (x: number): string => {
    if (x === 0) return '';
    if (x === 100) return 'cien';
    const h = Math.floor(x / 100); const r = x % 100;
    const rest = r < 30 ? units[r] : `${tens[Math.floor(r / 10)]}${r % 10 ? ` y ${units[r % 10]}` : ''}`;
    return [hundreds[h], rest].filter(Boolean).join(' ');
  };
  if (n === 0) return 'cero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions) parts.push(millions === 1 ? 'un millón' : `${below1000(millions).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} millones`);
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${below1000(thousands).replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')} mil`);
  if (rest) parts.push(below1000(rest));
  return parts.join(' ');
}

export default function ReceiptPrintPage() {
  const { id } = useParams<{ id: string }>();
  const clinic = useClinic();
  const [r, setR] = useState<Receipt | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    apiFetch<Receipt>(`/api/billing/receipts/${id}`).then(setR).catch(() => setError(true));
  }, [id]);

  if (error) return <div className="p-10 text-center text-sm text-red-600">No fue posible cargar el recibo.</div>;
  if (!r) return <div className="p-10 text-center text-sm text-gray-500">Cargando recibo…</div>;

  const total = Number(r.total);
  const payment = r.payments[0];
  const words = numberToWords(Math.round(total));
  const wa = whatsappLink(
    r.patient.phone,
    `Hola ${r.patient.fullName.split(' ')[0]}, confirmamos tu pago de ${formatCop(total)} en ${clinic?.tradeName ?? 'la clínica'} (recibo ${r.number}). ¡Gracias! 🦷`,
  );

  return (
    <PrintShell
      docTitle="Recibo de caja"
      docNumber={r.number}
      docDate={r.issuedAt ?? r.createdAt}
      actions={wa ? (
        <a href={wa} target="_blank" rel="noreferrer"
           className="rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:brightness-95">
          Enviar por WhatsApp
        </a>
      ) : null}
    >
      <PatientBlock patient={r.patient} />

      <section className="mt-6 rounded-xl border-2 border-gray-900 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Valor recibido</div>
          <div className="text-3xl font-bold">{formatCop(total)}</div>
        </div>
        <div className="mt-1 text-sm italic text-gray-700">Son: {words.charAt(0).toUpperCase() + words.slice(1)} pesos m/cte.</div>
      </section>

      <table className="mt-5 w-full">
        <thead>
          <tr className="border-b border-gray-900 text-left text-[11px] font-bold uppercase tracking-widest">
            <th className="py-2">Concepto</th>
            <th className="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {r.items.map((it) => (
            <tr key={it.id} className="border-b border-gray-200">
              <td className="py-2">{it.description}</td>
              <td className="py-2 text-right font-semibold">{formatCop(it.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {payment && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div><span className="text-gray-500">Medio de pago:</span> {PAYMENT_METHOD_LABEL[payment.method] ?? payment.method}</div>
          {payment.reference && <div><span className="text-gray-500">Referencia:</span> {payment.reference}</div>}
          <div><span className="text-gray-500">Fecha y hora:</span> {formatDateTime(payment.paidAt)}</div>
        </div>
      )}

      <section className="mt-12 grid grid-cols-2 gap-10">
        <SignatureLine label="Recibido por" name={r.cashier} detail={clinic?.tradeName} />
        <SignatureLine label="Paciente" name={r.patient.fullName} detail={`${r.patient.documentType} ${r.patient.documentId}`} />
      </section>

      <p className="mt-6 text-center text-[10px] text-gray-400">
        Este recibo es un comprobante interno de pago y no reemplaza la factura electrónica de venta.
      </p>
    </PrintShell>
  );
}

import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string | Date, tz?: string) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: tz,
  }).format(d);
}

export function formatDate(iso: string | Date, tz?: string) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: tz }).format(d);
}

export function formatTime(iso: string | Date, tz?: string) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('es-CO', { timeStyle: 'short', timeZone: tz }).format(d);
}

/** Pesos colombianos sin decimales: $ 1.250.000 */
export function formatCop(n: string | number | null | undefined): string {
  if (n == null || n === '') return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));
}

/** Link de WhatsApp (wa.me) con mensaje prellenado. Normaliza números de Colombia. */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('3')) digits = `57${digits}`;
  if (digits.length < 10) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function calcAge(birthdate: string | Date): number {
  const b = typeof birthdate === 'string' ? new Date(birthdate) : birthdate;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}

export function isoDate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const SPECIALTY_LABEL: Record<string, string> = {
  MEDICAL_GENERAL: 'Medicina General',
  DENTAL: 'Odontología',
  PSYCHOLOGY: 'Psicología',
  PSYCHIATRY: 'Psiquiatría',
  PEDIATRICS: 'Pediatría',
  GYNECOLOGY: 'Ginecología',
  DERMATOLOGY: 'Dermatología',
  CARDIOLOGY: 'Cardiología',
  NUTRITION: 'Nutrición',
  PHYSIOTHERAPY: 'Fisioterapia',
  AESTHETICS: 'Estética',
  OPHTHALMOLOGY: 'Oftalmología',
  ORTHOPEDICS: 'Ortopedia',
  OTORHINOLARYNGOLOGY: 'Otorrinolaringología',
  OTHER: 'Otra',
};

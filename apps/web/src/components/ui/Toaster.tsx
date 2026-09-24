'use client';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

const useToasts = create<ToastState>((set, get) => ({
  items: [],
  push: (kind, message) => {
    const id = ++seq;
    // Máximo 4 visibles (patrón Garrapata): el más viejo sale primero
    set({ items: [...get().items, { id, kind, message }].slice(-4) });
    setTimeout(() => get().dismiss(id), kind === 'error' ? 6000 : 3500);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

/** Avisos flotantes. Uso: toast.success('Guardado') / toast.error('No se pudo…') */
export const toast = {
  success: (m: string) => useToasts.getState().push('success', m),
  error: (m: string) => useToasts.getState().push('error', m),
  info: (m: string) => useToasts.getState().push('info', m),
};

const STYLES: Record<ToastKind, { icon: string; classes: string }> = {
  success: { icon: '✓', classes: 'border-green-200 bg-white text-green-800' },
  error: { icon: '!', classes: 'border-red-200 bg-white text-red-700' },
  info: { icon: 'i', classes: 'border-brand-200 bg-white text-brand-800' },
};

export function Toaster() {
  const { items, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6 md:items-end md:px-6 print:hidden">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm shadow-lg ring-1 ring-black/5 animate-[toast-in_.18s_ease-out]',
            STYLES[t.kind].classes,
          )}
        >
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold">
            {STYLES[t.kind].icon}
          </span>
          <span className="flex-1 text-gray-800">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

/** Traduce códigos de error del API a mensajes en español para el usuario. */
export function errorMessage(err: unknown, fallback = 'No fue posible completar la acción.'): string {
  const code = (err as { message?: string })?.message ?? '';
  const map: Record<string, string> = {
    VALIDATION: 'Revisa los datos del formulario.',
    FORBIDDEN: 'No tienes permiso para esta acción.',
    PATIENT_NOT_FOUND: 'Paciente no encontrado.',
    TIME_SLOT_CONFLICT: 'El profesional ya tiene una cita en ese horario.',
    FILE_TOO_LARGE: 'El archivo supera el tamaño máximo (25 MB).',
    FILE_TYPE_NOT_ALLOWED: 'Tipo de archivo no permitido. Usa imágenes (JPG, PNG) o PDF.',
    STORAGE_UNAVAILABLE: 'El almacenamiento de archivos no está disponible en este momento.',
    SIGNATURE_REQUIRED: 'Falta la firma.',
    TENANT_SUBSCRIPTION_EXPIRED: 'La suscripción de la clínica venció.',
    HTTP_413: 'El archivo es demasiado grande.',
  };
  return map[code] ?? fallback;
}

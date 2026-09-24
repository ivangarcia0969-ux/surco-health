'use client';
import { useAuthGuard } from '@/hooks/useAuthGuard';

/** Layout limpio para documentos imprimibles: sin menú lateral, fondo blanco al imprimir. */
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useAuthGuard(['CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST', 'BILLING']);
  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Cargando…</div>;
  }
  return <>{children}</>;
}

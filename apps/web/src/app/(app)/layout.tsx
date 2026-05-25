'use client';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { ready, user } = useAuthGuard(['CLINIC_OWNER', 'PROFESSIONAL', 'RECEPTIONIST', 'BILLING']);
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-500">Cargando…</div>
    );
  }
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={user!.role} specialty={user!.specialty} />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}

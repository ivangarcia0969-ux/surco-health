'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import type { UserRole } from '@surco/shared';

/**
 * Protege páginas que requieren sesión.
 *
 * 🔴 Espera a que zustand/persist termine de leer la sesión guardada en
 * localStorage antes de decidir. Antes se leían los valores del primer render
 * (todavía vacíos) y cualquier recarga (F5, pestaña nueva, URL directa)
 * mandaba al login aunque hubiera sesión.
 */
export function useAuthGuard(allowed?: UserRole[]) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const accessToken = useAuth((s) => s.accessToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => {
      const s = useAuth.getState();
      if (!s.accessToken || !s.user) {
        router.replace('/login');
        return;
      }
      if (allowed && !allowed.includes(s.user.role)) {
        router.replace('/dashboard');
        return;
      }
      setReady(true);
    };
    if (useAuth.persist.hasHydrated()) {
      check();
      return;
    }
    return useAuth.persist.onFinishHydration(check);
  }, [accessToken, user, allowed, router]);

  return { ready, user: user ?? useAuth.getState().user };
}

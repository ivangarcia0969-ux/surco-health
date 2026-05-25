'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';
import type { UserRole } from '@surco/shared';

export function useAuthGuard(allowed?: UserRole[]) {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const accessToken = useAuth((s) => s.accessToken);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!accessToken || !user) {
      router.replace('/login');
      return;
    }
    if (allowed && !allowed.includes(user.role)) {
      router.replace('/dashboard');
      return;
    }
    setReady(true);
  }, [accessToken, user, allowed, router]);

  return { ready, user };
}

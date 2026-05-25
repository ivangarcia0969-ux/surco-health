'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole, Specialty } from '@surco/shared';

interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  specialty?: Specialty | null;
  tenantId: string | null;
  tenantSlug?: string;
}

interface AuthState {
  user: SessionUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (s: { user: SessionUser; accessToken: string; refreshToken: string }) => void;
  setTokens: (s: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      clear: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    { name: 'surco-auth' },
  ),
);

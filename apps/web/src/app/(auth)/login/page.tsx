'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string; email: string; fullName: string;
    role: any; specialty?: any; tenantId: string | null; tenantSlug?: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<LoginResponse>('/api/auth/login', {
        method: 'POST',
        body: { email, password },
        autoRefresh: false,
      });
      setSession(res);
      router.push(res.user.role === 'SAAS_ADMIN' ? '/admin' : '/dashboard');
    } catch (err: any) {
      setError(err.message === 'INVALID_CREDENTIALS' ? 'Email o contraseña incorrectos.' : 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <h1 className="mb-1 text-2xl font-bold">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-gray-600">Surco Health · plataforma clínica</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <Input label="Contraseña" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Button type="submit" loading={loading} className="w-full">Entrar</Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          ¿Aún no tienes cuenta?{' '}
          <Link href="/register" className="font-medium text-brand-600 hover:underline">Crea tu clínica</Link>
        </p>
      </div>
    </main>
  );
}

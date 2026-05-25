'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    legalName: '', tradeName: '', slug: '',
    primarySpecialty: 'DENTAL' as 'DENTAL' | 'MEDICAL_GENERAL' | 'PSYCHOLOGY' | 'OTHER',
    country: 'CO',
    ownerName: '', ownerEmail: '', ownerPassword: '', ownerPhone: '',
    acceptedPrivacyPolicy: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: any) { setForm((f) => ({ ...f, [k]: v })); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.acceptedPrivacyPolicy) {
      setError('Debes aceptar la política de privacidad (Habeas Data) para continuar.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/auth/register', { method: 'POST', body: form, autoRefresh: false });
      router.push('/login?registered=1');
    } catch (err: any) {
      setError(
        err.message === 'SLUG_TAKEN' ? 'Ese identificador ya está en uso.'
          : err.message === 'EMAIL_TAKEN' ? 'Ese email ya está registrado.'
          : 'No fue posible crear la cuenta.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <div className="rounded-2xl bg-white p-8 shadow-lg ring-1 ring-gray-200">
        <h1 className="mb-1 text-2xl font-bold">Crea tu clínica en Surco Health</h1>
        <p className="mb-6 text-sm text-gray-600">14 días de prueba, sin tarjeta de crédito.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Razón social" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} required minLength={2} />
          <Input label="Nombre comercial" value={form.tradeName} onChange={(e) => set('tradeName', e.target.value)} required minLength={2} />
          <Input label="Identificador (URL)" value={form.slug}
                 onChange={(e) => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                 required minLength={3} hint="Solo minúsculas, números y guiones. Ej: sonrisa-dental" />
          <Select label="Especialidad principal" value={form.primarySpecialty}
                  onChange={(e) => set('primarySpecialty', e.target.value)} required>
            <option value="DENTAL">Odontología</option>
            <option value="MEDICAL_GENERAL">Medicina General</option>
            <option value="PSYCHOLOGY">Psicología</option>
            <option value="PEDIATRICS">Pediatría</option>
            <option value="OTHER">Otra</option>
          </Select>
          <Select label="País" value={form.country} onChange={(e) => set('country', e.target.value)}>
            <option value="CO">Colombia</option>
            <option value="MX">México</option>
            <option value="AR">Argentina</option>
            <option value="CL">Chile</option>
            <option value="PE">Perú</option>
            <option value="EC">Ecuador</option>
            <option value="ES">España</option>
          </Select>

          <div className="my-4 border-t pt-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Datos del responsable</p>
          </div>
          <Input label="Nombre completo" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} required />
          <Input label="Email" type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} required />
          <Input label="Teléfono" value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} />
          <Input label="Contraseña" type="password" minLength={8} value={form.ownerPassword}
                 onChange={(e) => set('ownerPassword', e.target.value)} required hint="Mínimo 8 caracteres" />

          <label className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-gray-700">
            <input type="checkbox" checked={form.acceptedPrivacyPolicy}
                   onChange={(e) => set('acceptedPrivacyPolicy', e.target.checked)} className="mt-0.5 h-4 w-4" required />
            <span>
              Acepto la <a href="/legal/privacidad" target="_blank" className="font-medium text-brand-700 underline">política de privacidad y tratamiento de datos personales</a> conforme a la Ley 1581/2012 (Habeas Data). Entiendo que como responsable de la clínica también soy responsable del tratamiento de la información de mis pacientes.
            </span>
          </label>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <Button type="submit" loading={loading} className="w-full">Crear cuenta</Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="font-medium text-brand-600 hover:underline">Inicia sesión</Link>
        </p>
      </div>
    </main>
  );
}

'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { ProfessionalSignature } from '@/components/settings/ProfessionalSignature';
import { SPECIALTY_LABEL } from '@/lib/utils';

interface Me {
  id: string; fullName: string; email: string; phone?: string | null; role: string;
  specialty?: string | null; licenseNumber?: string | null; licenseAuthority?: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  CLINIC_OWNER: 'Administrador de la clínica',
  PROFESSIONAL: 'Profesional de la salud',
  RECEPTIONIST: 'Recepción',
  BILLING: 'Facturación',
};

export default function MyProfilePage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    apiFetch<Me>('/api/users/me').then(setMe).catch(() => setMe(null));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-sm text-gray-500">Tus datos profesionales y la firma que aparece en recetas y documentos.</p>
      </div>

      <Card>
        <CardTitle>Datos profesionales</CardTitle>
        {!me ? (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-gray-100" />
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
            <Item label="Nombre">{me.fullName}</Item>
            <Item label="Correo">{me.email}</Item>
            <Item label="Rol">{ROLE_LABEL[me.role] ?? me.role}</Item>
            <Item label="Especialidad">{me.specialty ? SPECIALTY_LABEL[me.specialty] ?? me.specialty : '—'}</Item>
            <Item label="Registro profesional">{me.licenseNumber ?? '—'}</Item>
            <Item label="Entidad que otorga el registro">{me.licenseAuthority ?? '—'}</Item>
          </dl>
        )}
      </Card>

      <ProfessionalSignature />
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{children}</dd>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SPECIALTY_LABEL } from '@/lib/utils';

interface ClinicalService {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  priceParticular: string | number;
  priceInsurer?: string | number | null;
  specialty: string | null;
  defaultCieCode?: string | null;
  isActive: boolean;
}

function formatCop(n: string | number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n));
}

export default function CatalogoPage() {
  const [items, setItems] = useState<ClinicalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);

  // Por ahora, listamos los servicios desde el tenant
  // El módulo de catalog del backend de Surco Health aún no expone GET /catalog/services públicamente
  // Provisional: usamos /api/tenants/me y mostraremos un placeholder cuando no haya endpoint
  const load = useCallback(async () => {
    setLoading(true);
    try {
      // TODO: cuando exista el endpoint público de servicios, usarlo
      // Por ahora dejamos vacío con un mensaje
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de servicios</h1>
          <p className="text-sm text-gray-500">Servicios clínicos que ofrece tu clínica</p>
        </div>
        <Button onClick={() => setOpenForm(true)} disabled>+ Nuevo servicio (próximamente)</Button>
      </div>

      <Card className="text-center py-12">
        <div className="text-5xl mb-4">📋</div>
        <h3 className="font-semibold text-gray-900 mb-2">Catálogo en construcción</h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          Los servicios clínicos creados en el seed están disponibles para citas. La interfaz de
          gestión del catálogo se habilitará en la próxima versión.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Servicios actuales (del seed): Consulta de medicina general, Consulta odontológica,
          Limpieza dental, Psicoterapia individual, Evaluación psicométrica.
        </p>
      </Card>
    </div>
  );
}

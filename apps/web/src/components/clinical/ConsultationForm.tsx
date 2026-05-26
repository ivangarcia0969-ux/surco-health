'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { Cie10Search, type DiagnosisItem } from './Cie10Search';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  patientId: string;
  appointmentId?: string;
}

export function ConsultationForm({ open, onClose, onCreated, patientId, appointmentId }: Props) {
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [currentIllness, setCurrentIllness] = useState('');
  const [physicalExam, setPhysicalExam] = useState('');
  const [plan, setPlan] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
  const [signNow, setSignNow] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setChiefComplaint(''); setCurrentIllness(''); setPhysicalExam('');
    setPlan(''); setPrivateNotes(''); setDiagnoses([]); setSignNow(true);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!chiefComplaint.trim()) {
      setError('El motivo de consulta es obligatorio.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/clinical/consultations', {
        method: 'POST',
        body: {
          patientId,
          appointmentId,
          chiefComplaint: chiefComplaint.trim(),
          currentIllness: currentIllness.trim() || undefined,
          physicalExam: physicalExam.trim() || undefined,
          plan: plan.trim() || undefined,
          privateNotes: privateNotes.trim() || undefined,
          diagnoses: diagnoses.length > 0 ? diagnoses.map((d) => ({
            icd10Code: d.icd10Code,
            description: d.description,
            isPrimary: d.isPrimary,
            type: d.type,
          })) : undefined,
          signNow,
        },
      });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      setError(
        err.message === 'PATIENT_NOT_FOUND' ? 'Paciente no encontrado.' :
        err.message === 'VALIDATION' ? 'Revisa los campos del formulario.' :
        'No fue posible guardar la consulta.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva consulta" size="xl">
      <form onSubmit={onSubmit} className="space-y-5">
        {/* SUBJETIVO */}
        <Section icon="📝" title="Subjetivo" subtitle="Lo que dice el paciente">
          <Textarea
            label="Motivo de consulta *"
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            required
            maxLength={1000}
            placeholder="Ej: Dolor abdominal de 2 días de evolución"
            rows={2}
          />
          <Textarea
            label="Enfermedad actual"
            value={currentIllness}
            onChange={(e) => setCurrentIllness(e.target.value)}
            maxLength={3000}
            placeholder="Descripción detallada de la enfermedad: inicio, evolución, síntomas asociados, factores que la modifican…"
            rows={4}
          />
        </Section>

        {/* OBJETIVO */}
        <Section icon="🔍" title="Objetivo" subtitle="Hallazgos del examen físico">
          <Textarea
            label="Examen físico"
            value={physicalExam}
            onChange={(e) => setPhysicalExam(e.target.value)}
            maxLength={3000}
            placeholder="Estado general, signos vitales, hallazgos por sistemas…"
            rows={4}
          />
        </Section>

        {/* ANÁLISIS */}
        <Section icon="🩺" title="Análisis" subtitle="Diagnóstico (CIE-10)">
          <Cie10Search value={diagnoses} onChange={setDiagnoses} />
        </Section>

        {/* PLAN */}
        <Section icon="📋" title="Plan" subtitle="Plan de manejo, tratamiento y seguimiento">
          <Textarea
            label="Plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            maxLength={3000}
            placeholder="Tratamiento, medicación, exámenes solicitados, próximo control…"
            rows={4}
          />
        </Section>

        {/* PRIVADO */}
        <Section icon="🔒" title="Notas privadas" subtitle="Texto encriptado at-rest, solo visible para ti">
          <Textarea
            label="Notas privadas (encriptadas)"
            value={privateNotes}
            onChange={(e) => setPrivateNotes(e.target.value)}
            maxLength={5000}
            placeholder="Observaciones personales que no se compartirán con el paciente…"
            rows={3}
            hint="Estas notas se cifran con la clave del tenant antes de guardarse en BD."
          />
        </Section>

        {/* FIRMAR */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={signNow}
              onChange={(e) => setSignNow(e.target.checked)}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <strong>Firmar consulta ahora</strong>
              <br />
              <span className="text-xs text-gray-600">
                Una vez firmada, no se puede editar — solo crear adendas. Recomendado al cerrar la consulta.
                La firma queda con hash SHA-256 del contenido (no-repudio, Ley 527/1999).
              </span>
            </span>
          </label>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>
            {signNow ? '✓ Firmar y guardar' : 'Guardar como borrador'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({
  icon, title, subtitle, children,
}: { icon: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2 border-b border-gray-200 pb-2">
        <span className="text-xl" aria-hidden>{icon}</span>
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <span className="text-xs text-gray-500">{subtitle}</span>}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

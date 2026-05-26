'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea, Select } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  patientId: string;
  appointmentId?: string;
}

type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'IMMINENT';

const RISK_LABEL: Record<RiskLevel, { label: string; color: string }> = {
  NONE:     { label: 'Sin riesgo', color: 'bg-green-100 text-green-700 border-green-300' },
  LOW:      { label: 'Bajo', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  MEDIUM:   { label: 'Medio', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  HIGH:     { label: 'Alto', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  IMMINENT: { label: 'Inminente', color: 'bg-red-100 text-red-800 border-red-300' },
};

export function SoapNoteForm({ open, onClose, onCreated, patientId, appointmentId }: Props) {
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');
  const [riskFlag, setRiskFlag] = useState<RiskLevel>('NONE');
  const [safetyPlan, setSafetyPlan] = useState('');
  const [signNow, setSignNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresSafetyPlan = riskFlag === 'HIGH' || riskFlag === 'IMMINENT';

  function reset() {
    setSubjective(''); setObjective(''); setAssessment(''); setPlan('');
    setRiskFlag('NONE'); setSafetyPlan(''); setSignNow(true); setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!subjective.trim() || !objective.trim() || !assessment.trim() || !plan.trim()) {
      setError('Los 4 campos SOAP son obligatorios.');
      return;
    }
    if (requiresSafetyPlan && !safetyPlan.trim()) {
      setError('Cuando el riesgo es Alto o Inminente, debes documentar un plan de seguridad.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/psychology/soap-notes', {
        method: 'POST',
        body: {
          patientId, appointmentId,
          subjective: subjective.trim(),
          objective: objective.trim(),
          assessment: assessment.trim(),
          plan: plan.trim(),
          riskFlag,
          safetyPlan: safetyPlan.trim() || undefined,
          signNow,
        },
      });
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      setError(
        err.message === 'ENCRYPTION_FAILED' ? 'Error de cifrado at-rest. Avisa al admin.' :
        err.message === 'PATIENT_NOT_FOUND' ? 'Paciente no encontrado.' :
        'No fue posible guardar la nota SOAP.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nueva nota SOAP psicológica" size="xl">
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="rounded-lg border-2 border-purple-200 bg-purple-50 p-3 text-xs text-purple-900">
          🔒 <strong>Estricta confidencialidad:</strong> Todo el contenido se cifra con pgcrypto antes de
          guardarse en BD. Solo tú (el psicólogo que la crea) y el Owner de la clínica pueden leerla.
          Una vez firmada, no se puede editar — solo crear adendas (Res 1995/1999).
        </div>

        <Section icon="🗣️" title="Subjetivo" subtitle="Lo que el paciente reporta">
          <Textarea
            value={subjective}
            onChange={(e) => setSubjective(e.target.value)}
            required
            minLength={1}
            maxLength={10000}
            placeholder="Verbalizaciones del paciente, motivo de la sesión, estado emocional auto-reportado…"
            rows={5}
          />
        </Section>

        <Section icon="👁️" title="Objetivo" subtitle="Observaciones del clínico durante la sesión">
          <Textarea
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            required
            minLength={1}
            maxLength={10000}
            placeholder="Aspecto, conducta, afecto, contenido del pensamiento, observaciones conductuales…"
            rows={5}
          />
        </Section>

        <Section icon="🧩" title="Análisis" subtitle="Impresión clínica e interpretación">
          <Textarea
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            required
            minLength={1}
            maxLength={10000}
            placeholder="Interpretación, conceptualización del caso, progreso, hipótesis diagnósticas…"
            rows={5}
          />
        </Section>

        <Section icon="📋" title="Plan" subtitle="Plan terapéutico y tareas">
          <Textarea
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            required
            minLength={1}
            maxLength={10000}
            placeholder="Intervenciones, técnicas a aplicar, tareas para casa, próxima sesión, referencias…"
            rows={5}
          />
        </Section>

        <Section icon="⚠️" title="Evaluación de riesgo" subtitle="Riesgo suicida / autolesivo en esta sesión">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {(Object.keys(RISK_LABEL) as RiskLevel[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRiskFlag(r)}
                className={cn(
                  'rounded-lg border-2 px-2 py-2 text-xs font-medium transition',
                  riskFlag === r
                    ? `${RISK_LABEL[r].color} ring-2 ring-offset-1 ring-current`
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                )}
              >
                {RISK_LABEL[r].label}
              </button>
            ))}
          </div>

          {requiresSafetyPlan && (
            <div className="mt-3 rounded-lg border-2 border-red-300 bg-red-50 p-3">
              <p className="mb-2 text-sm font-medium text-red-800">
                🚨 Plan de seguridad obligatorio (riesgo {RISK_LABEL[riskFlag].label})
              </p>
              <Textarea
                value={safetyPlan}
                onChange={(e) => setSafetyPlan(e.target.value)}
                required
                minLength={1}
                maxLength={5000}
                placeholder="Estrategias de afrontamiento, redes de apoyo, contactos de emergencia, medios y restricción de acceso a medios letales, próximo contacto…"
                rows={4}
              />
              <p className="mt-2 text-xs text-red-700">
                Este plan también se cifra at-rest. Si el riesgo es <strong>Inminente</strong>,
                contacta a línea de crisis o servicios de emergencia inmediatamente.
              </p>
            </div>
          )}
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
              <strong>Firmar nota ahora</strong>
              <br />
              <span className="text-xs text-gray-600">
                Después de firmar, solo se permiten adendas (Res 1995/1999).
                La firma queda con hash SHA-256 + timestamp para no-repudio (Ley 527/1999).
              </span>
            </span>
          </label>
        </div>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>
            {signNow ? '✓ Firmar y guardar (cifrado)' : 'Guardar borrador (cifrado)'}
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
      {children}
    </section>
  );
}

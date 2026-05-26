'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

interface TestDefinition {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  schema: {
    questions: number;
    scale: string;
    maxScore: number;
    interpretation: Array<{ range: [number, number]; label: string }>;
  };
}

interface Result {
  id: string;
  testCode: string;
  testName: string;
  score: number;
  interpretation: string;
  flags: string[];
  takenAt: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  patientId: string;
  appointmentId?: string;
}

// Cuestionarios reales (PHQ-9, GAD-7, BDI-II) — preguntas en español
const QUESTIONS: Record<string, { questions: string[]; scaleOptions: { value: number; label: string }[] }> = {
  'PHQ-9': {
    questions: [
      'Poco interés o placer en hacer cosas',
      'Sentirse decaído, deprimido o sin esperanza',
      'Dificultad para conciliar el sueño, dormir o dormir demasiado',
      'Sentirse cansado o con poca energía',
      'Poco apetito o comer en exceso',
      'Sentirse mal consigo mismo, sentir que es un fracaso o que ha decepcionado a su familia',
      'Dificultad para concentrarse en cosas (leer, ver TV)',
      'Moverse o hablar tan lento que otros lo han notado, o lo contrario: estar tan inquieto que se ha movido más de lo habitual',
      'Pensamientos de que estaría mejor muerto/a, o de hacerse daño de alguna forma',
    ],
    scaleOptions: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Varios días' },
      { value: 2, label: 'Más de la mitad de los días' },
      { value: 3, label: 'Casi todos los días' },
    ],
  },
  'GAD-7': {
    questions: [
      'Sentirse nervioso/a, ansioso/a o muy alterado/a',
      'No poder dejar de preocuparse o controlar la preocupación',
      'Preocuparse demasiado por distintas cosas',
      'Tener dificultad para relajarse',
      'Estar tan inquieto/a que es difícil quedarse quieto',
      'Enojarse o irritarse fácilmente',
      'Sentir miedo de que algo terrible vaya a pasar',
    ],
    scaleOptions: [
      { value: 0, label: 'Nunca' },
      { value: 1, label: 'Varios días' },
      { value: 2, label: 'Más de la mitad de los días' },
      { value: 3, label: 'Casi todos los días' },
    ],
  },
  'BDI-II': {
    // BDI-II tiene 21 ítems con 4 opciones cada uno. Aquí versión resumida con etiquetas genéricas
    questions: Array.from({ length: 21 }, (_, i) => `Ítem ${i + 1}`),
    scaleOptions: [
      { value: 0, label: '0 — No aplica' },
      { value: 1, label: '1 — Leve' },
      { value: 2, label: '2 — Moderado' },
      { value: 3, label: '3 — Severo' },
    ],
  },
};

export function PsychometricTestForm({ open, onClose, onCreated, patientId, appointmentId }: Props) {
  const [tests, setTests] = useState<TestDefinition[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [answers, setAnswers] = useState<number[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    apiFetch<TestDefinition[]>('/api/psychology/tests').then((t) => {
      setTests(t);
      if (t.length && !selectedCode) setSelectedCode(t[0].code);
    });
  }, [open]); // eslint-disable-line

  const test = tests.find((t) => t.code === selectedCode);
  const qSet = test ? QUESTIONS[test.code] : undefined;

  useEffect(() => {
    if (test) {
      setAnswers(new Array(test.schema.questions).fill(0));
      setResult(null);
    }
  }, [test]);

  function setAnswer(i: number, v: number) {
    setAnswers((curr) => curr.map((a, idx) => (idx === i ? v : a)));
  }

  const completedCount = answers.filter((a, i) => a !== undefined && (qSet?.scaleOptions.some((o) => o.value === a))).length;
  const allAnswered = test && completedCount === test.schema.questions;
  const currentScore = answers.reduce((s, a) => s + (a ?? 0), 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!test || !allAnswered) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<Result>('/api/psychology/tests/apply', {
        method: 'POST',
        body: {
          patientId, appointmentId,
          testCode: test.code,
          answers,
          notes: notes || undefined,
        },
      });
      setResult(res);
      onCreated();
    } catch (err: any) {
      setError('No fue posible aplicar el test.');
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setResult(null); setAnswers([]); setNotes(''); setError(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title={result ? '✅ Resultado del test' : 'Aplicar test psicométrico'} size="xl">
      {result ? (
        <ResultDisplay result={result} onClose={close} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Select
            label="Test a aplicar"
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            required
          >
            {tests.map((t) => (
              <option key={t.id} value={t.code}>
                {t.code} — {t.name}
              </option>
            ))}
          </Select>

          {test && (
            <>
              <div className="rounded-lg bg-brand-50 p-3 text-xs text-brand-900">
                {test.description ?? `${test.schema.questions} preguntas · escala ${test.schema.scale} · máximo ${test.schema.maxScore} puntos`}
              </div>

              {/* Progreso */}
              <div className="flex items-center justify-between text-sm">
                <span>{completedCount} / {test.schema.questions} respondidas</span>
                <span className="text-gray-500">Score actual: <strong>{currentScore}</strong></span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded bg-gray-100">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{ width: `${(completedCount / test.schema.questions) * 100}%` }}
                />
              </div>

              {/* Preguntas */}
              <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {qSet?.questions.map((q, i) => (
                  <div key={i} className="rounded-lg border border-gray-100 p-3">
                    <p className="mb-2 text-sm font-medium">
                      <span className="text-gray-400">{i + 1}.</span> {q}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {qSet.scaleOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAnswer(i, opt.value)}
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs transition',
                            answers[i] === opt.value
                              ? 'border-brand-500 bg-brand-100 font-medium text-brand-800'
                              : 'border-gray-300 hover:bg-gray-50',
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                🔒 Las respuestas se cifran at-rest. Solo se almacena el score, la interpretación y banderas.
                {test.code === 'PHQ-9' && (
                  <span> Si la pregunta 9 (ideación suicida) es {'>'} 0, se emite alerta automática.</span>
                )}
              </div>

              {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="button" variant="secondary" onClick={close}>Cancelar</Button>
                <Button type="submit" loading={submitting} disabled={!allAnswered}>
                  {allAnswered ? '✓ Calcular resultado' : `Faltan ${(test.schema.questions - completedCount)} respuestas`}
                </Button>
              </div>
            </>
          )}
        </form>
      )}
    </Modal>
  );
}

function ResultDisplay({ result, onClose }: { result: Result; onClose: () => void }) {
  const hasSuicidalFlag = result.flags.includes('SUICIDAL_IDEATION');
  const hasHighSeverity = result.flags.includes('HIGH_SEVERITY');

  return (
    <div className="space-y-4">
      <div className={cn(
        'rounded-2xl p-6 text-center',
        hasSuicidalFlag ? 'bg-red-50 border-2 border-red-200'
          : hasHighSeverity ? 'bg-amber-50 border-2 border-amber-200'
          : 'bg-green-50 border-2 border-green-200',
      )}>
        <div className="text-xs uppercase tracking-wide text-gray-600">{result.testName}</div>
        <div className="mt-2 text-5xl font-bold text-gray-900">{Number(result.score)}</div>
        <div className="mt-1 text-xs text-gray-500">puntos</div>
        <div className="mt-4 text-lg font-semibold text-gray-900">{result.interpretation}</div>
      </div>

      {result.flags.length > 0 && (
        <div className={cn(
          'rounded-lg p-3 text-sm',
          hasSuicidalFlag ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-amber-100 text-amber-900',
        )}>
          <strong>⚠️ Banderas detectadas:</strong>
          <ul className="mt-1 ml-4 list-disc">
            {result.flags.map((f) => (
              <li key={f}>
                {f === 'SUICIDAL_IDEATION' && '🚨 Ideación suicida — protocolo de seguridad recomendado'}
                {f === 'HIGH_SEVERITY' && 'Severidad alta — considerar derivación a psiquiatría'}
                {f !== 'SUICIDAL_IDEATION' && f !== 'HIGH_SEVERITY' && f}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Resultado registrado el {new Date(result.takenAt).toLocaleString('es-CO')}. Ya está en la HCE del paciente y en el audit log.
      </p>

      <div className="flex justify-end pt-2">
        <Button onClick={onClose}>Cerrar</Button>
      </div>
    </div>
  );
}

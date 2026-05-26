'use client';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  patientId: string;
  appointmentId?: string;
}

export function EvolutionNoteForm({ open, onClose, onCreated, patientId, appointmentId }: Props) {
  const [body, setBody] = useState('');
  const [signNow, setSignNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) { setError('La nota no puede estar vacía.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/clinical/evolution-notes', {
        method: 'POST',
        body: { patientId, appointmentId, body: body.trim(), signNow },
      });
      setBody(''); setSignNow(true);
      onCreated();
      onClose();
    } catch {
      setError('No fue posible guardar la nota.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nota de evolución" size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-lg bg-brand-50 p-3 text-xs text-brand-800">
          📝 Las notas de evolución son ideales para registrar seguimientos cortos entre consultas
          formales. El contenido se cifra at-rest.
        </div>

        <Textarea
          label="Nota de evolución"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          minLength={1}
          maxLength={5000}
          placeholder="Estado actual del paciente, evolución del tratamiento, ajustes…"
          rows={8}
        />

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={signNow}
            onChange={(e) => setSignNow(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <strong>Firmar ahora</strong>
            <br />
            <span className="text-xs text-gray-600">
              Después de firmar, solo se permiten adendas (Res 1995/1999 Colombia).
            </span>
          </span>
        </label>

        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>
            {signNow ? '✓ Firmar y guardar' : 'Guardar borrador'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

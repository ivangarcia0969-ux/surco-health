'use client';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SignaturePad, type SignaturePadHandle } from '@/components/ui/SignaturePad';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { SPECIALTY_LABEL } from '@/lib/utils';

interface MySignature {
  signatureImg: string | null;
  fullName: string;
  specialty: string | null;
  licenseNumber: string | null;
  licenseAuthority: string | null;
}

const MAX_CHARS = 300_000;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('IMAGE_LOAD'));
    img.src = src;
  });
}

/**
 * Deja la firma lista para documentos: recorta el espacio en blanco alrededor
 * del trazo, vuelve transparente el fondo (se ve natural sobre la línea de
 * firma) y la reduce a un tamaño liviano.
 */
async function prepareSignature(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const src = document.createElement('canvas');
  src.width = img.naturalWidth;
  src.height = img.naturalHeight;
  const sctx = src.getContext('2d', { willReadFrequently: true });
  if (!sctx) return dataUrl;
  sctx.drawImage(img, 0, 0);
  const { data, width, height } = sctx.getImageData(0, 0, src.width, src.height);

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 200) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return dataUrl;

  const pad = 10;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad); maxY = Math.min(height - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  // Recorte con fondo transparente y tinta azul oscuro (se lee como firma a mano)
  const crop = sctx.getImageData(minX, minY, cw, ch);
  const d = crop.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const alpha = lum >= 235 ? 0 : Math.min(255, Math.round((255 - lum) * 1.3));
    d[i] = 23; d[i + 1] = 37; d[i + 2] = 84; d[i + 3] = alpha;
  }
  const cropped = document.createElement('canvas');
  cropped.width = cw; cropped.height = ch;
  cropped.getContext('2d')?.putImageData(crop, 0, 0);

  // Escala final: máx. 600 × 200 px
  let scale = Math.min(1, 600 / cw, 200 / ch);
  for (let attempt = 0; attempt < 4; attempt++) {
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cw * scale));
    out.height = Math.max(1, Math.round(ch * scale));
    const octx = out.getContext('2d');
    if (!octx) return dataUrl;
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(cropped, 0, 0, out.width, out.height);
    const url = out.toDataURL('image/png');
    if (url.length <= MAX_CHARS) return url;
    scale *= 0.7;
  }
  throw new Error('SIGNATURE_TOO_LARGE');
}

export function ProfessionalSignature() {
  const role = useAuth((s) => s.user?.role);
  const allowed = role === 'PROFESSIONAL' || role === 'CLINIC_OWNER';

  const padRef = useRef<SignaturePadHandle>(null);
  const [data, setData] = useState<MySignature | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    apiFetch<MySignature>('/api/prescriptions/me/signature')
      .then(setData)
      .catch((err) => toast.error(errorMessage(err, 'No fue posible cargar tu firma.')))
      .finally(() => setLoading(false));
  }, [allowed]);

  if (!allowed) return null;

  async function save() {
    const raw = padRef.current?.toDataUrl();
    if (!raw) { toast.error('Dibuja tu firma antes de guardarla.'); return; }
    setSaving(true);
    try {
      const signatureImg = await prepareSignature(raw);
      await apiFetch('/api/prescriptions/me/signature', { method: 'PUT', body: { signatureImg } });
      setData((d) => (d ? { ...d, signatureImg } : d));
      setEditing(false);
      setHasInk(false);
      toast.success('Firma guardada. Aparecerá en tus recetas y documentos.');
    } catch (err) {
      toast.error((err as Error)?.message === 'SIGNATURE_TOO_LARGE'
        ? 'La firma es demasiado grande. Intenta con un trazo más simple.'
        : errorMessage(err, 'No fue posible guardar la firma.'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('¿Eliminar tu firma? Los documentos se imprimirán con la línea de firma en blanco.')) return;
    setSaving(true);
    try {
      await apiFetch('/api/prescriptions/me/signature', { method: 'PUT', body: { signatureImg: null } });
      setData((d) => (d ? { ...d, signatureImg: null } : d));
      toast.success('Firma eliminada.');
    } catch (err) {
      toast.error(errorMessage(err, 'No fue posible eliminar la firma.'));
    } finally {
      setSaving(false);
    }
  }

  const specialty = data?.specialty ? SPECIALTY_LABEL[data.specialty] ?? data.specialty : null;
  const detail = [specialty, data?.licenseNumber ? `Reg. profesional N.º ${data.licenseNumber}` : null]
    .filter(Boolean).join(' · ');

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>✍️ Mi firma para documentos</CardTitle>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            Se imprime automáticamente en las recetas y demás documentos que emitas, junto a tu nombre y registro profesional.
          </p>
        </div>
        {!loading && !editing && (
          <div className="flex gap-2">
            {data?.signatureImg && (
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={remove} disabled={saving}>
                Eliminar
              </Button>
            )}
            <Button size="sm" onClick={() => { setEditing(true); setHasInk(false); }}>
              {data?.signatureImg ? 'Cambiar firma' : 'Registrar mi firma'}
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="mt-5 h-40 animate-pulse rounded-xl bg-gray-100" />
      ) : editing ? (
        <div className="mt-5 space-y-3">
          <SignaturePad ref={padRef} height={180} onChange={setHasInk} hint="Firma aquí con el dedo, un lápiz óptico o el mouse" />
          <p className="text-xs text-gray-500">
            Consejo: firma grande y centrado. Guardamos solo el trazo, con fondo transparente, para que se vea natural sobre la línea de firma.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} loading={saving} disabled={!hasInk}>Guardar firma</Button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Vista previa tal como sale impresa */}
          <div className="rounded-xl border border-gray-200 bg-white px-6 pb-4 pt-3">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Así se ve en tus documentos</div>
            <div className="flex h-24 items-end justify-center">
              {data?.signatureImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.signatureImg} alt="Tu firma" className="max-h-24 max-w-full object-contain" />
              ) : (
                <span className="pb-2 text-xs italic text-gray-400">(sin firma registrada)</span>
              )}
            </div>
            <div className="border-t border-gray-800 pt-1 text-center text-xs font-semibold text-gray-900">
              {data?.fullName ?? '—'}
            </div>
            {detail && <div className="text-center text-[11px] text-gray-600">{detail}</div>}
            <div className="text-center text-[10px] uppercase tracking-widest text-gray-500">Profesional tratante</div>
          </div>

          <div className="space-y-2 text-sm">
            {data?.signatureImg ? (
              <div className="flex items-start gap-2 rounded-xl bg-green-50 px-4 py-3 text-green-800">
                <span aria-hidden>✓</span>
                <span>Tu firma está registrada y se incluirá en las recetas que firmes.</span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-amber-900">
                <span aria-hidden>ℹ️</span>
                <span>Aún no registras tu firma. Mientras tanto, las recetas saldrán con la línea de firma en blanco para firmar a mano.</span>
              </div>
            )}
            {!data?.licenseNumber && (
              <div className="flex items-start gap-2 rounded-xl bg-gray-50 px-4 py-3 text-gray-700">
                <span aria-hidden>🪪</span>
                <span>No tienes número de registro profesional configurado. Pídele al administrador que lo agregue en <strong>Profesionales</strong>.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Pad de firma manuscrita (dedo, stylus o mouse) sin librerías externas.
 * Adaptado de FirmaPad (proyecto ASM), que ya resolvió en producción:
 *  - escala por DPR fijada con setTransform (no se acumula al limpiar)
 *  - redimensionar sin perder lo firmado (ResizeObserver)
 *  - validar TINTA real en píxeles antes de exportar (nunca firma en blanco)
 *  - setPointerCapture tolerante a fallos (algunos Android lo rechazan)
 */
export interface SignaturePadHandle {
  /** Firma como data URL PNG, o null si no hay tinta. */
  toDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  onChange?: (hasInk: boolean) => void;
  height?: number;
  disabled?: boolean;
  hint?: string;
}

export const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { onChange, height = 180, disabled = false, hint = 'Firme aquí con el dedo o el mouse' },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  function fixScale(ctx: CanvasRenderingContext2D) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function syncSize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth;
    if (cssW <= 0) return;
    const w = Math.round(cssW * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width === w && canvas.height === h) return;

    let copy: HTMLCanvasElement | null = null;
    if (canvas.width > 0 && canvas.height > 0) {
      copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext('2d')?.drawImage(canvas, 0, 0);
    }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    if (copy) ctx.drawImage(copy, 0, 0, w, h);
    fixScale(ctx);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncSize();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(canvas);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    syncSize();
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* se firma igual */ }
    drawing.current = true;
    last.current = pos(e);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) { setEmpty(false); onChange?.(true); }
  }

  function onUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    last.current = null;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ok */ }
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    fixScale(ctx);
    setEmpty(true);
    onChange?.(false);
  }

  /** Mira los PÍXELES, no la bandera: una firma sin tinta no es comprobante. */
  function hasInk(canvas: HTMLCanvasElement): boolean {
    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return true;
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) {
          dark++;
          if (dark > 30) return true;
        }
      }
      return false;
    } catch {
      return true;
    }
  }

  useImperativeHandle(ref, () => ({
    isEmpty: () => {
      const canvas = canvasRef.current;
      return !canvas || !hasInk(canvas);
    },
    clear,
    toDataUrl: () => {
      const canvas = canvasRef.current;
      if (!canvas || empty || !hasInk(canvas)) return null;
      return canvas.toDataURL('image/png');
    },
  }));

  return (
    <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white">
      <canvas
        ref={canvasRef}
        className="block w-full cursor-crosshair rounded-t-xl"
        style={{ height, touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onPointerCancel={onUp}
      />
      <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2 text-xs">
        <span className={empty ? 'text-gray-400' : 'font-medium text-brand-700'}>
          {empty ? hint : '✓ Firmado'}
        </span>
        <button
          type="button"
          onClick={clear}
          disabled={disabled || empty}
          className="rounded-md px-2 py-1 font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
});

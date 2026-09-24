import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Isotipo Surco Health: cruz médica en teal sobre badge.
 * El id del degradado es único por instancia: si dos logos comparten id y el
 * primero está oculto (menú de escritorio en celular), el segundo sale vacío.
 */
export function LogoMark({ className }: { className?: string }) {
  const gradId = `surcoTeal-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={cn('h-9 w-9', className)} role="img" aria-label="Surco Health">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b8a6" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradId})`} />
      <g fill="#ffffff">
        <rect x="27" y="15" width="10" height="34" rx="3" />
        <rect x="15" y="27" width="34" height="10" rx="3" />
      </g>
    </svg>
  );
}

/** Logo completo: isotipo + wordmark SurcoHealth. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-xl font-bold tracking-tight text-gray-900">
        Surco<span className="text-care-600">Health</span>
      </span>
    </span>
  );
}

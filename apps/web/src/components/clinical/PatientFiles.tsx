'use client';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { apiBlobUrl, apiFetch, apiUpload } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { toast, errorMessage } from '@/components/ui/Toaster';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/auth-store';

// ─────────────────────────────────────────────────────────────
// Tipos y constantes
// ─────────────────────────────────────────────────────────────

type FileType =
  | 'RADIOGRAPHY'
  | 'CBCT'
  | 'LAB_RESULT'
  | 'CLINICAL_PHOTO'
  | 'REFERRAL_DOC'
  | 'PRESCRIPTION_PDF'
  | 'CONSENT_PDF'
  | 'REPORT'
  | 'OTHER';

interface ClinicalFile {
  id: string;
  patientId: string | null;
  type: FileType;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedBy: string;
  uploadedAt: string;
  uploadedByName: string | null;
}

type Filter = 'ALL' | FileType;
type UploadSource = 'picker' | 'camera' | 'drop';
type Kind = 'image' | 'pdf' | 'dicom' | 'other';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_BATCH = 10;
const MAX_ZOOM = 8;
const ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,application/pdf,.pdf,application/dicom,.dcm,.dicom';
const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf', 'application/dicom',
];
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'pdf', 'dcm', 'dicom'];
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];

const TYPE_INFO: Record<FileType, { label: string; short: string; icon: string; badge: string }> = {
  RADIOGRAPHY: { label: 'Radiografía', short: 'Radiografías', icon: '🩻', badge: 'bg-sky-50 text-sky-700 ring-sky-200' },
  CBCT: { label: 'Tomografía CBCT', short: 'Tomografías', icon: '🧊', badge: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  CLINICAL_PHOTO: { label: 'Foto clínica', short: 'Fotos', icon: '📷', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  LAB_RESULT: { label: 'Resultado de laboratorio', short: 'Laboratorio', icon: '🧪', badge: 'bg-violet-50 text-violet-700 ring-violet-200' },
  REFERRAL_DOC: { label: 'Remisión', short: 'Remisiones', icon: '📨', badge: 'bg-amber-50 text-amber-700 ring-amber-200' },
  PRESCRIPTION_PDF: { label: 'Receta', short: 'Recetas', icon: '💊', badge: 'bg-rose-50 text-rose-700 ring-rose-200' },
  CONSENT_PDF: { label: 'Consentimiento', short: 'Consentimientos', icon: '✍️', badge: 'bg-teal-50 text-teal-700 ring-teal-200' },
  REPORT: { label: 'Informe', short: 'Informes', icon: '📊', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
  OTHER: { label: 'Otro', short: 'Otros', icon: '📎', badge: 'bg-gray-100 text-gray-700 ring-gray-200' },
};

const TYPE_ORDER: FileType[] = [
  'RADIOGRAPHY', 'CBCT', 'CLINICAL_PHOTO', 'LAB_RESULT', 'REFERRAL_DOC',
  'PRESCRIPTION_PDF', 'CONSENT_PDF', 'REPORT', 'OTHER',
];

/** Tipos que se ofrecen al subir (los PDF de recetas/consentimientos los genera el sistema). */
const UPLOAD_TYPES: FileType[] = ['RADIOGRAPHY', 'CBCT', 'CLINICAL_PHOTO', 'LAB_RESULT', 'REFERRAL_DOC', 'OTHER'];

// ─────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────

const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${nf1.format(n / (1024 * 1024))} MB`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

function kindOf(mime: string): Kind {
  if (mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'application/dicom') return 'dicom';
  return 'other';
}

function isAllowedLocalFile(f: File): boolean {
  return ALLOWED_MIME.includes(f.type) || ALLOWED_EXT.includes(extOf(f.name));
}

function isLocalImage(f: File): boolean {
  return f.type.startsWith('image/') || IMAGE_EXT.includes(extOf(f.name));
}

function localKindIcon(f: File): string {
  const ext = extOf(f.name);
  if (f.type === 'application/pdf' || ext === 'pdf') return '📄';
  if (ext === 'dcm' || ext === 'dicom') return '🩻';
  return '🖼️';
}

/** Conserva la extensión original si el usuario la borró al renombrar. */
function withExtension(name: string, original: string): string {
  const clean = name.trim();
  if (!clean) return original;
  const ext = extOf(original);
  return ext && !extOf(clean) ? `${clean}.${ext}` : clean;
}

function cameraFileName(f: File): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  const ext = extOf(f.name) || 'jpg';
  return `foto-clinica-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}

function guessType(files: File[], source: UploadSource, filter: Filter): FileType {
  if (filter !== 'ALL' && UPLOAD_TYPES.includes(filter)) return filter;
  if (source === 'camera') return 'CLINICAL_PHOTO';
  const f = files[0];
  if (f && (f.type === 'application/pdf' || extOf(f.name) === 'pdf')) return 'LAB_RESULT';
  return 'RADIOGRAPHY';
}

function triggerDownload(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function fileErrorMessage(err: unknown, fallback: string): string {
  const code = (err as { message?: string })?.message ?? '';
  const extra: Record<string, string> = {
    FILE_NOT_FOUND: 'El archivo ya no está disponible.',
    FILE_EMPTY: 'El archivo está vacío.',
    FILE_REQUIRED: 'Selecciona un archivo para subir.',
    TOO_MANY_FILES: 'Sube un archivo a la vez.',
    MULTIPART_REQUIRED: 'No se pudo leer el archivo enviado.',
  };
  return extra[code] ?? errorMessage(err, fallback);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Cola con concurrencia limitada: las miniaturas se descargan de a pocas. */
function createQueue(concurrency: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  const next = () => {
    if (active >= concurrency) return;
    const job = waiting.shift();
    if (!job) return;
    active++;
    job();
  };
  return {
    run<T>(task: () => Promise<T>, priority = false): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const job = () => {
          task().then(resolve, reject).finally(() => {
            active--;
            next();
          });
        };
        if (priority) waiting.unshift(job);
        else waiting.push(job);
        next();
      });
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Íconos (trazo estilo Heroicons)
// ─────────────────────────────────────────────────────────────

function Svg({ children, className = 'h-5 w-5' }: { children: ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const ICON = {
  close: <path d="M6 18 18 6M6 6l12 12" />,
  left: <path d="M15.75 19.5 8.25 12l7.5-7.5" />,
  right: <path d="m8.25 4.5 7.5 7.5-7.5 7.5" />,
  plus: <path d="M12 4.5v15m7.5-7.5h-15" />,
  minus: <path d="M19.5 12h-15" />,
  download: <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />,
  archive: (
    <path d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
  ),
  sun: (
    <path d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
  ),
  contrast: (
    <>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 3.75a8.25 8.25 0 0 1 0 16.5Z" fill="currentColor" />
    </>
  ),
  invert: <path d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />,
  fit: (
    <path d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
  ),
  sparkles: (
    <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
  ),
  reset: (
    <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
  ),
  sliders: (
    <path d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
  ),
  lock: (
    <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
  ),
  cloud: (
    <path d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
  ),
  check: <path d="m4.5 12.75 6 6 9-13.5" />,
  alert: <path d="M12 9v3.75m0 3.75h.008v.008H12v-.008ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
};

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────

export function PatientFiles({ patientId }: { patientId: string }) {
  const role = useAuth((s) => s.user?.role);
  const canUpload = role === 'CLINIC_OWNER' || role === 'PROFESSIONAL' || role === 'RECEPTIONIST';
  const canView = role === 'CLINIC_OWNER' || role === 'PROFESSIONAL';
  const canArchive = canView;

  const [files, setFiles] = useState<ClinicalFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [pending, setPending] = useState<{ files: File[]; source: UploadSource } | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [toArchive, setToArchive] = useState<ClinicalFile | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());

  const pickerRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Cache de object URLs autenticados (se revocan al desmontar) ──
  const blobCache = useRef(new Map<string, string>());
  const inflight = useRef(new Map<string, Promise<string>>());
  const alive = useRef(true);
  const queueRef = useRef<ReturnType<typeof createQueue> | null>(null);
  if (!queueRef.current) queueRef.current = createQueue(2);

  useEffect(() => {
    alive.current = true;
    const cache = blobCache.current;
    return () => {
      alive.current = false;
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
      if (freshTimer.current) clearTimeout(freshTimer.current);
    };
  }, []);

  const getBlobUrl = useCallback((id: string, priority = false): Promise<string> => {
    const hit = blobCache.current.get(id);
    if (hit) return Promise.resolve(hit);
    const running = inflight.current.get(id);
    if (running) return running;
    const p = queueRef.current!
      .run(() => apiBlobUrl(`/api/files/${id}/content`), priority)
      .then((url) => {
        if (!alive.current) {
          URL.revokeObjectURL(url);
          throw new Error('UNMOUNTED');
        }
        blobCache.current.set(id, url);
        return url;
      })
      .finally(() => inflight.current.delete(id));
    inflight.current.set(id, p);
    return p;
  }, []);

  const dropFromCache = useCallback((id: string) => {
    const url = blobCache.current.get(id);
    if (url) URL.revokeObjectURL(url);
    blobCache.current.delete(id);
  }, []);

  // ── Carga del listado ──
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<ClinicalFile[]>(`/api/files?patientId=${encodeURIComponent(patientId)}`);
      setFiles(data);
    } catch (err) {
      setLoadError(fileErrorMessage(err, 'No se pudieron cargar los archivos del paciente.'));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  // Evita que soltar un archivo fuera de la zona haga que el navegador lo abra y se salga de la app.
  useEffect(() => {
    const prevent = (e: DragEvent) => {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
    };
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  // ── Derivados ──
  const counts = useMemo(() => {
    const c: Partial<Record<FileType, number>> = {};
    for (const f of files) c[f.type] = (c[f.type] ?? 0) + 1;
    return c;
  }, [files]);

  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.sizeBytes, 0), [files]);
  const filtered = useMemo(() => (filter === 'ALL' ? files : files.filter((f) => f.type === filter)), [files, filter]);
  const images = useMemo(() => filtered.filter((f) => kindOf(f.mimeType) === 'image'), [filtered]);
  const viewerFile = viewerId ? images.find((f) => f.id === viewerId) : undefined;

  useEffect(() => {
    if (filter !== 'ALL' && !counts[filter]) setFilter('ALL');
  }, [filter, counts]);

  useEffect(() => {
    if (viewerId && !viewerFile) setViewerId(null);
  }, [viewerId, viewerFile]);

  // ── Selección de archivos ──
  const handleFiles = useCallback((list: FileList | File[] | null, source: UploadSource) => {
    if (!list) return;
    let valid: File[] = [];
    for (const raw of Array.from(list)) {
      if (!isAllowedLocalFile(raw)) {
        toast.error(`«${raw.name}»: tipo no permitido. Usa JPG, PNG, WEBP, HEIC, PDF o DICOM.`);
        continue;
      }
      if (raw.size > MAX_BYTES) {
        toast.error(`«${raw.name}» supera el máximo de 25 MB.`);
        continue;
      }
      if (raw.size === 0) {
        toast.error(`«${raw.name}» está vacío.`);
        continue;
      }
      valid.push(source === 'camera' ? new File([raw], cameraFileName(raw), { type: raw.type }) : raw);
    }
    if (valid.length > MAX_BATCH) {
      toast.info(`Puedes subir hasta ${MAX_BATCH} archivos a la vez; se tomaron los primeros ${MAX_BATCH}.`);
      valid = valid.slice(0, MAX_BATCH);
    }
    if (valid.length > 0) setPending({ files: valid, source });
  }, []);

  const onUploaded = useCallback((uploaded: ClinicalFile[], type: FileType) => {
    setPending(null);
    if (uploaded.length === 0) return;
    toast.success(
      uploaded.length === 1 ? 'Archivo subido correctamente.' : `${uploaded.length} archivos subidos correctamente.`,
    );
    setFiles((prev) => [...[...uploaded].reverse(), ...prev]);
    setFilter((f) => (f === 'ALL' || f === type ? f : 'ALL'));
    setFresh(new Set(uploaded.map((u) => u.id)));
    if (freshTimer.current) clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setFresh(new Set()), 4000);
  }, []);

  // ── Abrir / descargar ──
  const downloadFile = useCallback(async (file: ClinicalFile) => {
    try {
      const cached = blobCache.current.get(file.id);
      if (cached) {
        triggerDownload(cached, file.fileName);
        return;
      }
      const url = await apiBlobUrl(`/api/files/${file.id}/content`);
      triggerDownload(url, file.fileName);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      toast.error(fileErrorMessage(err, 'No se pudo descargar el archivo.'));
    }
  }, []);

  const openPdf = useCallback(async (file: ClinicalFile) => {
    // La pestaña se abre YA (dentro del clic) para que el navegador no la bloquee como popup.
    const win = window.open('', '_blank');
    if (win) {
      win.document.title = file.fileName;
      win.document.body.style.cssText = 'margin:0;font-family:system-ui,sans-serif;color:#475569;display:flex;align-items:center;justify-content:center;height:100vh';
      win.document.body.textContent = 'Cargando documento…';
    }
    try {
      const url = await apiBlobUrl(`/api/files/${file.id}/content`);
      if (win && !win.closed) win.location.href = url;
      else triggerDownload(url, file.fileName);
      setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
    } catch (err) {
      win?.close();
      toast.error(fileErrorMessage(err, 'No se pudo abrir el documento.'));
    }
  }, []);

  const openFile = useCallback((file: ClinicalFile) => {
    if (!canView) {
      toast.info('Solo el profesional o el administrador de la clínica pueden abrir los archivos clínicos.');
      return;
    }
    const kind = kindOf(file.mimeType);
    if (kind === 'image') setViewerId(file.id);
    else if (kind === 'pdf') void openPdf(file);
    else {
      void downloadFile(file);
      if (kind === 'dicom') toast.info('Archivo DICOM descargado. Ábrelo con tu visor DICOM.');
    }
  }, [canView, openPdf, downloadFile]);

  // ── Archivar ──
  const confirmArchive = useCallback(async () => {
    if (!toArchive) return;
    const target = toArchive;
    setArchiving(true);
    try {
      await apiFetch(`/api/files/${target.id}`, { method: 'DELETE', body: {} });
      if (viewerId === target.id) {
        const idx = images.findIndex((f) => f.id === target.id);
        const neighbor = images[idx + 1] ?? images[idx - 1] ?? null;
        setViewerId(neighbor ? neighbor.id : null);
      }
      setFiles((prev) => prev.filter((f) => f.id !== target.id));
      dropFromCache(target.id);
      setToArchive(null);
      toast.success('Archivo archivado.');
    } catch (err) {
      toast.error(fileErrorMessage(err, 'No se pudo archivar el archivo.'));
    } finally {
      setArchiving(false);
    }
  }, [toArchive, viewerId, images, dropFromCache]);

  const closeViewer = useCallback(() => setViewerId(null), []);

  // ── Arrastrar y soltar ──
  const dndEnabled = canUpload && !pending && !viewerId && !toArchive;
  const hasFiles = (e: ReactDragEvent) => Array.from(e.dataTransfer.types).includes('Files');
  const onDragEnter = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dndEnabled || !hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };
  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dndEnabled || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dndEnabled || !hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragActive(false);
  };
  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!dndEnabled) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    handleFiles(e.dataTransfer.files, 'drop');
  };

  const openPicker = () => pickerRef.current?.click();
  const openCamera = () => cameraRef.current?.click();

  return (
    <Card
      className="relative p-4 sm:p-6"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span aria-hidden="true">🩻</span> Radiografías y archivos
          </CardTitle>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading
              ? 'Cargando archivos…'
              : files.length === 0
                ? 'Imágenes diagnósticas, fotos clínicas y documentos del paciente'
                : `${files.length} ${files.length === 1 ? 'archivo' : 'archivos'} · ${formatBytes(totalBytes)}`}
          </p>
        </div>
        {canUpload && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openCamera} className="flex-1 sm:flex-none lg:hidden">
              📷 Tomar foto
            </Button>
            <Button onClick={openPicker} className="flex-1 sm:flex-none">
              ⬆️ Subir archivo
            </Button>
          </div>
        )}
        <input
          ref={pickerRef} type="file" accept={ACCEPT} multiple className="hidden"
          onChange={(e) => { handleFiles(e.target.files, 'picker'); e.target.value = ''; }}
        />
        <input
          ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={(e) => { handleFiles(e.target.files, 'camera'); e.target.value = ''; }}
        />
      </div>

      {/* Filtros por tipo */}
      {loading ? (
        <div className="mt-4 flex gap-2">
          {[64, 112, 88].map((w) => (
            <div key={w} className="h-8 animate-pulse rounded-full bg-gray-100" style={{ width: w }} />
          ))}
        </div>
      ) : files.length > 0 ? (
        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip active={filter === 'ALL'} onClick={() => setFilter('ALL')} label="Todos" count={files.length} />
          {TYPE_ORDER.filter((t) => counts[t]).map((t) => (
            <Chip
              key={t}
              active={filter === t}
              onClick={() => setFilter(t)}
              icon={TYPE_INFO[t].icon}
              label={TYPE_INFO[t].short}
              count={counts[t] ?? 0}
            />
          ))}
        </div>
      ) : null}

      {/* Contenido */}
      <div className="mt-4">
        {loading ? (
          <GridSkeleton />
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50/50 px-6 py-10 text-center">
            <span className="text-red-500"><Svg className="h-8 w-8">{ICON.alert}</Svg></span>
            <p className="mt-2 text-sm font-medium text-gray-900">{loadError}</p>
            <Button variant="secondary" size="sm" className="mt-4" onClick={load}>Reintentar</Button>
          </div>
        ) : files.length === 0 ? (
          <EmptyState canUpload={canUpload} onUpload={openPicker} onCamera={openCamera} />
        ) : (
          <>
            {canUpload && (
              <button
                type="button"
                onClick={openPicker}
                className="mb-4 hidden w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 text-sm text-gray-500 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 sm:flex"
              >
                <Svg className="h-5 w-5 shrink-0">{ICON.cloud}</Svg>
                <span>
                  <span className="font-medium text-gray-700">Arrastra y suelta</span> radiografías o documentos aquí, o{' '}
                  <span className="font-medium text-brand-700">haz clic para elegir</span>
                </span>
                <span className="hidden text-xs text-gray-400 lg:inline">JPG · PNG · HEIC · PDF · DICOM · máx. 25 MB</span>
              </button>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {filtered.map((f) => (
                <FileCard
                  key={f.id}
                  file={f}
                  canView={canView}
                  canArchive={canArchive}
                  highlight={fresh.has(f.id)}
                  getBlobUrl={getBlobUrl}
                  onOpen={() => openFile(f)}
                  onArchive={() => setToArchive(f)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Capa al arrastrar archivos */}
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-500 bg-brand-50/90 text-brand-700 backdrop-blur-sm">
          <Svg className="h-12 w-12">{ICON.cloud}</Svg>
          <p className="mt-2 text-base font-semibold">Suelta aquí para subir</p>
          <p className="text-sm text-brand-600">Radiografías, fotos o PDF · máx. 25 MB</p>
        </div>
      )}

      {pending && (
        <UploadModal
          patientId={patientId}
          files={pending.files}
          defaultType={guessType(pending.files, pending.source, filter)}
          onCancel={() => setPending(null)}
          onDone={onUploaded}
        />
      )}

      {viewerFile && (
        <ImageViewer
          files={images}
          current={viewerFile}
          getBlobUrl={getBlobUrl}
          paused={!!toArchive}
          canArchive={canArchive}
          onNavigate={setViewerId}
          onClose={closeViewer}
          onArchive={setToArchive}
          onDownload={downloadFile}
        />
      )}

      {toArchive &&
        createPortal(
          <div className="relative z-[58]">
            <Modal open onClose={() => { if (!archiving) setToArchive(null); }} title="¿Archivar este archivo?" size="sm">
              <p className="text-sm text-gray-600">
                «<span className="break-all font-medium text-gray-900">{toArchive.fileName}</span>» dejará de aparecer en la lista del paciente.
              </p>
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                Por normativa de historia clínica no se borra: queda archivado y registrado en la auditoría.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setToArchive(null)} disabled={archiving}>Cancelar</Button>
                <Button variant="danger" onClick={confirmArchive} loading={archiving}>Archivar</Button>
              </div>
            </Modal>
          </div>,
          document.body,
        )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Piezas del listado
// ─────────────────────────────────────────────────────────────

function Chip({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon?: string; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
      <span
        className={cn(
          'min-w-[1.25rem] rounded-full px-1.5 text-center text-xs tabular-nums',
          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
          <div className="aspect-[4/3] animate-pulse bg-gray-100" />
          <div className="space-y-2 p-3">
            <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  canUpload, onUpload, onCamera,
}: { canUpload: boolean; onUpload: () => void; onCamera: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gradient-to-b from-brand-50/70 to-white px-6 py-12 text-center sm:py-16">
      <div className="relative mb-5">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl shadow-sm ring-1 ring-brand-100">
          🩻
        </div>
        <div className="absolute -bottom-1 -right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm ring-1 ring-brand-100">
          🦷
        </div>
      </div>
      <h3 className="text-base font-semibold text-gray-900">Aún no hay radiografías ni archivos</h3>
      <p className="mt-1.5 max-w-md text-sm text-gray-500">
        Sube radiografías periapicales o panorámicas, tomografías, fotos clínicas y resultados de laboratorio.
        Quedan guardados de forma segura en la historia del paciente.
      </p>
      {canUpload ? (
        <>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button onClick={onUpload}>⬆️ Subir archivo</Button>
            <Button variant="secondary" onClick={onCamera} className="lg:hidden">📷 Tomar foto</Button>
          </div>
          <p className="mt-3 hidden text-xs text-gray-400 sm:block">
            o arrastra y suelta aquí · JPG, PNG, HEIC, PDF o DICOM · máx. 25 MB
          </p>
        </>
      ) : (
        <p className="mt-4 text-xs text-gray-400">Tu rol no permite subir archivos.</p>
      )}
    </div>
  );
}

function FileCard({
  file, canView, canArchive, highlight, getBlobUrl, onOpen, onArchive,
}: {
  file: ClinicalFile;
  canView: boolean;
  canArchive: boolean;
  highlight: boolean;
  getBlobUrl: (id: string, priority?: boolean) => Promise<string>;
  onOpen: () => void;
  onArchive: () => void;
}) {
  const info = TYPE_INFO[file.type] ?? TYPE_INFO.OTHER;
  const kind = kindOf(file.mimeType);
  const action = !canView ? null : kind === 'image' ? '🔍 Ver' : kind === 'pdf' ? '📄 Abrir' : '⬇️ Descargar';

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md',
        highlight && 'ring-2 ring-brand-500 ring-offset-2',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        title={file.fileName}
        className="relative block aspect-[4/3] w-full overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
      >
        <FileThumb file={file} canView={canView} getBlobUrl={getBlobUrl} />
        <span
          className={cn(
            'absolute left-2 top-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm ring-1 backdrop-blur',
            info.badge,
          )}
        >
          <span aria-hidden="true">{info.icon}</span>
          <span className="truncate">{info.label}</span>
        </span>
        {action && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-200 group-hover:bg-black/30 group-hover:opacity-100">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-900 shadow">{action}</span>
          </span>
        )}
      </button>
      <div className="flex items-start gap-1 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900" title={file.fileName}>{file.fileName}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            <span className="whitespace-nowrap">{formatDate(file.uploadedAt)}</span>
            {' · '}
            <span className="whitespace-nowrap">{formatBytes(file.sizeBytes)}</span>
          </p>
          {file.uploadedByName && (
            <p className="mt-0.5 truncate text-[11px] text-gray-400">Subido por {file.uploadedByName}</p>
          )}
        </div>
        {canArchive && (
          <button
            type="button"
            onClick={onArchive}
            title="Archivar"
            aria-label={`Archivar ${file.fileName}`}
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <Svg className="h-4 w-4">{ICON.archive}</Svg>
          </button>
        )}
      </div>
    </div>
  );
}

function FileThumb({
  file, canView, getBlobUrl,
}: { file: ClinicalFile; canView: boolean; getBlobUrl: (id: string, priority?: boolean) => Promise<string> }) {
  const kind = kindOf(file.mimeType);
  const dark = file.type === 'RADIOGRAPHY' || file.type === 'CBCT';
  const wantsPreview = canView && kind === 'image';

  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Solo se descarga cuando la tarjeta entra en pantalla.
  useEffect(() => {
    if (!wantsPreview) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [wantsPreview]);

  useEffect(() => {
    if (!visible || !wantsPreview) return;
    let cancelled = false;
    getBlobUrl(file.id)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [visible, wantsPreview, file.id, getBlobUrl]);

  if (!wantsPreview || failed) {
    const ext = extOf(file.fileName).toUpperCase();
    const isDicom = kind === 'dicom';
    return (
      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center gap-1.5 pt-6',
          isDicom || dark ? 'bg-gradient-to-b from-slate-800 to-black text-white' : 'bg-gradient-to-b from-gray-50 to-gray-100 text-gray-500',
        )}
      >
        <span className="text-4xl drop-shadow-sm" aria-hidden="true">
          {kind === 'pdf' ? '📄' : isDicom ? '🩻' : TYPE_INFO[file.type]?.icon ?? '🖼️'}
        </span>
        <span className={cn('text-[11px] font-semibold tracking-wide', isDicom || dark ? 'text-white/70' : 'text-gray-400')}>
          {kind === 'pdf' ? 'PDF' : isDicom ? 'DICOM' : ext || 'ARCHIVO'}
        </span>
        {!canView && (
          <span className={cn('mt-1 inline-flex items-center gap-1 text-[10px]', dark ? 'text-white/60' : 'text-gray-400')}>
            <Svg className="h-3 w-3">{ICON.lock}</Svg> Solo profesionales
          </span>
        )}
        {canView && failed && kind === 'image' && (
          <span className={cn('mt-1 text-[10px]', dark ? 'text-white/60' : 'text-gray-400')}>Vista previa no disponible</span>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className={cn('absolute inset-0', dark ? 'bg-black' : 'bg-gray-100')}>
      {!loaded && <div className={cn('absolute inset-0 animate-pulse', dark ? 'bg-gray-800' : 'bg-gray-200')} />}
      {url && (
        <img
          src={url}
          alt={file.fileName}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 h-full w-full transition duration-300 group-hover:scale-[1.03]',
            dark ? 'object-contain' : 'object-cover',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Modal de subida
// ─────────────────────────────────────────────────────────────

type UploadStatus = 'pending' | 'uploading' | 'done' | 'error';

function UploadModal({
  patientId, files, defaultType, onCancel, onDone,
}: {
  patientId: string;
  files: File[];
  defaultType: FileType;
  onCancel: () => void;
  onDone: (uploaded: ClinicalFile[], type: FileType) => void;
}) {
  const single = files.length === 1;
  const [type, setType] = useState<FileType>(defaultType);
  const [name, setName] = useState(single ? files[0].name : '');
  const [uploading, setUploading] = useState(false);
  const [statuses, setStatuses] = useState<UploadStatus[]>(() => files.map((): UploadStatus => 'pending'));
  const [previews, setPreviews] = useState<(string | null)[]>([]);
  const [previewFailed, setPreviewFailed] = useState<Set<number>>(() => new Set());

  // Vistas previas locales (se revocan al cerrar).
  useEffect(() => {
    const urls = files.map((f) => (isLocalImage(f) ? URL.createObjectURL(f) : null));
    setPreviews(urls);
    return () => urls.forEach((u) => { if (u) URL.revokeObjectURL(u); });
  }, [files]);

  const done = statuses.filter((s) => s === 'done').length;
  const current = statuses.findIndex((s) => s === 'uploading');
  const hasErrors = statuses.includes('error');

  const setStatus = (i: number, s: UploadStatus) =>
    setStatuses((prev) => prev.map((v, j) => (j === i ? s : v)));

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (uploading) return;
    setUploading(true);
    const uploaded: ClinicalFile[] = [];
    let failures = 0;
    for (let i = 0; i < files.length; i++) {
      if (statuses[i] === 'done') continue;
      const f = files[i];
      setStatus(i, 'uploading');
      const form = new FormData();
      form.append('patientId', patientId);
      form.append('type', type);
      form.append('file', f, single ? withExtension(name, f.name) : f.name);
      try {
        const res = await apiUpload<ClinicalFile>('/api/files', form);
        uploaded.push(res);
        setStatus(i, 'done');
      } catch (err) {
        failures++;
        setStatus(i, 'error');
        const msg = fileErrorMessage(err, 'No se pudo subir el archivo.');
        toast.error(single ? msg : `«${f.name}»: ${msg}`);
      }
    }
    setUploading(false);
    // Si todo falló, el modal queda abierto para reintentar o cancelar.
    if (uploaded.length > 0 || failures === 0) onDone(uploaded, type);
  };

  const iconBox = (i: number, big: boolean) => {
    const url = previews[i];
    if (url && !previewFailed.has(i)) {
      return (
        <img
          src={url}
          alt=""
          className={cn('max-h-full max-w-full', big ? 'object-contain' : 'h-full w-full object-cover')}
          onError={() => setPreviewFailed((prev) => new Set(prev).add(i))}
        />
      );
    }
    return <span className={big ? 'text-5xl' : 'text-xl'} aria-hidden="true">{localKindIcon(files[i])}</span>;
  };

  return (
    <Modal
      open
      onClose={() => { if (!uploading) onCancel(); }}
      title={single ? 'Subir archivo' : `Subir ${files.length} archivos`}
      size="md"
    >
      <form onSubmit={submit}>
        <div className="-mr-2 max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          {single ? (
            <>
              <div className="flex h-44 items-center justify-center overflow-hidden rounded-xl bg-gray-900 ring-1 ring-gray-200 [@media(max-height:720px)]:h-28">
                {iconBox(0, true)}
              </div>
              <Input
                label="Nombre del archivo"
                value={name}
                maxLength={180}
                disabled={uploading}
                onChange={(e) => setName(e.target.value)}
                hint={`${formatBytes(files[0].size)}${extOf(files[0].name) ? ` · ${extOf(files[0].name).toUpperCase()}` : ''}`}
              />
            </>
          ) : (
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-3 p-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-900">
                    {iconBox(i, false)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-900">{f.name}</p>
                    <p className="text-xs text-gray-500">{formatBytes(f.size)}</p>
                  </div>
                  <span className="w-5 shrink-0">
                    {statuses[i] === 'uploading' && <Spinner className="h-4 w-4 text-brand-600" />}
                    {statuses[i] === 'done' && <span className="text-green-600"><Svg className="h-5 w-5">{ICON.check}</Svg></span>}
                    {statuses[i] === 'error' && <span className="text-red-500"><Svg className="h-5 w-5">{ICON.alert}</Svg></span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-gray-700">¿Qué tipo de archivo es?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {UPLOAD_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  disabled={uploading}
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center text-xs font-medium leading-tight transition disabled:opacity-60',
                    type === t
                      ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-100'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <span className="text-xl" aria-hidden="true">{TYPE_INFO[t].icon}</span>
                  {TYPE_INFO[t].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {!single && (uploading || done > 0) && (
            <span className="mr-auto text-xs text-gray-500">
              {uploading ? `Subiendo ${Math.max(current, 0) + 1} de ${files.length}…` : `${done} de ${files.length} subidos`}
            </span>
          )}
          <Button type="button" variant="secondary" onClick={onCancel} disabled={uploading}>
            Cancelar
          </Button>
          <Button type="submit" loading={uploading}>
            {uploading ? 'Subiendo…' : hasErrors ? 'Reintentar' : single ? 'Subir' : `Subir ${files.length}`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// Visor de imágenes (lightbox) con zoom, brillo, contraste y negativo
// ─────────────────────────────────────────────────────────────

interface View { zoom: number; x: number; y: number }
interface Pt { x: number; y: number }
type Gesture =
  | { mode: 'pan'; start: Pt; startView: View; t0: number; moved: boolean }
  | { mode: 'pinch'; startDist: number; startMid: Pt; startView: View };

const IDENTITY: View = { zoom: 1, x: 0, y: 0 };
const ENHANCE = { brightness: 110, contrast: 160 };

function ImageViewer({
  files, current, getBlobUrl, paused, canArchive, onNavigate, onClose, onArchive, onDownload,
}: {
  files: ClinicalFile[];
  current: ClinicalFile;
  getBlobUrl: (id: string, priority?: boolean) => Promise<string>;
  paused: boolean;
  canArchive: boolean;
  onNavigate: (id: string) => void;
  onClose: () => void;
  onArchive: (f: ClinicalFile) => void;
  onDownload: (f: ClinicalFile) => void;
}) {
  const index = Math.max(0, files.findIndex((f) => f.id === current.id));
  const info = TYPE_INFO[current.type] ?? TYPE_INFO.OTHER;

  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<View>(IDENTITY);
  const [dragging, setDragging] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [showAdjust, setShowAdjust] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);

  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null);
  // Lista actual en un ref: precargar vecinas sin recargar la imagen cuando la lista cambia.
  const filesRef = useRef(files);
  filesRef.current = files;

  // Cargar imagen actual (prioridad) y precargar vecinas.
  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setFailed(false);
    setView(IDENTITY);
    getBlobUrl(current.id, true)
      .then((u) => {
        if (cancelled) return;
        setUrl(u);
        const list = filesRef.current;
        const i = list.findIndex((f) => f.id === current.id);
        if (i === -1 || list.length < 2) return;
        const neighbors = [list[(i + 1) % list.length], list[(i - 1 + list.length) % list.length]];
        for (const n of neighbors) {
          if (n.id !== current.id) getBlobUrl(n.id).catch(() => undefined);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setFailed(true);
        toast.error(fileErrorMessage(err, 'No se pudo cargar la imagen.'));
      });
    return () => { cancelled = true; };
  }, [current.id, getBlobUrl]);

  // Bloquear el scroll de la página mientras el visor está abierto.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [paused]);

  const clampView = useCallback((v: View): View => {
    if (v.zoom <= 1.001) return IDENTITY;
    const stage = stageRef.current;
    if (!stage) return v;
    const img = imgRef.current;
    const w = img?.offsetWidth || stage.clientWidth;
    const h = img?.offsetHeight || stage.clientHeight;
    const maxX = Math.max(0, (w * v.zoom - stage.clientWidth) / 2);
    const maxY = Math.max(0, (h * v.zoom - stage.clientHeight) / 2);
    return { zoom: v.zoom, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
  }, []);

  /** Zoom manteniendo fijo el punto `p` (coordenadas relativas al centro del lienzo). */
  const zoomAt = useCallback((factor: number, p: Pt = { x: 0, y: 0 }) => {
    setView((v) => {
      const z = clamp(v.zoom * factor, 1, MAX_ZOOM);
      const k = z / v.zoom;
      return clampView({ zoom: z, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k });
    });
  }, [clampView]);

  const toStage = useCallback((clientX: number, clientY: number): Pt => {
    const el = stageRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  }, []);

  const goPrev = useCallback(() => {
    if (files.length < 2) return;
    onNavigate(files[(index - 1 + files.length) % files.length].id);
  }, [files, index, onNavigate]);

  const goNext = useCallback(() => {
    if (files.length < 2) return;
    onNavigate(files[(index + 1) % files.length].id);
  }, [files, index, onNavigate]);

  // Rueda del mouse / pellizco en trackpad → zoom (listener no pasivo para poder prevenir el scroll).
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0015));
      zoomAt(factor, toStage(e.clientX, e.clientY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, toStage]);

  // Teclado: Esc, ← →, + −, 0, I.
  useEffect(() => {
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      switch (e.key) {
        case 'ArrowLeft': goPrev(); break;
        case 'ArrowRight': goNext(); break;
        case '+': case '=': zoomAt(1.25); break;
        case '-': case '_': zoomAt(0.8); break;
        case '0': setView(IDENTITY); break;
        case 'i': case 'I': setInvert((v) => !v); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paused, onClose, goPrev, goNext, zoomAt]);

  // ── Gestos: arrastrar para mover, pellizcar para zoom, doble toque, deslizar para navegar ──
  const beginPan = (p: Pt, moved = false) => {
    gesture.current = { mode: 'pan', start: p, startView: viewRef.current, t0: Date.now(), moved };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      beginPan({ x: e.clientX, y: e.clientY });
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      gesture.current = {
        mode: 'pinch',
        startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startMid: toStage((a.x + b.x) / 2, (a.y + b.y) / 2),
        startView: viewRef.current,
      };
    }
    setDragging(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.mode === 'pan') {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) g.moved = true;
      if (g.startView.zoom > 1) {
        setView(clampView({ zoom: g.startView.zoom, x: g.startView.x + dx, y: g.startView.y + dy }));
      }
    } else if (pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = toStage((a.x + b.x) / 2, (a.y + b.y) / 2);
      const z = clamp(g.startView.zoom * (dist / g.startDist), 1, MAX_ZOOM);
      const k = z / g.startView.zoom;
      setView(clampView({
        zoom: z,
        x: mid.x - (g.startMid.x - g.startView.x) * k,
        y: mid.y - (g.startMid.y - g.startView.y) * k,
      }));
    }
  };

  const endPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!cancelled && g?.mode === 'pan' && pointers.current.size === 0) {
      const dx = e.clientX - g.start.x;
      const dy = e.clientY - g.start.y;
      if (!g.moved && Date.now() - g.t0 < 350) {
        const now = Date.now();
        const lt = lastTap.current;
        if (lt && now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
          lastTap.current = null;
          if (viewRef.current.zoom > 1) setView(IDENTITY);
          else zoomAt(2.5, toStage(e.clientX, e.clientY));
        } else {
          lastTap.current = { t: now, x: e.clientX, y: e.clientY };
        }
      } else if (g.startView.zoom <= 1 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0) goNext();
        else goPrev();
      }
    }
    if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values());
      beginPan(p, true);
    } else if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    }
  };

  const filtersChanged = brightness !== 100 || contrast !== 100 || invert;
  const enhanced = brightness === ENHANCE.brightness && contrast === ENHANCE.contrast;
  const resetFilters = () => { setBrightness(100); setContrast(100); setInvert(false); };
  const toggleEnhance = () => {
    if (enhanced) { setBrightness(100); setContrast(100); }
    else { setBrightness(ENHANCE.brightness); setContrast(ENHANCE.contrast); }
  };

  const cursor = view.zoom > 1 ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in';

  return createPortal(
    <div
      className="fixed inset-0 z-[55] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`Visor de imagen: ${current.fileName}`}
    >
      {/* Barra superior */}
      <div className="flex items-center gap-2 border-b border-white/10 bg-black/80 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/90 sm:inline-flex">
              <span aria-hidden="true">{info.icon}</span> {info.label}
            </span>
            <p className="truncate text-sm font-medium">{current.fileName}</p>
          </div>
          <p className="mt-0.5 truncate text-xs text-white/50">
            {formatDateTime(current.uploadedAt)}
            {current.uploadedByName ? ` · ${current.uploadedByName}` : ''} · {formatBytes(current.sizeBytes)}
          </p>
        </div>
        {files.length > 1 && (
          <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs tabular-nums text-white/70">
            {index + 1} / {files.length}
          </span>
        )}
        <ViewerButton title="Descargar" onClick={() => onDownload(current)}>
          <Svg>{ICON.download}</Svg>
        </ViewerButton>
        {canArchive && (
          <ViewerButton title="Archivar" onClick={() => onArchive(current)} className="hover:bg-red-600/80">
            <Svg>{ICON.archive}</Svg>
          </ViewerButton>
        )}
        <ViewerButton title="Cerrar (Esc)" onClick={onClose}>
          <Svg>{ICON.close}</Svg>
        </ViewerButton>
      </div>

      {/* Lienzo */}
      <div
        ref={stageRef}
        className={cn('relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden p-2 sm:p-6', cursor)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
      >
        {!url && !failed && (
          <div className="flex flex-col items-center gap-3 text-white/60">
            <Spinner className="h-8 w-8" />
            <span className="text-sm">Cargando imagen…</span>
          </div>
        )}

        {failed && (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-white/70">
            <span className="text-5xl" aria-hidden="true">🖼️</span>
            <p className="max-w-xs text-sm">No es posible mostrar la vista previa de este archivo en este navegador.</p>
            <Button variant="secondary" size="sm" onClick={() => onDownload(current)}>Descargar archivo</Button>
          </div>
        )}

        {url && !failed && (
          <img
            ref={imgRef}
            src={url}
            alt={current.fileName}
            draggable={false}
            onError={() => setFailed(true)}
            className="max-h-full max-w-full object-contain shadow-2xl"
            style={{
              transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.zoom})`,
              filter: `brightness(${brightness / 100}) contrast(${contrast / 100})${invert ? ' invert(1)' : ''}`,
              transition: dragging ? 'filter 150ms ease' : 'transform 120ms ease-out, filter 150ms ease',
              willChange: 'transform',
            }}
          />
        )}

        {files.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              title="Anterior (←)"
              aria-label="Imagen anterior"
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70 sm:left-4 sm:h-12 sm:w-12"
            >
              <Svg className="h-6 w-6">{ICON.left}</Svg>
            </button>
            <button
              type="button"
              onClick={goNext}
              title="Siguiente (→)"
              aria-label="Imagen siguiente"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-black/70 sm:right-4 sm:h-12 sm:w-12"
            >
              <Svg className="h-6 w-6">{ICON.right}</Svg>
            </button>
          </>
        )}

        {url && !failed && view.zoom === 1 && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/60 backdrop-blur md:block">
            Rueda: zoom · Doble clic: acercar · Arrastrar: mover · ← →: navegar · Esc: cerrar
          </p>
        )}
      </div>

      {/* Barra inferior: zoom y ajustes de imagen */}
      <div className="border-t border-white/10 bg-black/80 px-3 py-2 sm:px-5 sm:py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-0.5 rounded-full bg-white/10 p-1">
            <ViewerButton small title="Alejar (−)" onClick={() => zoomAt(0.8)} disabled={view.zoom <= 1}>
              <Svg className="h-4 w-4">{ICON.minus}</Svg>
            </ViewerButton>
            <button
              type="button"
              onClick={() => setView(IDENTITY)}
              title="Restablecer zoom (0)"
              className="min-w-[3.5rem] rounded-full px-1 text-center text-xs font-medium tabular-nums text-white/90 hover:text-white"
            >
              {Math.round(view.zoom * 100)}%
            </button>
            <ViewerButton small title="Acercar (+)" onClick={() => zoomAt(1.25)} disabled={view.zoom >= MAX_ZOOM}>
              <Svg className="h-4 w-4">{ICON.plus}</Svg>
            </ViewerButton>
            <ViewerButton small title="Ajustar a la pantalla (0)" onClick={() => setView(IDENTITY)}>
              <Svg className="h-4 w-4">{ICON.fit}</Svg>
            </ViewerButton>
          </div>

          <button
            type="button"
            onClick={() => setShowAdjust((s) => !s)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition md:hidden',
              showAdjust ? 'bg-white/20 text-white' : 'bg-white/10 text-white/80',
            )}
          >
            <Svg className="h-4 w-4">{ICON.sliders}</Svg> Ajustes
          </button>

          {showAdjust && (
            <>
              <FilterSlider icon={ICON.sun} label="Brillo" value={brightness} min={30} max={250} onChange={setBrightness} />
              <FilterSlider icon={ICON.contrast} label="Contraste" value={contrast} min={30} max={300} onChange={setContrast} />
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <ToggleChip active={invert} onClick={() => setInvert((v) => !v)} icon={ICON.invert} title="Invertir colores (I)">
                  Negativo
                </ToggleChip>
                <ToggleChip active={enhanced} onClick={toggleEnhance} icon={ICON.sparkles} title="Más contraste para ver detalles">
                  Realzar
                </ToggleChip>
                <ToggleChip onClick={resetFilters} icon={ICON.reset} disabled={!filtersChanged} title="Volver a la imagen original">
                  Original
                </ToggleChip>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ViewerButton({
  title, onClick, disabled, children, className, small,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:opacity-30 disabled:hover:bg-transparent',
        small ? 'h-8 w-8' : 'h-10 w-10',
        className,
      )}
    >
      {children}
    </button>
  );
}

function FilterSlider({
  icon, label, value, min, max, onChange,
}: { icon: ReactNode; label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-white/80" title={label}>
      <Svg className="h-4 w-4 shrink-0">{icon}</Svg>
      <span className="w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={() => onChange(100)}
        className="h-1 w-24 cursor-pointer accent-brand-500 sm:w-32"
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-white/60">{value}%</span>
    </label>
  );
}

function ToggleChip({
  active = false, onClick, icon, disabled, title, children,
}: {
  active?: boolean;
  onClick: () => void;
  icon: ReactNode;
  disabled?: boolean;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-40',
        active ? 'bg-brand-500 text-white shadow-sm' : 'bg-white/10 text-white/85 hover:bg-white/20',
      )}
    >
      <Svg className="h-4 w-4">{icon}</Svg>
      {children}
    </button>
  );
}

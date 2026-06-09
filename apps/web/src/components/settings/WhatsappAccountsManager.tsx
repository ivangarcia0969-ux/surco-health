'use client';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { cn, formatDate } from '@/lib/utils';

/**
 * Gestor de bots WhatsApp (N por tenant).
 * - Lista de bots como cards con badge de status y default
 * - Modal de "Agregar bot" (gateado por cuota del plan)
 * - Modal de "Editar bot" (rotar token, cambiar sede, etc.)
 * - Botón "Probar" por bot (envía hello_world)
 * - Botón "Marcar como default"
 * - Botón "Eliminar"
 */

interface Site { id: string; name: string }

interface BotAccount {
  id: string;
  name: string;
  displayPhone: string | null;
  phoneNumberId: string;
  businessAccountId: string | null;
  templateLang: string;
  isDefault: boolean;
  siteId: string | null;
  siteName: string | null;
  verified: boolean;
  isActive: boolean;
  monthlySent: number;
  lastTestAt: string | null;
  tokenPreview: string | null;
  createdAt: string;
}

interface Capacity {
  plan: string;
  whatsappEnabled: boolean;
  maxAccounts: number;
  currentCount: number;
  monthlyLimit: number | null;
}

interface AccountsResponse {
  capacity: Capacity;
  accounts: BotAccount[];
}

export function WhatsappAccountsManager() {
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [accounts, setAccounts] = useState<BotAccount[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BotAccount | null>(null);
  const [globalMsg, setGlobalMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, sitesRes] = await Promise.all([
        apiFetch<AccountsResponse>('/api/whatsapp/accounts'),
        apiFetch<Site[]>('/api/tenants/sites').catch(() => []),
      ]);
      setCapacity(r.capacity);
      setAccounts(r.accounts);
      setSites(Array.isArray(sitesRes) ? sitesRes : []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card className="text-sm text-gray-500">Cargando bots…</Card>;
  if (!capacity) return null;

  const canCreate = capacity.currentCount < capacity.maxAccounts;
  const usagePct = capacity.maxAccounts > 0 ? (capacity.currentCount / capacity.maxAccounts) * 100 : 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>Bots de WhatsApp</CardTitle>
          <p className="mt-1 text-sm text-gray-600">
            Conecta uno o varios números de WhatsApp Business. Cada bot puede asociarse a una sede.
            <a
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
              target="_blank" rel="noreferrer"
              className="ml-1 text-brand-600 hover:underline"
            >
              Guía Meta ↗
            </a>
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Plan {capacity.plan}</div>
          <div className="mt-0.5 text-sm font-medium text-gray-700">
            {capacity.currentCount} / {capacity.maxAccounts} bots
          </div>
          <div className="mt-1 h-1.5 w-32 overflow-hidden rounded bg-gray-100">
            <div
              className={cn(
                'h-full transition-all',
                usagePct >= 100 ? 'bg-red-500' : usagePct >= 80 ? 'bg-amber-500' : 'bg-brand-500',
              )}
              style={{ width: `${Math.min(100, usagePct)}%` }}
            />
          </div>
        </div>
      </div>

      {globalMsg && (
        <div className={cn(
          'mt-4 rounded-lg px-3 py-2 text-sm',
          globalMsg.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700',
        )}>
          {globalMsg.text}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="mt-6 rounded-lg border-2 border-dashed border-gray-200 px-6 py-10 text-center">
          <div className="text-4xl">💬</div>
          <h4 className="mt-3 font-semibold text-gray-900">Aún no tienes bots conectados</h4>
          <p className="mt-1 text-sm text-gray-600">
            Conecta un número de WhatsApp Business para empezar a enviar recordatorios automáticos.
          </p>
          <div className="mt-4">
            <Button onClick={() => setCreating(true)}>+ Conectar primer bot</Button>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-5 space-y-3">
            {accounts.map((a) => (
              <BotCard
                key={a.id}
                bot={a}
                onChanged={(msg) => { setGlobalMsg(msg); load(); }}
                onEdit={() => setEditing(a)}
              />
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500">
              {capacity.monthlyLimit
                ? `Tu plan permite hasta ${capacity.monthlyLimit.toLocaleString()} mensajes/mes.`
                : 'Tu plan permite mensajes ilimitados.'}
            </p>
            <Button
              onClick={() => setCreating(true)}
              disabled={!canCreate}
              title={!canCreate ? `Tu plan ${capacity.plan} permite máximo ${capacity.maxAccounts} bots` : undefined}
            >
              + Agregar bot
            </Button>
          </div>
        </>
      )}

      {creating && (
        <BotFormModal
          mode="create"
          sites={sites}
          onClose={() => setCreating(false)}
          onSaved={(msg) => { setCreating(false); setGlobalMsg(msg); load(); }}
        />
      )}
      {editing && (
        <BotFormModal
          mode="edit"
          bot={editing}
          sites={sites}
          onClose={() => setEditing(null)}
          onSaved={(msg) => { setEditing(null); setGlobalMsg(msg); load(); }}
        />
      )}
    </Card>
  );
}

// ============================================================
// BotCard — una tarjeta por cada bot
// ============================================================
function BotCard({
  bot, onChanged, onEdit,
}: {
  bot: BotAccount;
  onChanged: (msg: { kind: 'ok' | 'err'; text: string }) => void;
  onEdit: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [testNumber, setTestNumber] = useState('');
  const [showTest, setShowTest] = useState(false);

  async function setAsDefault() {
    try {
      await apiFetch(`/api/whatsapp/accounts/${bot.id}/default`, { method: 'POST' });
      onChanged({ kind: 'ok', text: `✓ "${bot.name}" ahora es el bot principal` });
    } catch (err: any) {
      onChanged({ kind: 'err', text: err.message ?? 'Error' });
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar el bot "${bot.name}"? Las citas asignadas a este bot dejarán de recibir recordatorios.`)) return;
    try {
      await apiFetch(`/api/whatsapp/accounts/${bot.id}`, { method: 'DELETE' });
      onChanged({ kind: 'ok', text: `Bot "${bot.name}" eliminado` });
    } catch (err: any) {
      onChanged({ kind: 'err', text: err.message ?? 'Error' });
    }
  }

  async function sendTest() {
    if (!testNumber.trim()) {
      onChanged({ kind: 'err', text: 'Ingresa un número en formato +57300...' });
      return;
    }
    setTesting(true);
    try {
      const r = await apiFetch<{ messageId: string }>(`/api/whatsapp/accounts/${bot.id}/test`, {
        method: 'POST', body: { to: testNumber.trim() },
      });
      onChanged({ kind: 'ok', text: `✓ Mensaje enviado vía "${bot.name}" (id: ${r.messageId?.slice(0, 16)}…)` });
      setShowTest(false); setTestNumber('');
    } catch (err: any) {
      const d = err?.details;
      onChanged({
        kind: 'err',
        text: d?.message
          ? `Meta error ${d.code ?? ''}: ${d.message}`
          : err.message ?? 'Error al enviar prueba',
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <li className={cn(
      'rounded-xl border bg-white p-4 transition',
      bot.isDefault ? 'border-brand-300 ring-1 ring-brand-200' : 'border-gray-200',
      !bot.isActive && 'opacity-60',
    )}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">📱</span>
            <h4 className="truncate text-base font-semibold text-gray-900">{bot.name}</h4>
            {bot.isDefault && (
              <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-700">
                Principal
              </span>
            )}
            {!bot.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                Pausado
              </span>
            )}
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                bot.verified
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700',
              )}
            >
              {bot.verified ? '✓ Verificado' : '⚠ Sin probar'}
            </span>
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-gray-600 sm:grid-cols-2">
            {bot.displayPhone && <div>📞 {bot.displayPhone}</div>}
            <div>
              <span className="text-gray-400">Phone ID:</span>{' '}
              <code className="font-mono">{bot.phoneNumberId}</code>
            </div>
            {bot.siteName ? (
              <div>🏥 Sede: <strong>{bot.siteName}</strong></div>
            ) : (
              <div className="text-gray-400">Sin sede asignada</div>
            )}
            <div>🌐 {bot.templateLang}</div>
            <div>
              <span className="text-gray-400">Token:</span>{' '}
              <code className="font-mono">{bot.tokenPreview ?? '—'}</code>
            </div>
            <div>📤 {bot.monthlySent} enviados / mes</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {!bot.isDefault && (
            <button
              onClick={setAsDefault}
              className="text-xs text-brand-600 hover:underline"
              type="button"
            >
              Marcar principal
            </button>
          )}
          <button
            onClick={() => setShowTest((v) => !v)}
            className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
            type="button"
          >
            🧪 Probar
          </button>
          <button
            onClick={onEdit}
            className="text-xs text-gray-600 hover:underline"
            type="button"
          >
            Editar
          </button>
          <button
            onClick={remove}
            className="text-xs text-red-600 hover:underline"
            type="button"
          >
            Eliminar
          </button>
        </div>
      </div>

      {showTest && (
        <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
          <p className="mb-2 text-xs text-gray-700">
            Envía la plantilla <code className="rounded bg-white px-1">hello_world</code> (pre-aprobada por Meta)
            a este número:
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={testNumber}
              onChange={(e) => setTestNumber(e.target.value)}
              placeholder="+573122252814"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <Button onClick={sendTest} loading={testing} type="button">
              Enviar
            </Button>
          </div>
        </div>
      )}

      {bot.lastTestAt && !showTest && (
        <p className="mt-2 text-[11px] text-gray-400">
          Última prueba: {formatDate(bot.lastTestAt)}
        </p>
      )}
    </li>
  );
}

// ============================================================
// BotFormModal — crear o editar bot
// ============================================================
function BotFormModal({
  mode, bot, sites, onClose, onSaved,
}: {
  mode: 'create' | 'edit';
  bot?: BotAccount;
  sites: Site[];
  onClose: () => void;
  onSaved: (msg: { kind: 'ok' | 'err'; text: string }) => void;
}) {
  const [name, setName] = useState(bot?.name ?? '');
  const [displayPhone, setDisplayPhone] = useState(bot?.displayPhone ?? '');
  const [phoneNumberId, setPhoneNumberId] = useState(bot?.phoneNumberId ?? '');
  const [businessAccountId, setBusinessAccountId] = useState(bot?.businessAccountId ?? '');
  const [accessToken, setAccessToken] = useState('');
  const [templateLang, setTemplateLang] = useState(bot?.templateLang ?? 'es_CO');
  const [siteId, setSiteId] = useState(bot?.siteId ?? '');
  const [isDefault, setIsDefault] = useState(bot?.isDefault ?? false);
  const [isActive, setIsActive] = useState(bot?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (mode === 'create') {
      if (!name.trim() || !phoneNumberId.trim() || !accessToken.trim()) {
        setErr('Nombre, Phone Number ID y Token son obligatorios.');
        return;
      }
    } else if (!name.trim()) {
      setErr('Nombre obligatorio.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'create') {
        await apiFetch('/api/whatsapp/accounts', {
          method: 'POST',
          body: {
            name: name.trim(),
            displayPhone: displayPhone.trim() || undefined,
            phoneNumberId: phoneNumberId.trim(),
            businessAccountId: businessAccountId.trim() || undefined,
            accessToken: accessToken.trim(),
            templateLang,
            isDefault,
            siteId: siteId || undefined,
          },
        });
        onSaved({ kind: 'ok', text: `✓ Bot "${name}" conectado. Envía una prueba para verificar.` });
      } else if (bot) {
        const body: Record<string, unknown> = {
          name: name.trim(),
          displayPhone: displayPhone.trim() || null,
          templateLang,
          siteId: siteId || null,
          isActive,
        };
        if (accessToken.trim()) body.accessToken = accessToken.trim();
        await apiFetch(`/api/whatsapp/accounts/${bot.id}`, { method: 'PATCH', body });
        onSaved({ kind: 'ok', text: `✓ Bot "${name}" actualizado.${accessToken ? ' Token rotado — verifica con prueba.' : ''}` });
      }
    } catch (e: any) {
      const d = e?.details;
      setErr(d?.message ?? e.message ?? 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? 'Conectar nuevo bot de WhatsApp' : `Editar "${bot?.name}"`}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            label="Nombre del bot *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sede Norte / Línea Principal"
            required
          />
          <Input
            label="Teléfono (humanizado)"
            value={displayPhone}
            onChange={(e) => setDisplayPhone(e.target.value)}
            placeholder="+57 300 123 4567"
          />
        </div>

        {mode === 'create' && (
          <Input
            label="Phone Number ID * (de Meta Business)"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="123456789012345"
            required
          />
        )}

        {mode === 'create' && (
          <Input
            label="Business Account ID (opcional)"
            value={businessAccountId}
            onChange={(e) => setBusinessAccountId(e.target.value)}
            placeholder="987654321098765"
          />
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Token de acceso permanente {mode === 'create' && '*'}
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={mode === 'edit' ? `Solo si quieres rotar (actual: ${bot?.tokenPreview ?? '—'})` : 'EAAxxxxxxxxxxxxxxxxx…'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            required={mode === 'create'}
          />
          <p className="mt-1 text-xs text-gray-500">
            Generado en Meta Business → WhatsApp → API Setup. Se cifra at-rest con pgcrypto.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select
            label="Idioma de plantillas"
            value={templateLang}
            onChange={(e) => setTemplateLang(e.target.value)}
          >
            <option value="es_CO">Español (Colombia)</option>
            <option value="es_MX">Español (México)</option>
            <option value="es_AR">Español (Argentina)</option>
            <option value="es">Español genérico</option>
            <option value="en_US">English (US)</option>
            <option value="pt_BR">Português (Brasil)</option>
          </Select>
          <Select
            label="Sede asociada (opcional)"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          >
            <option value="">Ninguna — bot global del tenant</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>

        <div className="flex flex-wrap gap-4 rounded-lg bg-gray-50 p-3">
          {mode === 'create' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4"
              />
              Marcar como bot <strong>principal</strong> (usado cuando no hay sede)
            </label>
          )}
          {mode === 'edit' && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4"
              />
              Bot <strong>activo</strong> (pausarlo detiene envíos sin perder credenciales)
            </label>
          )}
        </div>

        {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={submitting}>
            {mode === 'create' ? 'Conectar bot' : 'Guardar cambios'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

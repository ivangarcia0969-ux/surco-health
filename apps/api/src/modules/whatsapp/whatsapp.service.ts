import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import { encryptText, decryptText } from '@surco/encryption';
import type {
  CreateWhatsappAccountInput,
  UpdateWhatsappAccountInput,
  WhatsappTestInput,
} from '@surco/shared';

/**
 * WhatsApp Cloud API (Meta) — N bots por tenant (marketplace-ready).
 *
 * Diseño:
 *   - WhatsappAccount: cada bot es un número independiente con su propio token
 *   - Cuota por plan: maxWhatsappAccounts (FREE=1, PRO=2, CLINICA=5, ENTERPRISE=50)
 *   - Constraint: máximo 1 isDefault=true por tenant (validado en código + DB)
 *   - Token cifrado at-rest con pgcrypto (columna Bytes)
 *   - phoneNumberId es UNIQUE global (Meta no permite duplicar números)
 *   - Routing del worker: appointment.siteId → bot del site → bot default
 *
 * Portabilidad futura a microservicio:
 *   Toda la lógica de Meta API está aislada en `callMetaGraph()`. Mover ese
 *   archivo a un container `whatsapp-gateway` aparte = trivial.
 */

const META_API_VERSION = 'v22.0';
const META_GRAPH_BASE = 'https://graph.facebook.com';

interface PublicAccount {
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
  lastTestAt: Date | null;
  tokenPreview: string | null;
  createdAt: Date;
}

interface PlanCapacity {
  plan: string;
  whatsappEnabled: boolean;
  maxAccounts: number;
  currentCount: number;
  monthlyLimit: number | null;
}

interface AccountsListResponse {
  capacity: PlanCapacity;
  accounts: PublicAccount[];
}

// ============================================================
// LIST
// ============================================================
export async function listAccounts(tenantId: string): Promise<AccountsListResponse> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { plan: true, whatsappAccounts: { include: { site: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] } },
  });
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);

  const accounts: PublicAccount[] = await Promise.all(
    tenant.whatsappAccounts.map(async (a) => {
      const tok = await decryptText(a.accessToken);
      return {
        id: a.id,
        name: a.name,
        displayPhone: a.displayPhone,
        phoneNumberId: a.phoneNumberId,
        businessAccountId: a.businessAccountId,
        templateLang: a.templateLang,
        isDefault: a.isDefault,
        siteId: a.siteId,
        siteName: a.site?.name ?? null,
        verified: a.verified,
        isActive: a.isActive,
        monthlySent: a.monthlySent,
        lastTestAt: a.lastTestAt,
        tokenPreview: tok ? `••••••••${tok.slice(-4)}` : null,
        createdAt: a.createdAt,
      };
    }),
  );

  return {
    capacity: {
      plan: tenant.plan.name,
      whatsappEnabled: tenant.plan.whatsappEnabled,
      maxAccounts: tenant.plan.maxWhatsappAccounts,
      currentCount: tenant.whatsappAccounts.length,
      monthlyLimit: tenant.plan.whatsappMonthlyLimit,
    },
    accounts,
  };
}

// ============================================================
// CREATE
// ============================================================
export async function createAccount(
  ctx: AuditContext,
  input: CreateWhatsappAccountInput,
) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    include: { plan: true, _count: { select: { whatsappAccounts: true } } },
  });
  if (!tenant) throw new AppError('TENANT_NOT_FOUND', 404);
  if (!tenant.plan.whatsappEnabled) {
    throw new AppError('WHATSAPP_NOT_IN_PLAN', 402, {
      message: 'Tu plan no incluye WhatsApp.',
    });
  }
  if (tenant._count.whatsappAccounts >= tenant.plan.maxWhatsappAccounts) {
    throw new AppError('WHATSAPP_QUOTA_EXCEEDED', 402, {
      message: `Tu plan ${tenant.plan.name} permite máximo ${tenant.plan.maxWhatsappAccounts} bots.`,
      max: tenant.plan.maxWhatsappAccounts,
      current: tenant._count.whatsappAccounts,
    });
  }

  // Validar siteId si vino
  if (input.siteId) {
    const site = await prisma.site.findFirst({ where: { id: input.siteId, tenantId: ctx.tenantId } });
    if (!site) throw new AppError('SITE_NOT_FOUND', 404);
  }

  // Si pidieron isDefault, hay que limpiar el default anterior
  if (input.isDefault) {
    await prisma.whatsappAccount.updateMany({
      where: { tenantId: ctx.tenantId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // Si no hay ninguna cuenta todavía, forzar isDefault=true (mejor UX)
  const shouldBeDefault = input.isDefault || tenant._count.whatsappAccounts === 0;

  const encryptedToken = await encryptText(input.accessToken);
  if (!encryptedToken) throw new AppError('ENCRYPTION_FAILED', 500);

  const account = await prisma.whatsappAccount.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      displayPhone: input.displayPhone ?? null,
      phoneNumberId: input.phoneNumberId,
      businessAccountId: input.businessAccountId ?? null,
      accessToken: encryptedToken,
      templateLang: input.templateLang ?? 'es_CO',
      isDefault: shouldBeDefault,
      siteId: input.siteId ?? null,
    },
  });

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'WhatsappAccount',
    entityId: account.id,
    metadata: { action: 'created', name: account.name, phoneNumberId: account.phoneNumberId, isDefault: shouldBeDefault },
  });

  return { id: account.id };
}

// ============================================================
// UPDATE
// ============================================================
export async function updateAccount(
  ctx: AuditContext,
  accountId: string,
  input: UpdateWhatsappAccountInput,
) {
  const account = await prisma.whatsappAccount.findFirst({
    where: { id: accountId, tenantId: ctx.tenantId },
  });
  if (!account) throw new AppError('WHATSAPP_ACCOUNT_NOT_FOUND', 404);

  if (input.siteId) {
    const site = await prisma.site.findFirst({ where: { id: input.siteId, tenantId: ctx.tenantId } });
    if (!site) throw new AppError('SITE_NOT_FOUND', 404);
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.displayPhone !== undefined) data.displayPhone = input.displayPhone;
  if (input.templateLang !== undefined) data.templateLang = input.templateLang;
  if (input.siteId !== undefined) data.siteId = input.siteId;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.accessToken) {
    const enc = await encryptText(input.accessToken);
    if (!enc) throw new AppError('ENCRYPTION_FAILED', 500);
    data.accessToken = enc;
    data.verified = false; // reset al rotar token
  }

  await prisma.whatsappAccount.update({ where: { id: accountId }, data });

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'WhatsappAccount',
    entityId: accountId,
    metadata: { action: 'updated', fields: Object.keys(data), tokenRotated: !!input.accessToken },
  });
  return { ok: true };
}

// ============================================================
// SET DEFAULT
// ============================================================
export async function setDefault(ctx: AuditContext, accountId: string) {
  const account = await prisma.whatsappAccount.findFirst({
    where: { id: accountId, tenantId: ctx.tenantId },
  });
  if (!account) throw new AppError('WHATSAPP_ACCOUNT_NOT_FOUND', 404);

  await prisma.$transaction([
    prisma.whatsappAccount.updateMany({
      where: { tenantId: ctx.tenantId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.whatsappAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    }),
  ]);

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'WhatsappAccount',
    entityId: accountId,
    metadata: { action: 'set_default' },
  });
  return { ok: true };
}

// ============================================================
// DELETE
// ============================================================
export async function deleteAccount(ctx: AuditContext, accountId: string) {
  const account = await prisma.whatsappAccount.findFirst({
    where: { id: accountId, tenantId: ctx.tenantId },
  });
  if (!account) throw new AppError('WHATSAPP_ACCOUNT_NOT_FOUND', 404);

  await prisma.whatsappAccount.delete({ where: { id: accountId } });

  // Si era el default y quedan otras, promocionar la primera (la más vieja)
  if (account.isDefault) {
    const next = await prisma.whatsappAccount.findFirst({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.whatsappAccount.update({
        where: { id: next.id }, data: { isDefault: true },
      });
    }
  }

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'WhatsappAccount',
    entityId: accountId,
    metadata: { action: 'deleted', name: account.name },
  });
  return { ok: true };
}

// ============================================================
// TEST (envío real a Meta para verificar credenciales)
// ============================================================
export async function testAccount(
  ctx: AuditContext,
  accountId: string,
  input: WhatsappTestInput,
) {
  const account = await prisma.whatsappAccount.findFirst({
    where: { id: accountId, tenantId: ctx.tenantId },
  });
  if (!account) throw new AppError('WHATSAPP_ACCOUNT_NOT_FOUND', 404);

  const token = await decryptText(account.accessToken);
  if (!token) throw new AppError('WHATSAPP_DECRYPT_FAILED', 500);

  const to = input.to.replace(/[^\d]/g, '');
  const template = input.templateName ?? 'hello_world';
  // hello_world es siempre en_US; otras plantillas usan el lang de la cuenta
  const lang = input.templateName ? account.templateLang : 'en_US';

  const result = await callMetaGraph({
    phoneNumberId: account.phoneNumberId,
    accessToken: token,
    payload: {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: template, language: { code: lang } },
    },
  });

  if (!result.ok) {
    await logAudit({
      ctx, action: 'UPDATE_PATIENT', entityType: 'WhatsappAccount',
      entityId: accountId,
      metadata: { action: 'test_failed', code: result.error?.code, message: result.error?.message },
    });
    throw new AppError('WHATSAPP_META_ERROR', 400, result.error);
  }

  await prisma.whatsappAccount.update({
    where: { id: accountId },
    data: { verified: true, lastTestAt: new Date() },
  });

  await logAudit({
    ctx, action: 'UPDATE_PATIENT', entityType: 'WhatsappAccount',
    entityId: accountId,
    metadata: { action: 'test_ok', to: to.slice(0, 4) + '****', messageId: result.messageId },
  });

  return { ok: true, messageId: result.messageId };
}

// ============================================================
// ROUTING (uso interno del worker BullMQ)
// ============================================================
/**
 * Resuelve qué bot usar para una cita/notificación.
 *  1) Si pasa siteId, busca un bot asociado a ese site
 *  2) Sino, el bot isDefault del tenant
 *  3) Sino null → worker debe marcar SKIPPED_NO_BOT
 */
export async function resolveAccountForSend(
  tenantId: string,
  siteId?: string | null,
): Promise<{ id: string; phoneNumberId: string; accessToken: string; templateLang: string } | null> {
  let account = null;
  if (siteId) {
    account = await prisma.whatsappAccount.findFirst({
      where: { tenantId, siteId, isActive: true },
    });
  }
  if (!account) {
    account = await prisma.whatsappAccount.findFirst({
      where: { tenantId, isDefault: true, isActive: true },
    });
  }
  if (!account) return null;
  const token = await decryptText(account.accessToken);
  if (!token) return null;
  return {
    id: account.id,
    phoneNumberId: account.phoneNumberId,
    accessToken: token,
    templateLang: account.templateLang,
  };
}

// ============================================================
// META GRAPH (aislado para mover a microservicio cuando justifique)
// ============================================================
interface MetaCallOk {
  ok: true;
  messageId: string | null;
  waId: string | null;
}
interface MetaCallErr {
  ok: false;
  error: {
    status: number;
    code?: number;
    type?: string;
    message: string;
    fbtrace_id?: string;
  };
}
type MetaCallResult = MetaCallOk | MetaCallErr;

async function callMetaGraph(args: {
  phoneNumberId: string;
  accessToken: string;
  payload: Record<string, unknown>;
}): Promise<MetaCallResult> {
  const url = `${META_GRAPH_BASE}/${META_API_VERSION}/${args.phoneNumberId}/messages`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args.payload),
    });
  } catch (err) {
    return {
      ok: false,
      error: { status: 502, message: `Network error: ${(err as Error).message}` },
    };
  }

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.error ?? {};
    return {
      ok: false,
      error: {
        status: res.status,
        code: e.code,
        type: e.type,
        message: e.message ?? 'Meta API error',
        fbtrace_id: e.fbtrace_id,
      },
    };
  }
  return {
    ok: true,
    messageId: json?.messages?.[0]?.id ?? null,
    waId: json?.contacts?.[0]?.wa_id ?? null,
  };
}

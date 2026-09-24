import { Prisma } from '@surco/db';
import { prisma } from '../../plugins/prisma';
import { AppError } from '../../utils/errors';
import { logAudit, type AuditContext } from '@surco/audit';
import type { CreatePaymentInput, BillingSummaryQuery } from '@surco/shared';

/**
 * Caja del consultorio: cada abono del paciente genera un "recibo de caja"
 * (Invoice con prefijo RC-, estado PAID, 1 ítem) + su Payment. Así el saldo
 * del paciente es: total del plan de tratamiento − suma de abonos.
 *
 * NO es facturación electrónica DIAN (eso va por proveedor externo); es el
 * control interno de pagos que usa el día a día de un consultorio.
 */

/**
 * Inicio del día en hora de Colombia (UTC−5, sin horario de verano), en UTC.
 * El servidor corre en UTC: sin esto, después de las 7 p. m. el "hoy" del
 * tablero saltaría al día siguiente. Si el cliente manda from/to, se usan esos.
 */
const BOGOTA_OFFSET_MS = 5 * 3600_000;
function bogotaStartOfDay(d = new Date()): Date {
  const local = new Date(d.getTime() - BOGOTA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + BOGOTA_OFFSET_MS);
}
function bogotaStartOfMonth(d = new Date()): Date {
  const local = new Date(d.getTime() - BOGOTA_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) + BOGOTA_OFFSET_MS);
}

async function nextReceiptNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const last = await tx.invoice.findFirst({
    where: { tenantId, number: { startsWith: 'RC-' } },
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  });
  const n = last ? parseInt(last.number.slice(3), 10) || 0 : 0;
  return `RC-${String(n + 1).padStart(6, '0')}`;
}

export async function createPayment(ctx: AuditContext, input: CreatePaymentInput) {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  // Reintento ante choque de numeración (dos recepciones cobrando a la vez)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const invoice = await prisma.$transaction(async (tx) => {
        const number = await nextReceiptNumber(tx, ctx.tenantId);
        return tx.invoice.create({
          data: {
            tenantId: ctx.tenantId,
            patientId: input.patientId,
            number,
            subtotal: input.amount,
            total: input.amount,
            status: 'PAID',
            issuedAt: new Date(),
            items: {
              create: [{
                description: input.concept,
                quantity: 1,
                unitPrice: input.amount,
                lineTotal: input.amount,
              }],
            },
            payments: {
              create: [{
                tenantId: ctx.tenantId,
                method: input.method,
                amount: input.amount,
                reference: input.reference,
                createdBy: ctx.actorId ?? 'system',
              }],
            },
          },
          include: { payments: true },
        });
      });
      await logAudit({
        ctx, action: 'CREATE_PAYMENT', entityType: 'Invoice', entityId: invoice.id,
        metadata: { patientId: input.patientId, amount: input.amount, method: input.method, number: invoice.number },
      });
      return invoice;
    } catch (err) {
      const isUniqueClash = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isUniqueClash || attempt === 2) throw err;
    }
  }
  throw new AppError('RECEIPT_NUMBER_CONFLICT', 409);
}

/** Estado de cuenta del paciente: plan de tratamiento vs abonos. */
export async function getPatientAccount(ctx: AuditContext, patientId: string) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!patient) throw new AppError('PATIENT_NOT_FOUND', 404);

  const [procedures, receipts] = await Promise.all([
    prisma.dentalProcedure.findMany({
      where: { clinicalRecord: { patientId, tenantId: ctx.tenantId }, status: { not: 'CANCELLED' } },
      select: { cost: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { tenantId: ctx.tenantId, patientId, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { select: { description: true } },
        payments: { select: { id: true, method: true, amount: true, reference: true, paidAt: true, createdBy: true } },
      },
    }),
  ]);

  let planTotal = 0;
  let completedTotal = 0;
  for (const p of procedures) {
    const c = p.cost != null ? Number(p.cost) : 0;
    planTotal += c;
    if (p.status === 'COMPLETED') completedTotal += c;
  }
  const payments = receipts.flatMap((r) =>
    r.payments.map((p) => ({
      id: p.id,
      invoiceId: r.id,
      number: r.number,
      concept: r.items[0]?.description ?? 'Abono',
      method: p.method,
      amount: Number(p.amount),
      reference: p.reference,
      paidAt: p.paidAt,
    })),
  );
  const paid = payments.reduce((s, p) => s + p.amount, 0);

  return {
    planTotal,
    completedTotal,
    paid,
    balance: Math.max(planTotal - paid, 0),
    credit: Math.max(paid - planTotal, 0), // saldo a favor
    payments,
  };
}

/** Recibo de caja para imprimir. */
export async function getReceipt(ctx: AuditContext, invoiceId: string) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: ctx.tenantId },
    include: {
      items: true,
      payments: true,
      patient: {
        select: { id: true, fullName: true, documentType: true, documentId: true, phone: true, birthdate: true, insurerName: true },
      },
    },
  });
  if (!invoice) throw new AppError('RECEIPT_NOT_FOUND', 404);

  const cashierIds = Array.from(new Set(invoice.payments.map((p) => p.createdBy)));
  const cashiers = await prisma.user.findMany({
    where: { id: { in: cashierIds }, tenantId: ctx.tenantId },
    select: { id: true, fullName: true },
  });
  return { ...invoice, cashier: cashiers[0]?.fullName ?? null };
}

/** Ingresos del periodo (por defecto: mes en curso) para el tablero. */
export async function getSummary(ctx: AuditContext, q: BillingSummaryQuery) {
  const now = new Date();
  const from = q.from ? new Date(q.from) : bogotaStartOfMonth(now);
  const to = q.to ? new Date(q.to) : now;
  const startOfDay = bogotaStartOfDay(now);

  const [period, today, byMethod, pendingProcedures] = await Promise.all([
    prisma.payment.aggregate({
      where: { tenantId: ctx.tenantId, paidAt: { gte: from, lte: to } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.payment.aggregate({
      where: { tenantId: ctx.tenantId, paidAt: { gte: startOfDay } },
      _sum: { amount: true }, _count: true,
    }),
    prisma.payment.groupBy({
      by: ['method'],
      where: { tenantId: ctx.tenantId, paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.dentalProcedure.aggregate({
      where: { clinicalRecord: { tenantId: ctx.tenantId }, status: { in: ['PLANNED', 'IN_PROGRESS'] } },
      _sum: { cost: true }, _count: true,
    }),
  ]);

  // Serie diaria del periodo (para la gráfica del tablero)
  const daily = await prisma.$queryRaw<{ day: Date; total: Prisma.Decimal }[]>`
    SELECT date_trunc('day', ("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Bogota') AS day, SUM(amount) AS total
    FROM "Payment"
    WHERE "tenantId" = ${ctx.tenantId}
      -- paidAt se guarda en UTC sin zona: comparar en UTC sin depender del TimeZone de la sesión
      AND "paidAt" >= (${from.toISOString()}::timestamptz AT TIME ZONE 'UTC')
      AND "paidAt" <= (${to.toISOString()}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1 ORDER BY 1`;

  return {
    from, to,
    periodIncome: Number(period._sum.amount ?? 0),
    periodPayments: period._count,
    todayIncome: Number(today._sum.amount ?? 0),
    todayPayments: today._count,
    byMethod: byMethod.map((m) => ({ method: m.method, total: Number(m._sum.amount ?? 0) })),
    pendingTreatments: {
      count: pendingProcedures._count,
      value: Number(pendingProcedures._sum.cost ?? 0),
    },
    daily: daily.map((d) => ({ day: d.day, total: Number(d.total) })),
  };
}

/** Recibos del periodo (caja del día / del mes), más recientes primero. */
export async function listReceipts(ctx: AuditContext, q: BillingSummaryQuery) {
  const from = q.from ? new Date(q.from) : bogotaStartOfDay();
  const to = q.to ? new Date(q.to) : new Date(from.getTime() + 24 * 3600_000 - 1);
  const receipts = await prisma.invoice.findMany({
    where: { tenantId: ctx.tenantId, createdAt: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'REFUNDED'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      patient: { select: { id: true, fullName: true, documentId: true } },
      items: { select: { description: true }, take: 1 },
      payments: { select: { method: true, amount: true, paidAt: true } },
    },
  });
  return receipts.map((r) => ({
    id: r.id,
    number: r.number,
    total: Number(r.total),
    createdAt: r.createdAt,
    concept: r.items[0]?.description ?? 'Abono',
    method: r.payments[0]?.method ?? null,
    patient: r.patient,
  }));
}

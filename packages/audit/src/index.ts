import { prisma } from '@surco/db';

/**
 * Audit log obligatorio (Habeas Data + Res 1995/1999).
 * Cada acción sensible debe registrarse aquí.
 *
 * IMPORTANTE: la tabla AuditLog NO tiene updatedAt. Es append-only.
 * Está prohibido modificar o borrar registros desde la aplicación.
 * (Recomendación adicional: trigger Postgres BEFORE UPDATE/DELETE que lance error.)
 */

export type AuditAction =
  // Lectura sensible
  | 'READ_CLINICAL_RECORD'
  | 'READ_PATIENT'
  | 'READ_PRESCRIPTION'
  | 'LIST_CLINICAL_RECORDS'
  | 'DECRYPT_FIELD'
  // Mutaciones a HCE
  | 'CREATE_CLINICAL_RECORD'
  | 'AMEND_CLINICAL_RECORD'
  | 'SIGN_CLINICAL_RECORD'
  | 'ARCHIVE_CLINICAL_RECORD'
  // Paciente
  | 'CREATE_PATIENT' | 'UPDATE_PATIENT' | 'ARCHIVE_PATIENT'
  // Prescripciones / consentimientos
  | 'CREATE_PRESCRIPTION' | 'ISSUE_PRESCRIPTION'
  | 'CREATE_CONSENT' | 'SIGN_CONSENT'
  // Archivos
  | 'UPLOAD_FILE' | 'DOWNLOAD_FILE' | 'DELETE_FILE'
  // Auth
  | 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT'
  | 'PASSWORD_CHANGE' | 'MFA_ENABLED' | 'MFA_DISABLED'
  // Exports / compliance
  | 'EXPORT_FHIR' | 'EXPORT_PATIENT_DATA' | 'EXPORT_AUDIT_LOG'
  // Admin
  | 'CREATE_USER' | 'DISABLE_USER' | 'CHANGE_USER_ROLE'
  | 'OVERRIDE_TENANT_PLAN'
  // Otros
  | string;

export type AuditEntityType =
  | 'Tenant' | 'User' | 'Patient' | 'Appointment'
  | 'ClinicalRecord' | 'Prescription' | 'Consent'
  | 'ClinicalFile' | 'TelehealthSession'
  | 'DentalChart' | 'PsychologyProfile' | 'MedicalProfile'
  | 'Invoice' | 'Payment'
  | string;

export interface AuditContext {
  tenantId: string;
  actorId?: string | null;
  actorRole?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LogAuditArgs {
  ctx: AuditContext;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Graba una entrada de audit log. Best-effort — si falla, log a stderr
 * pero NO bloquea la operación principal (porque sería peor perder la
 * operación que perder un audit). En producción además mandar a una cola
 * para reintento si Postgres está saturado.
 */
export async function logAudit(args: LogAuditArgs): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: args.ctx.tenantId,
        actorId: args.ctx.actorId ?? null,
        actorRole: args.ctx.actorRole ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId,
        metadata: args.metadata ? (args.metadata as any) : undefined,
        ipAddress: args.ctx.ipAddress ?? null,
        userAgent: args.ctx.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error('[audit] Failed to record audit log', {
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      error: (err as Error).message,
    });
  }
}

/** Lectura del audit log — solo para SaaS Admin y para exports legales. */
export interface AuditQuery {
  tenantId: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export async function queryAudit(q: AuditQuery) {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 50;
  const where: any = { tenantId: q.tenantId };
  if (q.actorId) where.actorId = q.actorId;
  if (q.entityType) where.entityType = q.entityType;
  if (q.entityId) where.entityId = q.entityId;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = q.from;
    if (q.to) where.createdAt.lte = q.to;
  }

  const [total, data] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { actor: { select: { id: true, fullName: true, email: true, role: true } } },
    }),
  ]);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

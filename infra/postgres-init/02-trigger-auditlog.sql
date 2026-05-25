-- ============================================================
-- Surco Health — Trigger anti-mutación sobre AuditLog
--
-- Se aplica después de que Prisma cree la tabla AuditLog.
-- Si la tabla todavía no existe (primer boot), no hace nada.
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'AuditLog') THEN
    DROP TRIGGER IF EXISTS prevent_audit_log_mutation ON "AuditLog";

    CREATE OR REPLACE FUNCTION prevent_audit_mutation()
    RETURNS TRIGGER AS $func$
    BEGIN
      RAISE EXCEPTION 'AuditLog es append-only; UPDATE/DELETE prohibido por compliance';
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER prevent_audit_log_mutation
      BEFORE UPDATE OR DELETE ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

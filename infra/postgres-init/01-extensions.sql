-- ============================================================
-- Surco Health — Extensiones requeridas
-- Este script corre automáticamente al primer arranque del container.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigger que impide UPDATE/DELETE sobre AuditLog
-- (Solo se aplica DESPUÉS de prisma db push, porque la tabla aún no existe.
--  Se ejecuta lazy con un DO block.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'AuditLog') THEN
    DROP TRIGGER IF EXISTS prevent_audit_log_mutation ON "AuditLog";

    CREATE OR REPLACE FUNCTION prevent_audit_mutation()
    RETURNS TRIGGER AS $func$
    BEGIN
      RAISE EXCEPTION 'AuditLog is append-only; UPDATE/DELETE prohibido por compliance';
    END;
    $func$ LANGUAGE plpgsql;

    CREATE TRIGGER prevent_audit_log_mutation
      BEFORE UPDATE OR DELETE ON "AuditLog"
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Si la tabla aún no existe, ignorar (se corre de nuevo cuando exista)
  NULL;
END $$;

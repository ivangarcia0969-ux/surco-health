-- ============================================================
-- Surco Health — Post-deploy SQL (compliance + integridad)
-- ============================================================
-- Este script se ejecuta DESPUÉS de `prisma db push` / `prisma migrate deploy`,
-- cuando todas las tablas ya existen. Es 100% idempotente.
--
-- Cubre:
--   1) Trigger BEFORE UPDATE/DELETE en AuditLog (Res 1995/1999 + Habeas Data
--      Art. 17). Garantiza inmutabilidad del registro de tratamiento.
--   2) Constraint EXCLUDE USING gist en Appointment para anti-doble-booking
--      a nivel BD (defensa adicional sobre la TX Serializable existente).
--   3) Índice GIN pg_trgm para búsqueda de pacientes performante (~50k rows).
--
-- Ejecutar como superuser de Postgres (el role surco_user debe tener permiso
-- de DDL en su schema).
-- ============================================================

BEGIN;

-- ============================================================
-- 1) AuditLog inmutable
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'AuditLog') THEN
    RAISE EXCEPTION 'Tabla AuditLog no existe — corre prisma db push primero';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only; UPDATE/DELETE prohibido por compliance Res 1995/1999';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_audit_log_mutation ON "AuditLog";

CREATE TRIGGER prevent_audit_log_mutation
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();

-- ============================================================
-- 2) Appointment — anti-doble-booking a nivel BD
-- ============================================================
-- Postgres requiere btree_gist para mezclar = (uuid) con && (tstzrange).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop la constraint vieja si existe (idempotente)
ALTER TABLE "Appointment"
  DROP CONSTRAINT IF EXISTS appointment_no_overlap_per_professional;

-- Solo bloquea overlaps cuando la cita NO está CANCELLED ni NO_SHOW (esas no ocupan agenda)
-- IMPORTANTE: tstzrange(timestamptz, timestamptz) NO es IMMUTABLE en Postgres
-- (depende de session timezone). Para usarlo en un EXCLUDE constraint (que
-- requiere IMMUTABLE) hay que convertir a timestamp without TZ con
-- AT TIME ZONE 'UTC', que SÍ es IMMUTABLE con literal de texto.
ALTER TABLE "Appointment"
  ADD CONSTRAINT appointment_no_overlap_per_professional
  EXCLUDE USING gist (
    "professionalId" WITH =,
    tsrange(
      ("startsAt" AT TIME ZONE 'UTC'),
      ("endsAt"   AT TIME ZONE 'UTC')
    ) WITH &&
  ) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

-- ============================================================
-- 3) Patient — búsqueda performante con pg_trgm
-- ============================================================
-- Acelera ILIKE '%texto%' sobre fullName + document (búsqueda de pacientes)
DROP INDEX IF EXISTS patient_fullname_trgm_idx;
CREATE INDEX patient_fullname_trgm_idx
  ON "Patient" USING gin ("fullName" gin_trgm_ops);

DROP INDEX IF EXISTS patient_document_trgm_idx;
CREATE INDEX patient_document_trgm_idx
  ON "Patient" USING gin ("document" gin_trgm_ops);

-- ============================================================
-- 4) Permisos: que el role app NO pueda deshabilitar el trigger
-- ============================================================
-- (Solo el superuser puede ALTER TRIGGER ... DISABLE, que está bien;
-- pero verificamos que el role app no sea superuser)
DO $$
DECLARE
  is_super boolean;
BEGIN
  SELECT rolsuper INTO is_super FROM pg_roles WHERE rolname = current_user;
  IF is_super THEN
    RAISE WARNING 'Estás conectado como SUPERUSER. En producción usa role NO-superuser.';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFICACIÓN MANUAL post-ejecución
-- ============================================================
-- Comprueba que el trigger existe:
--   SELECT tgname, tgrelid::regclass FROM pg_trigger
--    WHERE tgname = 'prevent_audit_log_mutation';
--
-- Comprueba que la constraint existe:
--   SELECT conname, contype FROM pg_constraint
--    WHERE conname = 'appointment_no_overlap_per_professional';
--
-- Comprueba que los GIN indexes existen:
--   SELECT indexname FROM pg_indexes
--    WHERE indexname LIKE '%trgm%';
--
-- Prueba que el trigger funciona (DEBE fallar):
--   DELETE FROM "AuditLog" LIMIT 1;
-- ============================================================

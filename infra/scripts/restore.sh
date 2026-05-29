#!/bin/bash
# ============================================================
# Surco Health — Restore Postgres + MinIO desde backup
#
# DESTRUCTIVO: sobreescribe la BD actual. Confirma antes.
#
# Uso:
#   bash infra/scripts/restore.sh /var/backups/surco-health/postgres/surco_health_20260525_030001.dump
# ============================================================
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Uso: $0 <ruta_dump.dump> [ruta_minio.tar.gz]"
  echo ""
  echo "Dumps disponibles:"
  ls -lh /var/backups/surco-health/postgres/*.dump 2>/dev/null | tail -10
  exit 1
fi

PG_DUMP="$1"
MINIO_TAR="${2:-}"

if [[ ! -f "$PG_DUMP" ]]; then
  echo "✗ No existe el dump: $PG_DUMP" >&2
  exit 1
fi

cd "$(dirname "$0")/../.."
COMPOSE="infra/docker-compose.prod.yml"

set -a; source .env; set +a

echo ""
echo "⚠️  ATENCIÓN: vas a SOBREESCRIBIR la BD actual con $PG_DUMP"
echo "   Tabla: surco_health"
echo "   Fecha del dump: $(stat -c%y "$PG_DUMP" 2>/dev/null || stat -f%Sm "$PG_DUMP")"
echo "   Tamaño: $(stat -c%s "$PG_DUMP" 2>/dev/null || stat -f%z "$PG_DUMP") bytes"
echo ""
read -p "Escribe 'RESTAURAR' para continuar: " confirm
if [[ "$confirm" != "RESTAURAR" ]]; then
  echo "Cancelado."
  exit 0
fi

echo ""
echo "▶ Apagando api + web + worker (postgres sigue arriba)..."
docker compose -f "$COMPOSE" --env-file .env stop api web worker 2>/dev/null || true

echo "▶ Restaurando Postgres..."
docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  psql -U surco -d postgres -c "DROP DATABASE IF EXISTS surco_health WITH (FORCE);"
docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  psql -U surco -d postgres -c "CREATE DATABASE surco_health OWNER surco;"
docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  pg_restore -U surco -d surco_health --no-owner --no-acl < "$PG_DUMP"

# Re-aplicar trigger + constraints (vienen del dump pero por seguridad)
docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  psql -U surco -d surco_health < infra/sql/post-deploy.sql || true

if [[ -n "$MINIO_TAR" ]] && [[ -f "$MINIO_TAR" ]]; then
  echo "▶ Restaurando MinIO desde $MINIO_TAR..."
  docker compose -f "$COMPOSE" --env-file .env stop minio
  docker run --rm \
    -v surco_health_miniodata:/dest \
    -v "$(dirname "$MINIO_TAR")":/source:ro \
    alpine \
    sh -c "cd /dest && tar xzf /source/$(basename "$MINIO_TAR")"
  docker compose -f "$COMPOSE" --env-file .env start minio
fi

echo "▶ Levantando api + worker + web..."
docker compose -f "$COMPOSE" --env-file .env up -d api worker web

echo ""
echo "✅ Restore OK $(date +'%Y-%m-%d %H:%M:%S')"
echo "   Verifica: curl http://127.0.0.1:4002/health"

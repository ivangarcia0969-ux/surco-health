#!/bin/bash
# ============================================================
# Surco Health — Backup automático Postgres + MinIO + ENCRYPTION_KEY
#
# CRÍTICO: Surco maneja HCE con retención legal 15 años (Res 839/2017).
# Sin backups, perder el VPS = perder los datos = riesgo penal.
#
# Uso:
#   bash infra/scripts/backup.sh          → backup local (rotación 14 días)
#   BACKUP_REMOTE=1 bash infra/scripts/backup.sh  → además sube a remoto
#
# Cron sugerido en VPS (3am todos los días):
#   0 3 * * * cd /opt/surco-health && BACKUP_REMOTE=1 bash infra/scripts/backup.sh >> /var/log/surco-backup.log 2>&1
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/../.."
APP_DIR="$(pwd)"
COMPOSE="infra/docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "✗ Falta .env" >&2
  exit 1
fi
set -a; source .env; set +a

# Defaults
BACKUP_DIR="${BACKUP_DIR:-/var/backups/surco-health}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
TS=$(date +'%Y%m%d_%H%M%S')

mkdir -p "$BACKUP_DIR"/{postgres,minio,keys}

log() { echo -e "\033[1;32m▶ $*\033[0m"; }
warn() { echo -e "\033[1;33m⚠ $*\033[0m"; }
die() { echo -e "\033[1;31m✗ $*\033[0m" >&2; exit 1; }

# ============================================================
# 1) Postgres dump (custom format — comprimido, restaurable selectivo)
# ============================================================
PG_OUT="$BACKUP_DIR/postgres/surco_health_${TS}.dump"
log "Backup Postgres → $PG_OUT"
docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  pg_dump -U surco -d surco_health -Fc --no-owner \
  > "$PG_OUT"

PG_SIZE=$(stat -c%s "$PG_OUT" 2>/dev/null || stat -f%z "$PG_OUT")
log "  ✓ Postgres dump: $((PG_SIZE / 1024)) KB"

# ============================================================
# 2) MinIO (archivos clínicos cifrados)
# ============================================================
MINIO_OUT="$BACKUP_DIR/minio/minio_${TS}.tar.gz"
log "Backup MinIO → $MINIO_OUT"
docker run --rm \
  --network surco_health_net \
  -v surco_health_miniodata:/source:ro \
  -v "$BACKUP_DIR/minio":/dest \
  alpine \
  sh -c "tar czf /dest/minio_${TS}.tar.gz -C /source ." \
  || warn "Backup MinIO falló (no crítico si no usas archivos)"

# ============================================================
# 3) ENCRYPTION_KEY — copia separada, indispensable para restaurar
# ============================================================
# Si pierdes la key, los datos cifrados (SoapNote, accessToken WhatsApp,
# etc.) son IRRECUPERABLES. Mantén copia en gestor de secretos externo.
KEY_OUT="$BACKUP_DIR/keys/encryption_key_${TS}.enc"
log "Backup ENCRYPTION_KEY → $KEY_OUT (recuerda copiar a 1Password/Vault)"
echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" > "$KEY_OUT"
chmod 600 "$KEY_OUT"

# ============================================================
# 4) Rotación local: borrar dumps > RETENTION_DAYS
# ============================================================
log "Rotación local (retención $RETENTION_DAYS días)..."
find "$BACKUP_DIR/postgres" -name 'surco_health_*.dump' -type f -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR/minio" -name 'minio_*.tar.gz' -type f -mtime +"$RETENTION_DAYS" -delete
find "$BACKUP_DIR/keys" -name 'encryption_key_*.enc' -type f -mtime +60 -delete  # keys: 60 días

# ============================================================
# 5) Backup remoto opcional (Backblaze B2 / S3 vía rclone)
# ============================================================
if [[ "${BACKUP_REMOTE:-0}" == "1" ]]; then
  if ! command -v rclone > /dev/null; then
    warn "rclone no instalado. apt install rclone y configura una remote (b2:, s3:, etc.)"
  elif [[ -z "${BACKUP_REMOTE_PATH:-}" ]]; then
    warn "BACKUP_REMOTE_PATH no configurado. Ej: BACKUP_REMOTE_PATH=b2:surco-health-backups"
  else
    log "Subiendo backups a $BACKUP_REMOTE_PATH..."
    rclone copy --transfers 2 --checksum "$PG_OUT" "$BACKUP_REMOTE_PATH/postgres/" \
      && log "  ✓ Postgres subido"
    [[ -f "$MINIO_OUT" ]] && rclone copy --transfers 2 "$MINIO_OUT" "$BACKUP_REMOTE_PATH/minio/"
    # NO subir la encryption_key en plano. Documenta en runbook.
  fi
fi

# ============================================================
# 6) Resumen
# ============================================================
echo ""
log "✅ Backup OK $(date +'%Y-%m-%d %H:%M:%S')"
echo "   Local: $BACKUP_DIR"
echo "   Postgres dump: $((PG_SIZE / 1024)) KB"
echo ""
echo "🔑 RECUERDA: la ENCRYPTION_KEY debe vivir TAMBIÉN en 1Password (o gestor"
echo "   externo). Si pierdes el VPS Y la copia local, los datos cifrados son"
echo "   irrecuperables. Verifica que tienes la copia externa al día."

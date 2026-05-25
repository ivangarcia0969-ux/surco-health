#!/bin/bash
# ============================================================
# Surco Health — Deploy / update vía Docker Compose
#
# Uso (en VPS):
#   cd /opt/surco-health && bash infra/scripts/deploy.sh
#
# Asume:
#   - .env existe en la raíz del repo
#   - Docker está instalado
#   - Caddy ya está corriendo (con o sin los bloques de Surco)
#
# Idempotente: puedes correrlo en cada actualización.
# ============================================================
set -euo pipefail

cd "$(dirname "$0")/../.."
APP_DIR="$(pwd)"
COMPOSE="infra/docker-compose.prod.yml"

log() { echo -e "\n\033[1;32m▶ $*\033[0m"; }
warn() { echo -e "\n\033[1;33m⚠ $*\033[0m"; }
die() { echo -e "\n\033[1;31m✗ $*\033[0m" >&2; exit 1; }

if [[ ! -f .env ]]; then
  die "Falta .env. Copia .env.example y configura DB_PASSWORD/JWT_*/ENCRYPTION_KEY/S3_*."
fi

# Carga .env en bash para que ${VAR} esté disponible
set -a; source .env; set +a

log "Git pull (origin/main)..."
git fetch --all --prune
git reset --hard origin/main

log "Build de imágenes Docker (api + web)..."
docker compose -f "$COMPOSE" --env-file .env build api web

log "Levantando postgres + redis + minio..."
docker compose -f "$COMPOSE" --env-file .env up -d postgres redis minio

log "Esperando que Postgres esté listo..."
for i in {1..30}; do
  if docker compose -f "$COMPOSE" --env-file .env exec -T postgres pg_isready -U surco -d surco_health > /dev/null 2>&1; then
    echo "  ✓ Postgres listo"
    break
  fi
  sleep 2
done

# Sincronizar schema. Primera vez usa db push (sin migraciones); si existe carpeta migrations/, usa migrate deploy
if [[ -d packages/db/prisma/migrations ]] && [[ -n "$(ls -A packages/db/prisma/migrations 2>/dev/null)" ]]; then
  log "Aplicando migraciones de Prisma (migrate deploy)..."
  PRISMA_CMD="prisma migrate deploy"
else
  log "Sincronizando schema con Postgres (db push — primera vez sin migraciones)..."
  PRISMA_CMD="prisma db push --skip-generate"
fi
docker compose -f "$COMPOSE" --env-file .env run --rm \
  --entrypoint sh api \
  -c "cd /repo && pnpm --filter @surco/db exec $PRISMA_CMD"

# Re-ejecutar SQL de extensiones y trigger anti-mutación
log "Aplicando trigger anti-mutación sobre AuditLog..."
docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  psql -U surco -d surco_health < infra/postgres-init/02-trigger-auditlog.sql || \
  warn "No se pudo aplicar el trigger (posiblemente la tabla aún no existe — corre el seed primero)"

log "Levantando api y web..."
docker compose -f "$COMPOSE" --env-file .env up -d --remove-orphans api web

log "Esperando a que la API responda /health..."
HEALTHY=0
for i in {1..30}; do
  if curl -fsS http://127.0.0.1:4002/health > /dev/null 2>&1; then
    echo "  ✓ API responde"
    HEALTHY=1
    break
  fi
  sleep 2
done

log "Estado del stack:"
docker compose -f "$COMPOSE" --env-file .env ps

if [[ $HEALTHY -eq 0 ]]; then
  warn "API no respondió en 60s. Revisa logs: docker compose -f $COMPOSE --env-file .env logs --tail 80 api"
fi

echo ""
echo "✅ Deploy OK  $(date +'%Y-%m-%d %H:%M:%S')"
echo ""
echo "   API:   http://127.0.0.1:4002/health"
echo "   Web:   http://127.0.0.1:3002"
echo "   MinIO: http://127.0.0.1:9003 (consola)"
echo ""
echo "Próximos pasos (si es primer deploy):"
echo "  1) Pegar el snippet de Caddy:"
echo "     sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.\$(date +%Y%m%d_%H%M%S)"
echo "     sudo bash -c 'cat $APP_DIR/infra/caddy/surco-health.caddy >> /etc/caddy/Caddyfile'"
echo "     sudo caddy validate --config /etc/caddy/Caddyfile"
echo "     sudo systemctl reload caddy"
echo ""
echo "  2) Cargar datos demo (opcional):"
echo "     docker compose -f $COMPOSE --env-file .env exec api pnpm --filter @surco/db db:seed"
echo ""

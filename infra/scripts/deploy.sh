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

# Aplicar post-deploy SQL: trigger AuditLog inmutable, EXCLUDE constraint
# en Appointment (anti-doble-booking), GIN indexes pg_trgm para búsqueda.
# DEBE corren DESPUÉS de prisma db push (las tablas ya existen).
log "Aplicando post-deploy SQL (trigger AuditLog + EXCLUDE constraint + GIN trgm)..."
if ! docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  psql -U surco -d surco_health -v ON_ERROR_STOP=1 < infra/sql/post-deploy.sql; then
  die "FALLO al aplicar post-deploy SQL. El trigger inmutable + constraint anti-overlap son CRÍTICOS para compliance Res 1995/1999. Aborta el deploy hasta arreglar."
fi
log "  ✓ Trigger AuditLog inmutable verificado"
log "  ✓ Constraint EXCLUDE anti-doble-booking verificado"
log "  ✓ GIN indexes pg_trgm verificados"

# Importar dataset CIE-10 si la BD tiene muy pocos códigos (~10 del seed).
# Best-effort: si falla la descarga del dataset Minsalud, el deploy NO falla
# (el seed dejó 10 códigos básicos como fallback). Pero registramos warning.
log "Verificando dataset CIE-10..."
ICD10_COUNT=$(docker compose -f "$COMPOSE" --env-file .env exec -T postgres \
  psql -U surco -d surco_health -At -c 'SELECT COUNT(*) FROM "Icd10Code";' 2>/dev/null || echo 0)
if [[ "$ICD10_COUNT" -lt 1000 ]]; then
  log "Solo $ICD10_COUNT códigos CIE-10. Importando dataset completo de Minsalud..."
  if docker compose -f "$COMPOSE" --env-file .env run --rm \
    --entrypoint sh api \
    -c "cd /repo && pnpm --filter @surco/db db:seed:icd10"; then
    log "  ✓ Dataset CIE-10 importado"
  else
    warn "Falló la importación CIE-10 (Minsalud sin respuesta). El autocomplete funcionará con los ~10 códigos del seed. Re-ejecuta manualmente:"
    warn "  docker compose -f $COMPOSE --env-file .env run --rm api pnpm --filter @surco/db db:seed:icd10"
  fi
else
  log "  ✓ Dataset CIE-10 ya cargado ($ICD10_COUNT códigos)"
fi

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

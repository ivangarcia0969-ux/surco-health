#!/bin/bash
# ============================================================
# Surco Health — Publicar la versión nueva + cargar/refrescar la demo
# odontológica ("Clínica Dental Sonrisa").
#
# Uso (en el VPS):
#   cd /opt/surco-health && bash infra/scripts/deploy-demo.sh
#
# 1) Corre el deploy normal (git pull, build, db push, SQL, levantar)
# 2) Carga o refresca los datos demo (idempotente: no duplica pacientes
#    ni pagos; regenera la agenda de hoy y mañana)
# 3) Verifica que la API responda
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/../.."
COMPOSE="infra/docker-compose.prod.yml"

bash infra/scripts/deploy.sh

echo -e "\n\033[1;32m▶ Cargando datos demo odontológicos...\033[0m"
docker compose -f "$COMPOSE" --env-file .env run --rm \
  --entrypoint sh api \
  -c "cd /repo && pnpm --filter @surco/db db:seed:demo"

# El worker usa la misma imagen del api: recrearlo para que tome la versión nueva
docker compose -f "$COMPOSE" --env-file .env up -d --force-recreate worker || true

echo -e "\n\033[1;32m▶ Verificación final\033[0m"
curl -fsS http://127.0.0.1:4002/health && echo
echo -e "\n✅ Listo. Abre https://app.salud.surcoapp.tech (Ctrl+Shift+R para ver la versión nueva)."

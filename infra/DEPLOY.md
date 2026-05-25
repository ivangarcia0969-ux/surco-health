# Despliegue de Surco Health al VPS sin afectar otras apps

Este documento garantiza que el despliegue **coexiste con Karpos, Barbería y cualquier otra app Docker** del mismo VPS, sin alterar configs existentes.

## 🛡️ Cómo aseguramos el aislamiento

| Recurso | Resto del VPS | Surco Health |
|---|---|---|
| Carpeta | `/opt/karpos`, `/opt/saas-barberias` | **`/opt/surco-health`** |
| Containers Docker | `karpos_*`, `saas_barberias_*` | **`surco_*`** |
| Network Docker | otras | **`surco_health_net`** |
| Volúmenes | otros | **`surco_health_pgdata`, `_redisdata`, `_miniodata`** |
| Postgres host | 5432, 5433, 5434 | **5435** |
| Redis host | 6379, 6543, 6380 | **6381** |
| API host | 3000, 4001, 4100 | **4002** |
| Web host | 3000, 3001 | **3002** |
| MinIO host | — | **9002 / 9003** |
| Subdominios | `*.karpos`, `*.barber` | **`*.salud.surcoapp.tech`** |

> Todos los puertos del compose están bind a **127.0.0.1**, nunca a `0.0.0.0`. Caddy del host hace el reverse-proxy.

## 🚫 Lo que NO se hace
- **NO se ejecuta** `bootstrap-vps.sh` ni nada que instale Postgres/Redis/Nginx nativos.
- **NO** se modifican configs de Karpos / Barbería.
- **NO** se tocan reglas de firewall.
- **NO** se modifica nada del Caddyfile existente — **solo se añaden 2 bloques** al final.

## 🔁 Plan de rollback (30 segundos)
Si algo se rompe, Surco Health se apaga sin afectar nada más:
```bash
cd /opt/surco-health && docker compose -f infra/docker-compose.prod.yml --env-file .env down
```
Karpos y Barbería siguen corriendo, intactos.

---

## 1️⃣ DNS — crear 2 registros en Hostinger

En hPanel → DNS Zone Editor de `surcoapp.tech`:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | `app.salud` | `2.24.89.123` | 14400 |
| A | `api.salud` | `2.24.89.123` | 14400 |

> Solo 2 nuevos. No tocas los existentes (`*.karpos`, `*.barber`, los mail, etc.)

## 2️⃣ Pre-flight check del VPS

Desde SSH al VPS, confirma que estos puertos están LIBRES:
```bash
ss -tlnp | grep -E ':(5435|6381|4002|3002|9002|9003)' && echo "❌ Hay un puerto ocupado" || echo "✓ Puertos libres"
```
Si algún puerto está ocupado, **alto** — cuéntame para reasignar.

También verifica que Docker funciona:
```bash
docker info > /dev/null && echo "✓ Docker OK" || echo "❌ Docker no responde"
```

## 3️⃣ Clonar el repo

```bash
mkdir -p /opt/surco-health && cd /opt/surco-health
git clone https://github.com/ivangarcia0969-ux/surco-health.git .
```

Si el repo es privado, usa PAT:
```bash
git clone https://USERNAME:TOKEN@github.com/ivangarcia0969-ux/surco-health.git .
```

## 4️⃣ Crear `.env`

```bash
cd /opt/surco-health

cat > .env <<EOF
DB_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -hex 32)

WEB_BASE_URL=https://app.salud.surcoapp.tech
CORS_ORIGINS=https://app.salud.surcoapp.tech

NEXT_PUBLIC_API_URL=https://api.salud.surcoapp.tech
NEXT_PUBLIC_APP_DOMAIN=app.salud.surcoapp.tech

WORKER_ENABLED=true

# Storage local MinIO
S3_ACCESS_KEY=$(openssl rand -hex 12)
S3_SECRET_KEY=$(openssl rand -hex 24)
S3_BUCKET=surco-health-files

# Opcionales (vacío = no se usa, app degrada limpio)
DAILY_API_KEY=
DAILY_DOMAIN=
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
EOF

chmod 600 .env
echo "✓ .env creado"
ls -la .env
```

⚠️ **CRÍTICO:** guarda `ENCRYPTION_KEY` en gestor de secretos (1Password, Bitwarden, etc.). Si la pierdes, **los datos clínicos cifrados son irrecuperables**.

## 5️⃣ Deploy

```bash
cd /opt/surco-health
bash infra/scripts/deploy.sh 2>&1 | tee /tmp/surco-deploy.log
```

Toma ~8-12 minutos la primera vez (build de imágenes Node, descarga deps, prisma generate, etc.).

Verifica los containers:
```bash
docker ps --filter "name=surco_" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Deberías ver 5 containers Up: `surco_postgres`, `surco_redis`, `surco_minio`, `surco_api`, `surco_web`.

Test interno:
```bash
curl http://127.0.0.1:4002/health
# {"status":"ok","ts":"..."}
```

## 6️⃣ Cargar datos demo (recomendado para validar)

```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env \
  exec api pnpm --filter @surco/db db:seed
```

Credenciales que crea el seed:
- SaaS Admin: `admin@surcohealth.local` / `admin123`
- Owner clínica: `owner@clinicademo.local` / `owner123`
- Dr. médico: `dr.garcia@clinicademo.local` / `doctor123`
- Dra. dental: `dra.lopez@clinicademo.local` / `dental123`
- Dra. psico: `dra.ruiz@clinicademo.local` / `psico123`

## 7️⃣ Caddy — añadir los 2 bloques

**Backup primero:**
```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d_%H%M%S)
```

Verifica el backup:
```bash
ls -la /etc/caddy/Caddyfile.bak.*
```

**Añadir snippet:**
```bash
sudo bash -c 'cat /opt/surco-health/infra/caddy/surco-health.caddy >> /etc/caddy/Caddyfile'
```

**Validar (CRÍTICO):**
```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```
Debe decir `Valid configuration`. Si no, **NO recargues** — restaura el backup:
```bash
sudo cp /etc/caddy/Caddyfile.bak.<TIMESTAMP_RECIENTE> /etc/caddy/Caddyfile
```

**Recargar (sin downtime):**
```bash
sudo systemctl reload caddy
sudo journalctl -u caddy -f --since "1 minute ago"
# Espera ver "obtained certificate" para api.salud y app.salud (30-60s)
# Ctrl+C para salir
```

## 8️⃣ Verificar desde Internet

```bash
curl https://api.salud.surcoapp.tech/health
# {"status":"ok","ts":"..."}
```

En el navegador:
- https://app.salud.surcoapp.tech → landing
- https://app.salud.surcoapp.tech/login → entra con `owner@clinicademo.local` / `owner123`
- Abre un paciente → tab Odontograma → verifica que carga el SVG interactivo

## 9️⃣ Verificación de aislamiento (importante)

Confirma que Karpos y Barbería siguen vivos:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}" | head -30
```

Y que Caddy enruta los 3 a sus puertos correctos:
```bash
curl -sS https://app.karpos.surcoapp.tech | head -5            # Karpos
curl -sS https://api.barber.surcoapp.tech/health               # Barbería
curl -sS https://api.salud.surcoapp.tech/health                # Surco Health
```

## 🔧 Operación día a día

### Actualizar a nueva versión
```bash
cd /opt/surco-health && bash infra/scripts/deploy.sh
```

### Ver logs
```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env logs -f api
docker compose -f infra/docker-compose.prod.yml --env-file .env logs -f web
```

### Backup de la BD
```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env exec -T postgres \
  pg_dump -U surco surco_health | gzip > /var/backups/surco-$(date +%Y%m%d).sql.gz
```

### Apagar TODO (sin borrar datos)
```bash
cd /opt/surco-health
docker compose -f infra/docker-compose.prod.yml --env-file .env down
```
Esto **NO afecta** Karpos ni Barbería — son stacks Docker separados.

### Borrar TODO incluyendo datos (CUIDADO)
```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env down -v
```

## 🔥 Troubleshooting

**Puerto ocupado al levantar postgres/redis/etc.**
→ Verifica con `ss -tlnp | grep PUERTO`. Reasigna el puerto en `docker-compose.prod.yml`.

**Caddy no obtiene cert**
→ Verifica DNS: `dig app.salud.surcoapp.tech +short` debe devolver `2.24.89.123`.

**API restart loop**
→ `docker compose ... logs api`. Lo más común al primer deploy:
  - `ENCRYPTION_KEY` mal configurada → revisa que tenga al menos 32 chars
  - Schema no aplicado → corre `pnpm --filter @surco/db exec prisma db push` dentro del container

**Trigger anti-mutación no se aplicó**
→ Conecta a la BD y corre el SQL a mano:
```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env exec -T postgres \
  psql -U surco -d surco_health < infra/postgres-init/02-trigger-auditlog.sql
```

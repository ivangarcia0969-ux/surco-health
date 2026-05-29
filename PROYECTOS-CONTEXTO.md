# 📚 PROYECTOS-CONTEXTO

> **Documento maestro** que captura todo el trabajo realizado, decisiones tomadas, infraestructura y status de los proyectos SaaS de Iván García.
>
> **Última actualización:** 2026-05-28 (FASES 0/1/2 ejecutadas tras auditoría — apto para marketing controlado ✅)
>
> Este archivo vive en ambos repos (`Barbershop` y `surco-health`) y se mantiene sincronizado por Git para no perder contexto entre sesiones.

## 🏁 HITOS POR FECHA

### 2026-05-28 (cont.) — FASE 2: bloqueadores medium post-auditoría
- **Pendiente commit** (este turno)
- **N+1 FHIR resuelto** — `buildPatientEverything` ahora reusa `vitalSigns` y `professional` ya cargados en lugar de re-fetch. Antes 1+2N queries por paciente, ahora 2 queries para todo el Bundle. Función pura `vitalsToObservation()` extraída.
- **Endpoint individual de HCE** — `GET /api/clinical/records/:id` con `READ_CLINICAL_RECORD` audit log. Cumple Res 1995/1999 Art. 9 (rastreo de consultas a HCE). Filtra por professionalId si rol=PROFESSIONAL. Bloquea registros `isLocked` excepto al creador u OWNER.
- **Flujo ARCO Surco** — modelo `ArcoRequest` + `apps/api/src/modules/arco/` con CRUD (crear, listar, resolver) + endpoint de portabilidad `GET /api/arco/patients/:id/export` (Bundle FHIR). Plazo legal 15 días hábiles tracked. Modelo `Patient.arcoRequests` back-relation.
- **Stock atómico Barbería** — `sales.service.ts` reemplaza bucle secuencial `update` por `$executeRaw` con `CASE WHEN` en una sola query. Con 10 productos: de 10 round-trips serializados → 1 round-trip.
- **Worker Barbería separado** — container `saas_barberias_worker` en `docker-compose.prod.yml` con `WORKER_ENABLED=true`. El `api` ahora corre con `WORKER_ENABLED=false` para no procesar jobs.
- **AuditLog Barbería** — modelo nuevo + helper `utils/audit.ts` + integración en login (LOGIN_SUCCESS / LOGIN_FAILURE con razón y IP/userAgent). Post-deploy SQL con trigger inmutable + EXCLUDE constraint + GIN trgm idéntico a Surco.
- **Tuning compose Barbería** — Postgres `shared_buffers=512MB`/`work_mem=12MB`, Redis `maxmemory=192mb noeviction`, JWT_REFRESH_TTL 14d, `connection_limit=15`, `mem_limit`/`cpus` por servicio, healthcheck Docker API.
- **PWA real** — iconos SVG escalables (`icon.svg`) en ambas apps + manifest.json actualizado (`scope`, `categories`, `purpose: maskable`). Los placeholders rotos del manifest original que el auditor detectó están eliminados.

### 2026-05-28 — Auditoría completa pre-venta masiva + FASES 0/1 ejecutadas
- **Pendiente commit** (este turno)
- **Auditoría** ejecutada por 4 agentes especializados (features Surco, features Barbería, escalabilidad, seguridad/compliance). Veredicto:
  - 🚨 6 promesas FALSAS o INCUMPLIDAS detectadas (worker WhatsApp Surco inexistente, "Funciona offline" Barbería falso, trigger AuditLog no aplicado en prod, booking público sin Habeas Data, solo 10 códigos CIE-10, footer multi-país sin sustento)
  - 🔴 12 bloqueadores técnicos de escala (pool conexiones default, sin cache auth, sin backups Surco, rate limit por IP, sin tuning Postgres, N+1 en FHIR, leak Stripe IDs, etc.)
  - Riesgo legal estimado pre-fix: $200M-$3.500M COP por incidente
- **FASE 0** (legal inmediato): copy del landing corregido en ambas apps ("Funciona offline" → "Optimizado para móvil"; "Cumple normativas LATAM" → "Colombia certificado · resto en homologación"; tarjeta WhatsApp Surco aclarada como "Disponible desde plan Pro"). Checkbox Habeas Data obligatorio en booking público Barbería + persistencia `privacyAcceptedAt/Version/Source` en Client. Páginas `/legal/privacidad` y `/legal/terminos` creadas en ambos webs (Habeas Data Ley 1581/2012 + Res 1995/1999 + ARCO + retención 15 años).
- **FASE 1** (bloqueadores críticos):
  - **Trigger AuditLog inmutable** movido a `infra/sql/post-deploy.sql` (corre DESPUÉS de `prisma db push`). El init script anterior corría antes y nunca aplicaba. Ahora deploy.sh aborta si falla.
  - **EXCLUDE constraint anti-doble-booking** con `tstzrange + gist` en Appointment.
  - **GIN indexes `pg_trgm`** sobre `Patient.fullName` y `Patient.document` (búsqueda <100ms con 50k pacientes).
  - **Worker BullMQ Surco** implementado completo: `apps/api/src/worker.ts` + `modules/notifications/{queue,reminder-worker,reminder-sweeper}.ts`. Container `surco_worker` separado en compose. Routing por sede + sweeper cada 10min para recovery. Idempotente (jobId).
  - **Importador CIE-10 Minsalud** (`db:seed:icd10`) con ~14k códigos desde `datos.gov.co`. Integrado en `deploy.sh` si BD tiene <1000 códigos.
  - **Backups Surco** (clonando patrón Barbería) — `infra/scripts/backup.sh` + `restore.sh` con dump pg_dump custom-format + MinIO tar + copia de ENCRYPTION_KEY local.
  - **Cache Redis para auth middleware** (`plugins/redis.ts`, TTL 60s). Reduce 90% queries del path crítico.
  - **Healthcheck real /health** chequea Postgres + Redis. Docker healthcheck wire'd.
  - **Rate limit por tenantId** (no IP) en ambas apps.
  - **CORS validation hardening** (rechaza `evilroot.com` aunque root sea `root.com`) en ambas.
  - **JWT algorithm restringido a HS256 explícitamente** (previene `alg: none` attack) en ambas.
  - **bcrypt cost 10 → 12** en ambas.
  - **GET /tenants/me omite Stripe IDs** para roles no-owner en ambas.
  - **docker-compose tuning**: Postgres `shared_buffers=1GB`, `effective_cache_size=3GB`, `work_mem=16MB`, `max_connections=150`. Redis `maxmemory=256mb` con `noeviction` (jobs delayed son críticos). `mem_limit/cpus` por servicio. JWT_REFRESH_TTL 30d → 14d. Connection limit Prisma `?connection_limit=15&pool_timeout=20`.

### 2026-05-25 (final) — FASE 6: Multi-bot WhatsApp per tenant (marketplace-ready)
- **Pendiente commit** (este turno) — supersedes FASE 5
- **Driver de negocio:** "vender el SaaS muchas veces" + cadenas/franquicias necesitan N bots
- **Schema nuevo:** modelo `WhatsappAccount` (1..N por Tenant)
  - `id`, `tenantId`, `name`, `displayPhone`, `phoneNumberId UNIQUE`, `businessAccountId`, `accessToken Bytes` (pgcrypto)
  - Routing: `isDefault` Boolean + `siteId String?` (asociar a sede)
  - Status: `verified`, `lastTestAt`, `isActive`
  - Quota: `monthlySent`, `monthResetAt`
- **Cuotas por plan** (campo `Plan.maxWhatsappAccounts`):
  - FREE: 1 bot · PRO: 2 bots · CLINICA: 5 bots · ENTERPRISE: 50 bots
- **Endpoints REST** `/api/whatsapp/accounts`:
  - `GET` lista con capacity (plan + cuota usada)
  - `POST` crear (gateado por cuota — 402 si excede)
  - `PATCH /:id` editar / rotar token (token rotado → verified=false)
  - `POST /:id/default` marcar como principal (transacción que limpia el anterior)
  - `POST /:id/test` envío de prueba a Meta Graph v22
  - `DELETE /:id` eliminar (si era default, promueve al siguiente)
- **Routing del worker** (`resolveAccountForSend`): siteId → bot del site → bot default → null (SKIPPED_NO_BOT)
- **UI nueva** `WhatsappAccountsManager.tsx`:
  - Lista de cards con badge Principal / Verificado / Pausado + cuota visible (barra)
  - Modal Crear/Editar con todos los campos + asociación a sede
  - Botón "Probar" por bot (envía hello_world)
  - Empty state si no hay bots con CTA "Conectar primer bot"
- **Portabilidad futura:** lógica Meta aislada en `callMetaGraph()` — mover a microservicio standalone = ~30 min cuando justifique
- **FASE 5 revertida** (los 5 campos del Tenant nunca llegaron a producción)

### 2026-05-25 (intermedio) — FASE 5 (REVERTIDA): WhatsApp config 1-por-tenant
- Implementación 1:1 reemplazada por FASE 6 antes del commit. Sin impacto en producción.

### 2026-05-25 17:30 — FASES 1-4 completas (todas desplegadas)
- **Commit:** `244f812`
- **FASE 1 — FHIR R4 export**: `apps/api/src/modules/fhir/` con `CapabilityStatement`, `Patient/:id`, `Patient/:id/$everything` (Bundle), `Composition/:id`, `Observation/:id`. Content-Type `application/fhir+json`. Gateado por `fhirExport` (plan CLINICA+). Verificado en producción: `/metadata` responde JSON FHIR v4.0.1.
- **FASE 2 — UI Tests psicométricos**: `PsychometricTestForm.tsx` con selector PHQ-9/GAD-7/BDI-II, preguntas en español, scale buttons, progress bar, live score, flags `SUICIDAL_IDEATION` y `HIGH_SEVERITY`.
- **FASE 3 — UI Notas SOAP**: `SoapNoteForm.tsx` con 5 secciones (S/O/A/P + Risk), niveles NONE/LOW/MEDIUM/HIGH/IMMINENT, plan de seguridad obligatorio para HIGH/IMMINENT, banner de confidencialidad, firma SHA-256.
- **FASE 4 — Plan dental**: `DentalTreatmentPlan.tsx` con 4 KPI cards (procedimientos, total, cobrado, pendiente), filtros chip por estado, tabla con costo+estado+acciones, footer con total. Endpoint `PATCH /api/dental/procedures/:id/status` agregado.

### 2026-05-25 16:30 — Surco Health LIVE en producción
- https://api.salud.surcoapp.tech/health responde JSON
- https://app.salud.surcoapp.tech/login funciona con login real
- 5 containers Docker corriendo: `surco_postgres`, `surco_redis`, `surco_minio`, `surco_api`, `surco_web`
- Caddy auto-HTTPS con certificados Let's Encrypt
- Seed cargado con usuarios demo y 5 servicios clínicos
- Coexiste sin afectar Karpos, Supabase, n8n, open-webui, Barbería

### 2026-05-25 (más tarde) — Módulo Catálogo completo
- **Commit:** `f24facc`
- Backend: `/api/catalog/services` CRUD + soft-delete + filtros
- Frontend: lista agrupada por especialidad con iconos, filtros chip, modal create/edit
- Precio dual (Particular + EPS), badge CIE-10, control de acceso por rol

### 2026-05-25 (más tarde) — HCE funcional y profesional
- **Commit:** `7b2e5c9`
- Backend: `listClinicalRecords` incluye `diagnoses`, `vitalSigns`, `dentalProcedures`
- `ensureProfessionalCanAccessPatient` flexibilizado (cualquier profesional del tenant)
- Frontend: 4 componentes clínicos nuevos:
  - `Cie10Search`: autocomplete con multi-select de diagnósticos
  - `ConsultationForm`: modal SOAP completo con firma electrónica
  - `EvolutionNoteForm`: notas de seguimiento encriptadas
  - `RecordCard`: badge por tipo, diagnósticos visibles, expand a detalle

---

## 👤 Owner y entorno

| Campo | Valor |
|---|---|
| Nombre | Iván García |
| Email | ivan.garcia0969@gmail.com |
| GitHub user | `ivangarcia0969-ux` |
| PC | Windows 11, OneDrive sincronizado |
| Carpeta raíz | `C:\Users\Agr338\OneDrive - Riopaila Agricola - Castilla Agricola\Documentos\CODEX\` |
| Stack preferido | Node 20 + TS + Fastify + Prisma + Postgres + Next 14 + Docker + Caddy |
| Idioma | Español (LATAM, foco Colombia) |
| Modo de trabajo | "Full automático" — el usuario prefiere que no se le pida autorización en cada paso |

---

## 🌐 Infraestructura compartida (VPS Hostinger)

| Componente | Valor |
|---|---|
| **Dominio** | `surcoapp.tech` (Hostinger, activo hasta 2027-05-09, auto-renewal ON) |
| **VPS IP** | `2.24.89.123` |
| **VPS Plan** | KVM 8 (8 vCPU, 32 GB RAM, 387 GB disco) |
| **VPS Host** | `srv1657782.hstgr.cloud` |
| **OS** | Ubuntu 24.04 LTS (noble) |
| **Reverse proxy** | **Caddy** nativo (puertos 80/443) — auto-HTTPS Let's Encrypt |
| **Orquestación** | **Docker** 29.4.3 (todo containerizado) |
| **SSH user** | `root` |
| **Carpetas /opt** | Cada app en su carpeta aislada |

### 📦 Apps coexistiendo en el VPS

| App | Containers | Puertos (host) | Dueño |
|---|---|---|---|
| **Karpos** (cultivarapp + app.karpos) | `karpos-web`, `karpos-api`, `karpos-postgres` | 3000, 4100, 8000, etc. | Iván (proyecto previo) |
| **Supabase** (12+ containers) | `supabase-*`, `realtime-dev.supabase-realtime` | 8000, 5432, 6543, etc. | Iván (BD compartida) |
| **n8n** | `n8n` | varios | Iván (automation) |
| **Open WebUI** | `open-webui` | — | Iván (LLM) |
| **SaaS Barberías** (en deploy parcial) | `saas_barberias_postgres/redis/api/web` | 5434, 6380, 4001, 3001 | Iván (proyecto SaaS #1) |
| **Surco Health** (en deploy actual) | `surco_postgres/redis/minio/api/web` | 5435, 6381, 9002, 9003, 4002, 3002 | Iván (proyecto SaaS #2) |

> **Política de aislamiento:** cada app usa **prefijo único** en containers (`karpos_*`, `saas_barberias_*`, `surco_*`) y **puertos únicos**. Caddy enruta por subdominio. Cero conflictos garantizados.

### 🌐 Subdominios DNS (Hostinger Zone Editor)

```
@ (root)               → existente
www                    → existente
*.karpos.surcoapp.tech → 2.24.89.123 (wildcard Karpos)
*.barber.surcoapp.tech → 2.24.89.123 (wildcard Barberías)
  ├── app.barber       → web SaaS Barberías
  └── api.barber       → API SaaS Barberías
*.salud.surcoapp.tech  → wildcard Surco Health
  ├── app.salud        → 2.24.89.123 (web Surco Health) ✓
  └── api.salud        → 2.24.89.123 (API Surco Health) ✓
* (wildcard top-level) → 2.24.89.123 (catch-all)
```

> Email: DKIM, SPF, DMARC, autodiscover, autoconfig — **NO TOCAR** (configurado por Hostinger Mail).

---

## 🎯 Proyecto 1 — SaaS Barberías

| Campo | Valor |
|---|---|
| **GitHub** | https://github.com/ivangarcia0969-ux/Barbershop |
| **Carpeta local** | `CODEX/saas barberias/` (con espacio en el nombre) |
| **Carpeta VPS** | `/opt/saas-barberias/` |
| **Subdominios** | `app.barber.surcoapp.tech`, `api.barber.surcoapp.tech` |
| **Estado** | 90% — falta solo terminar Caddy + seed + verificación |
| **Comando para retomar** | `ssh root@2.24.89.123` → `cd /opt/saas-barberias` → ver sección Barbería abajo |

### Stack y módulos
- **Backend:** Fastify + Prisma + PostgreSQL 16 + Redis + BullMQ
- **Frontend:** Next.js 14 PWA + Tailwind + Zustand
- **Pagos:** Stripe (suscripción del SaaS)
- **Notifs:** WhatsApp Cloud API (gated por plan)
- **Multi-tenant:** subdominios + middleware
- **Roles:** OWNER · COLLABORATOR · ADMIN_SAAS
- **Módulos:** auth, tenants, users, clients, catalog, appointments, schedule, sales, expenses, commissions, reports, billing, admin, notifications, public (reservas)
- **Pantallas (~16):** landing · login · register · dashboard · agenda · ventas · clientes · catalogo · colaboradores · comisiones · gastos · ajustes · mi-agenda · mis-ventas · /admin · /reservar/[slug]

### Status del deploy (a 2026-05-25)
- ✅ Repo en GitHub (último commit `93cecaf` / `8d5eab3` / `d66e58a` — Stripe binary fix)
- ✅ DNS `app.barber` y `api.barber` creados
- ✅ Postgres + Redis containers Up (healthy)
- ✅ Web container Up
- ❌ API container restarting al momento de pausar (último error fue Prisma binary, ya arreglado en commit `d66e58a`)
- ⏳ 7 comandos pendientes para terminar: pull fix, rebuild --no-cache, up, Caddy snippet, validate, reload, seed

### Para retomar Barbería:
```bash
ssh root@2.24.89.123
tmux new -s barber   # o tmux attach -t barber si ya existe
cd /opt/saas-barberias
git pull origin main
git log -1 --oneline   # debe mostrar d66e58a o más reciente

# Parar api+web, rebuild, levantar
docker compose -f infra/docker-compose.prod.yml --env-file .env stop api web
docker compose -f infra/docker-compose.prod.yml --env-file .env build --no-cache api web
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d api web

# Verificar
sleep 30 && docker compose -f infra/docker-compose.prod.yml --env-file .env logs --tail 50 api
curl http://127.0.0.1:4001/health

# Caddy
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d_%H%M%S)
sudo bash -c 'cat /opt/saas-barberias/infra/caddy/barber.caddy >> /etc/caddy/Caddyfile'
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy

# Seed
docker compose -f infra/docker-compose.prod.yml --env-file .env exec api pnpm --filter @saas/db db:seed

# Probar desde el navegador
# https://api.barber.surcoapp.tech/health
# https://app.barber.surcoapp.tech/login   (owner@demo.local / owner123)
```

---

## 🏥 Proyecto 2 — Surco Health (SaaS consultorios médicos)

| Campo | Valor |
|---|---|
| **GitHub** | https://github.com/ivangarcia0969-ux/surco-health |
| **Marca** | Surco Health (paraguas con `surcoapp.tech`) |
| **Carpeta local** | `CODEX/surco-health/` (sin espacio) |
| **Carpeta VPS** | `/opt/surco-health/` |
| **Subdominios** | `app.salud.surcoapp.tech`, `api.salud.surcoapp.tech` |
| **Estado** | 95% — falta arreglar build Docker + Caddy + seed |
| **Verticales** | Multi-vertical desde día 1: dental + médico general + psicología + pediatría + estética |
| **Pricing modelo** | USD 25-50 / profesional / mes (Saludtools competidor a USD 22-41) |

### Compliance LATAM implementado en código
- ✅ **Habeas Data Colombia (Ley 1581/2012):** `acceptedPrivacyPolicy: z.literal(true)` obligatorio al registrar tenant Y paciente. `privacyAcceptedAt` y `privacyVersion` trackeable
- ✅ **Resolución 1995/1999 Colombia:** HCE append-only con `previousRecordId` (adendas), `archivedAt` en lugar de delete, retención 15 años preservada
- ✅ **Resolución 866/2021 Colombia:** schema compatible con export FHIR R4 + RDA
- ✅ **Ley 527/1999 firma electrónica:** `signatureHash` SHA-256, `signatureIp`, `signatureUserAgent`, `bodyHash` para no-repudio
- ✅ **Encriptación at-rest pgcrypto:** SoapNote (4 campos), MedicalProfile (5 campos), PsychometricResult.answersEnc, ClinicalRecord.encryptedText
- ✅ **Audit log append-only obligatorio:** trigger Postgres BEFORE UPDATE/DELETE que rechaza mutación
- ✅ **NOM-024-SSA3-2012 México:** estructura HCE preparada

### Stack y módulos
- **Backend:** Fastify + Prisma + PostgreSQL 16 + **pgcrypto** + Redis + BullMQ
- **Frontend:** Next.js 14 PWA + Tailwind + Zustand
- **Storage:** **MinIO** (S3-compatible self-hosted, para radiografías y archivos clínicos)
- **Tele:** Daily.co SDK (opt-in)
- **Pagos:** Stripe + Wompi (Colombia)
- **FE LATAM:** DIAN/CFDI vía proveedor (Facture/Alegra/Siigo)
- **5 roles:** SAAS_ADMIN · CLINIC_OWNER · PROFESSIONAL · RECEPTIONIST · BILLING
- **15 especialidades:** MEDICAL_GENERAL, DENTAL, PSYCHOLOGY, PSYCHIATRY, PEDIATRICS, GYNECOLOGY, DERMATOLOGY, CARDIOLOGY, NUTRITION, PHYSIOTHERAPY, AESTHETICS, OPHTHALMOLOGY, ORTHOPEDICS, OTORHINOLARYNGOLOGY, OTHER

### Módulos del API (8 + 8 internos)
- `auth` (login, register clinic, refresh con rotación, logout)
- `tenants` (me, update, usage, plans, sites, rooms)
- `users` (me, professionals, staff, create con specialty + license)
- `patients` (CRUD + búsqueda + archivar)
- `appointments` (TX Serializable + colisión + lifecycle: REQUESTED→CONFIRMED→CHECKED_IN→IN_PROGRESS→ATTENDED)
- `clinical` (consultations, evolution notes, amendments — append-only)
- `dental` (chart FDI, treatments con procedures, aplica al chart)
- `medical` (vital signs con IMC, profile encriptado, ICD-10 search con trigram)
- `psychology` (SOAP 100% encriptado + bloqueado, tests PHQ-9/GAD-7/BDI-II)

### Pantallas del frontend (8)
- `/` landing pública con 6 features
- `/login` con manejo de errores traducidos
- `/register` con **checkbox forzado Habeas Data** (no se puede registrar sin aceptar)
- `/dashboard` KPIs + banner trial
- `/agenda` vista diaria agrupada por profesional con cambio de status
- `/pacientes` lista buscable + modal crear con Habeas Data del paciente
- `/pacientes/[id]` HCE con 4 tabs: Resumen · HCE · **Odontograma SVG** · Signos vitales
- `/ajustes` perfil clínica + plan + barras de uso

### 🦷 Pieza estrella: Odontograma SVG
- **Notación FDI** (estándar ISO 3950 LATAM)
- 32 dientes adultos: cuadrantes 18-11, 21-28, 31-38, 41-48
- 5 superficies clickeables por diente (vestibular, lingual, mesial, distal, oclusal)
- **15 condiciones** con paleta de colores:
  - HEALTHY (blanco), CARIES (rojo), FILLING_AMALGAM (negro), FILLING_RESIN (azul)
  - FILLING_TEMP (gris), CROWN (naranja), IMPLANT (violeta)
  - EXTRACTION_NEEDED (rojo oscuro), EXTRACTED (negro con X)
  - ROOT_CANAL (rosa), BRIDGE (cian), SEALANT (verde)
  - FRACTURE (ámbar), MOBILITY (naranja), ABSENT (gris)
- Dientes "whole" (extraído/ausente/implante/corona) cubren toda la pieza con X superpuesta
- onChange propaga a `PUT /api/dental/chart/{patientId}`

### Status del deploy (a 2026-05-25 — EN PRODUCCIÓN 🚀)
- ✅ Repo en GitHub (10 commits, último `f24facc`)
- ✅ DNS `app.salud` y `api.salud` resuelven a 2.24.89.123
- ✅ Repo clonado en `/opt/surco-health`
- ✅ `.env` creado con secretos generados
- ✅ **ENCRYPTION_KEY guardada en backup** (screenshot del 2026-05-25; pendiente migrar a 1Password)
- ✅ Build Docker exitoso tras 4 fixes (ver tabla de bugs abajo)
- ✅ Postgres + Redis + MinIO containers `Up (healthy)`
- ✅ API container `Up`, responde a `/health`
- ✅ Web container `Up`
- ✅ Caddy: snippet añadido, validado, recargado, certs SSL obtenidos
- ✅ Seed cargado: 4 planes, SaaS admin, owner, 3 profesionales, recepción, 5 servicios, 3 tests psicométricos, 10 códigos CIE-10, paciente demo
- ✅ Login probado: `owner@clinicademo.local` / `owner123` → dashboard funcionando
- ✅ Páginas verificadas en navegador: `/dashboard`, `/agenda`, `/pacientes`, `/pacientes/[id]` con odontograma SVG, `/profesionales`, `/catalogo`, `/ajustes`

### Para retomar Surco Health:
```bash
ssh root@2.24.89.123
tmux attach -t surco   # o tmux new -s surco
cd /opt/surco-health
git pull origin main
git log -1 --oneline   # debe mostrar eda8273 o más reciente

bash infra/scripts/deploy.sh 2>&1 | tee /tmp/surco-deploy.log

# Si OK al final ("✅ Deploy OK"):
curl http://127.0.0.1:4002/health

# Caddy
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.bak.$(date +%Y%m%d_%H%M%S)
sudo bash -c 'cat /opt/surco-health/infra/caddy/surco-health.caddy >> /etc/caddy/Caddyfile'
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy

# Seed
docker compose -f infra/docker-compose.prod.yml --env-file .env exec api pnpm --filter @surco/db db:seed

# Probar
# https://api.salud.surcoapp.tech/health
# https://app.salud.surcoapp.tech/login (owner@clinicademo.local / owner123)
```

---

## 🛠️ Stack común a ambos proyectos

| Capa | Decisión | Razón |
|---|---|---|
| Runtime | Node 20 LTS | LTS estable, soporte largo |
| Lenguaje | TypeScript 5.6 | Type safety + tooling |
| Backend framework | **Fastify** | Más rápido que Express, validación schemas nativa |
| ORM | **Prisma** | Type-safe, migraciones, Studio para debug |
| DB | **PostgreSQL 16** | Relacional, transacciones, pgcrypto, JSONB |
| Cache/Queue | **Redis 7** + BullMQ | Sesiones, recordatorios programados |
| Frontend | **Next.js 14 App Router** | SSR + PWA + middleware multi-tenant |
| UI | **Tailwind + Zustand** | Mobile-first, store ligero con persist |
| Auth | **JWT** access (15m) + **refresh** (30d, rotación, IP tracking) | Stateless, seguro |
| Container | **Docker** + **docker compose** | Reproducible, aislamiento |
| Reverse proxy | **Caddy** (no Nginx) | Auto-HTTPS Let's Encrypt, config simple |
| Monorepo | **Turborepo + pnpm workspaces** | Cache + tipos compartidos |
| Pagos | **Stripe** | Estándar global |
| Pagos LATAM | **Wompi** (Surco) | Para clientes que pagan con métodos locales |
| WhatsApp | **Cloud API Meta** | Recordatorios gateados por plan |

### ⚠️ Decisiones críticas que NO se deben revertir

1. **pgcrypto para encriptación at-rest** — no usar AES en aplicación, dejar que Postgres lo haga (más auditable y reversible si rotamos clave por tenant en V2)
2. **AuditLog append-only con trigger Postgres** — la mutación está prohibida a nivel DB, no solo aplicación
3. **HCE append-only via amendments** — `previousRecordId` apunta al original, jamás se reescribe — compliance Res 1995/1999
4. **`acceptedPrivacy` obligatorio en Zod schemas** — no se puede crear paciente sin aceptación Habeas Data
5. **Puertos host bind a 127.0.0.1** — Caddy es el ÚNICO punto de entrada público
6. **ENCRYPTION_KEY irrecuperable si se pierde** — debe estar en gestor de secretos

---

## 🐛 Bugs encontrados y resueltos (NO repetir)

### En SaaS Barberías

| # | Bug | Síntoma | Fix | Commit |
|---|---|---|---|---|
| 1 | `pnpm prisma generate` falla con `none of the packages has "prisma" script` | El comando del package root usaba `pnpm --filter @saas/db prisma generate` | Cambiar a `pnpm --filter @saas/db exec prisma generate` | `88dfef9` |
| 2 | Type-check del API falla con TS2742 en TODOS los services | Inferencia de tipos Prisma necesitaba paths absolutos al runtime | `"declaration": false` en `apps/api/tsconfig.json` (es app, no library) | `88dfef9` |
| 3 | Stripe SDK 17: `stripe.billing.portal` no existe | Stripe movió el path | `stripe.billingPortal.sessions.create` | `88dfef9` |
| 4 | Stripe `apiVersion: '2024-09-30.acacia'` no asignable | Versión cambió | Omitir apiVersion (deja el default del SDK pinneado) | `88dfef9` |
| 5 | `jwt.sign(... expiresIn: env.JWT_ACCESS_TTL)` mal tipado | jsonwebtoken 9 cambió tipos | `const opts: SignOptions = { expiresIn: ttl as SignOptions['expiresIn'] }` | `88dfef9` |
| 6 | Deploy script: `DB_PASSWORD: unbound variable` | Script bash no carga .env | Detectar si hay migrations/, usar `db push` si no | `484741d` |
| 7 | API crashea: `Cannot find module '@saas/shared/src/schemas/auth'` | package.json apuntaba a `./src/index.ts` | Cambiar `main` a `./dist/index.js`, agregar `exports` field | `93cecaf` |
| 8 | API crashea: `Cannot find module 'zod'` | Faltaba copiar `packages/shared/node_modules` en runtime Docker | Añadir COPY al Dockerfile | `8d5eab3` |
| 9 | Prisma client buscando OpenSSL 1.1.x en Debian 12 | binaryTargets default no detectaba bien | `binaryTargets = ["native", "debian-openssl-3.0.x"]` | `d66e58a` |

### En Surco Health

| # | Bug | Síntoma | Fix | Commit |
|---|---|---|---|---|
| 1 | Docker build: `"/pnpm-lock.yaml": not found` | Olvidé hacer `pnpm install` antes del primer commit | Ejecutar `pnpm install` localmente y commitear `pnpm-lock.yaml` | `eda8273` |
| 2 | Prisma validate: `extensions property only available with postgresqlExtensions preview feature` | Sintaxis `extensions = [pgcrypto, pg_trgm]` requiere flag | Añadir `previewFeatures = ["postgresqlExtensions"]` al generator | `eda8273` |
| 3 | Prisma validate: `relation services missing opposite on ClinicalService` | Tenant.services apuntaba a ClinicalService[] sin back-relation | Añadir `tenant Tenant @relation(...)` a ClinicalService | `eda8273` |
| 4 | Prisma validate: `Diagnosis.clinicalRecordId` sin relación inversa | Faltaba relation field | Añadir relation en Diagnosis + back-relation `diagnoses ClinicalRecord[]` | `eda8273` |
| 5 | `tsc` falla en `@surco/audit` con TS2742 | Generación `.d.ts` con tipos Prisma inferidos = paths no portables | `declaration: false` + `declarationMap: false` en tsconfig de audit, encryption, db | `a99ba3b` |
| 6 | `@surco/audit` build: TS2580 `Cannot find name 'process'` | Audit importa transitivamente db/src/index.ts que usa Node globals, sin `@types/node` | Añadir `@types/node` a devDependencies de audit y encryption | `a99ba3b` |
| 7 | Caddy 404 en `/profesionales` y `/catalogo` | Sidebar referenciaba rutas sin página creada | Crear `apps/web/src/app/(app)/profesionales/page.tsx` y `/catalogo/page.tsx` | `e3f81ca` |
| 8 | Caddy validate falla con "Unexpected next token after '{' on same line" | Caddyfile existente sin trailing newline → concatena con snippet | `printf '\n\n' >> Caddyfile` antes del `cat snippet >>` | en VPS al momento |
| 9 | Caddy validate falla en linea 81 | `request_body { max_size 50MB }` inline no soportado en la versión de Caddy del VPS | Remover esa línea del snippet (default 10MB es suficiente para MVP) | `d0d594e` |
| 10 | Next webpack: `the name Field is defined multiple times` | Conflicto al añadir `RecordField` inline en `pacientes/[id]/page.tsx` que ya tenía un `Field` del tab Resumen | Renombrar el nuevo a `RecordField` para no chocar | `7b2e5c9` |
| 11 | HCE: profesional no puede crear consulta sin cita previa | `ensureProfessionalCanAccessPatient` exigía appointment previo, bloqueando urgencias y primeras consultas | Relajado: solo verifica que el paciente pertenezca al tenant; trazabilidad en audit log | `7b2e5c9` |

### Patterns NUEVOS aprendidos en Surco Health (aplicar siempre)

10. **`declaration: false` por defecto en todos los packages** del monorepo. Solo activar declarations si vas a publicar a npm. Con `types: src/index.ts` en package.json, TS resuelve tipos directamente desde fuente.

11. **`@types/node` en CADA package que importe del que usa Node globals.** Audit y encryption importan @surco/db que usa `process` y `global` — necesitan los types.

12. **Append a Caddyfile = SIEMPRE `printf '\n\n'` primero.** Los Caddyfiles del VPS no terminan en newline por estilo. Sin esto, la primera línea del snippet se concatena con la última del existente.

13. **`request_body { max_size }` debe ir multi-línea**, no inline. Algunas versiones de Caddy 2 son estrictas.

14. **Validar Prisma schema localmente ANTES de cualquier commit:** `cd packages/db && npx prisma validate`. Saca los errores de relación inversa y de preview features en segundos.

15. **Ejecutar `pnpm install` y commitear `pnpm-lock.yaml` antes del primer push.** Sin lockfile, Dockerfile con `--frozen-lockfile` falla.

16. **Nombrar componentes locales con prefijo `Record/Form/Patient...` para evitar colisiones.** Páginas largas (>500 líneas) ya tienen helpers como `Field`, `Stat`. Cualquier subcomponente nuevo debe llevar prefijo del dominio (`RecordField`, `VitalsField`, `PatientCard`).

17. **`ensureXCanAccessY` debe ser permisivo dentro del tenant, restrictivo entre tenants.** La trazabilidad va al audit log. NO bloquear flujos legítimos como urgencias o primera vez sin cita.

18. **Modal con secciones colapsables visualmente separadas** para formularios SOAP/HCE largos:
    - Cada sección con icono + título + subtítulo
    - Border-bottom de separación
    - Tamaño `size="xl"` del Modal (no `lg`)
    - Esto se vuelve patrón base para SOAP psicología, anamnesis pediátrica, etc.

19. **Default sensible para "firmar ahora"**: marcado por defecto al cerrar consulta. La mayoría firma al terminar; los borradores son la excepción.

20. **Filtros chip con conteo `[Todos (10)]` en listas largas** vuelve la UI 10x más usable que un dropdown estático.

### Patterns que SE TRAJERON de Barbería a Surco Health desde el inicio (evitar repetir)

1. ✅ `binaryTargets = ["native", "debian-openssl-3.0.x"]` en schema.prisma desde el día 1
2. ✅ `package.json` con `main: ./dist/index.js` desde el inicio
3. ✅ Copy de `packages/*/node_modules` en runtime Dockerfile
4. ✅ `declaration: false` en `apps/api/tsconfig.json`
5. ✅ Deploy script con `source .env` + `db push` fallback

---

## 🚀 Comandos cheatsheet (copy-paste ready)

### Localmente — Barbería
```powershell
cd "C:\Users\Agr338\OneDrive - Riopaila Agricola - Castilla Agricola\Documentos\CODEX\saas barberias"
pnpm install
pnpm infra:up         # postgres + redis Docker local
pnpm db:push          # primera vez (sin migrations)
pnpm db:seed
pnpm dev              # api:4000, web:3000
```

### Localmente — Surco Health
```powershell
cd "C:\Users\Agr338\OneDrive - Riopaila Agricola - Castilla Agricola\Documentos\CODEX\surco-health"
pnpm install
pnpm infra:up         # postgres + redis + minio
pnpm db:push
pnpm db:seed
pnpm dev
```

### VPS — Reconectar a una sesión
```powershell
ssh root@2.24.89.123
tmux attach -t surco    # o -t barber
```

### VPS — Ver estado de containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(karpos|barberias|surco|supabase)"
```

### VPS — Logs de un servicio
```bash
docker compose -f /opt/surco-health/infra/docker-compose.prod.yml --env-file /opt/surco-health/.env logs -f api
```

### VPS — Backup de BD de Surco
```bash
docker compose -f /opt/surco-health/infra/docker-compose.prod.yml --env-file /opt/surco-health/.env exec -T postgres \
  pg_dump -U surco surco_health | gzip > /var/backups/surco-$(date +%Y%m%d).sql.gz
```

### Cuando deploy.sh falla — diagnóstico
```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env logs --tail 80 api
docker compose -f infra/docker-compose.prod.yml --env-file .env ps
tail -80 /tmp/surco-deploy.log
```

### Apagar Surco Health sin afectar nada más
```bash
cd /opt/surco-health
docker compose -f infra/docker-compose.prod.yml --env-file .env down
```

### Rebuild forzado sin cache
```bash
docker compose -f infra/docker-compose.prod.yml --env-file .env stop api web
docker compose -f infra/docker-compose.prod.yml --env-file .env build --no-cache api web
docker compose -f infra/docker-compose.prod.yml --env-file .env up -d api web
```

---

## 🔐 Credenciales y accesos (DEMO)

### SaaS Barberías (después del seed)
| Rol | Email | Password |
|---|---|---|
| Admin SaaS | `admin@saas.local` | `admin123` |
| Owner demo | `owner@demo.local` | `owner123` |
| Colaborador | `barbero@demo.local` | `collab123` |

### Surco Health (después del seed)
| Rol | Email | Password |
|---|---|---|
| SaaS Admin | `admin@surcohealth.local` | `admin123` |
| Owner clínica | `owner@clinicademo.local` | `owner123` |
| Dr. Medicina General | `dr.garcia@clinicademo.local` | `doctor123` |
| Dra. Odontología | `dra.lopez@clinicademo.local` | `dental123` |
| Dra. Psicología | `dra.ruiz@clinicademo.local` | `psico123` |
| Recepción | `recep@clinicademo.local` | `recep123` |

### Paciente demo Surco
- Juan Pablo Pérez, CC 1023456789, 36 años, masculino

---

## 📊 Métricas finales por proyecto (a 2026-05-25)

| Métrica | Barbería | Surco Health |
|---|---|---|
| Commits | ~14 | **13** |
| Archivos | ~140 | ~127 |
| Líneas de código | ~10,500 | **~11,000** |
| Modelos Prisma | 15 | 28 |
| Módulos REST | 14 | **10** (auth, tenants, users, patients, appointments, clinical, dental, medical, psychology, catalog) |
| Endpoints REST | ~80 | ~65 |
| Pantallas frontend | 16 | **10** (landing, login, register, dashboard, agenda, pacientes, paciente/[id], profesionales, catalogo, ajustes) |
| Componentes clínicos reutilizables | — | **5** (Odontogram, Cie10Search, ConsultationForm, EvolutionNoteForm, RecordCard) |
| Verticales soportados | 1 (barbería) | 5 (dental, médico, psico, pediatría, estética) |
| Compliance LATAM | — | 6 normas (Habeas Data, Res 1995, Res 866, Ley 527, NOM-024, HIPAA) |
| En producción | Casi (faltan 7 cmds) | ✅ **SÍ** (app.salud.surcoapp.tech) |
| HTTPS | — | ✅ Let's Encrypt automático |
| Containers Docker | 4 (parcial) | 5 corriendo (postgres, redis, minio, api, web) |

---

## 🎯 Próximos pasos pendientes (a 2026-05-25 — Surco Health LIVE)

### ✅ Completado en esta sesión
- ~~Deploy Surco Health al VPS~~ ✓ Vivo en `app.salud.surcoapp.tech` y `api.salud.surcoapp.tech`
- ~~Páginas `/profesionales` y `/catalogo`~~ ✓ Funcionando
- ~~Módulo catalog completo con CRUD~~ ✓ Backend + frontend (`f24facc`)
- ~~**HCE funcional: ConsultationForm + EvolutionNote + Cie10Search + RecordCard**~~ ✓ (`7b2e5c9`)
- ~~Backend `listClinicalRecords` con diagnoses/vitalSigns/dentalProcedures incluidos~~ ✓
- ~~`ensureProfessionalCanAccessPatient` flexibilizado para urgencias~~ ✓

### Inmediato (siguiente sesión)
1. **Surco Health:** rebuild api+web tras commit `7b2e5c9` para activar HCE funcional en producción
2. **Barbería:** terminar los últimos 7 comandos para tener HTTPS público en `app.barber.surcoapp.tech`

### Corto plazo (features clínicos faltantes)
3. **Frontend Notas SOAP psicológicas** (backend ya está en `psychology.routes.ts`, falta UI con encriptación visible)
4. **Frontend Aplicar test psicométrico** (PHQ-9, GAD-7, BDI-II — backend `applyTest` ya calcula score + interpretación + flags)
5. **Subida de archivos clínicos** a MinIO + visor de radiografías
6. **Recetas médicas con firma + link a MIPRES Colombia**
7. **Consentimientos informados digitales** con firma canvas
8. **Página de gastos** (módulo administrativo)
9. **Atender desde agenda** — botón "Atender" en cita que abre ConsultationForm con `appointmentId` precargado

### Configuración / activación de servicios externos
10. **WhatsApp Cloud API:** sacar token de Meta Business y configurar en `.env`
11. **Stripe billing real:** crear Price IDs en Stripe Dashboard, actualizar `Plan.stripePriceId` en seed/admin
12. **Daily.co teleconsulta:** crear cuenta, sacar API key, configurar `.env`
13. **DIAN facturación electrónica:** contratar Facture / Alegra / Siigo + integrar webhook

### Operación
14. **Backups automáticos:** cron diario en VPS para `pg_dump` + sync a S3 externo (Backblaze B2 o Cloudflare R2)
15. **Monitoreo:** Uptime Kuma self-hosted o BetterStack
16. **CIE-10 completo:** importar dataset Minsalud (~10k códigos vs 10 actuales del seed)
17. **Política privacidad publicada:** página `/legal/privacidad` con el texto legal Habeas Data

### Mediano plazo
18. **FHIR R4 + RDA export** (Colombia interop obligatoria abril 2026)
19. **Tests automatizados** (vitest) sobre lógica crítica: colisión, encriptación, audit
20. **Registro RNBD ante SIC** (obligación legal antes de cobrar a primer cliente)
21. **Onboarding de primer cliente real** (clínica piloto con descuento perpetuo)

---

## 📂 Estructura de carpetas finales

### `CODEX/saas barberias/`
```
.
├── apps/
│   ├── api/                Fastify + Prisma + 14 módulos
│   └── web/                Next.js 14 + 16 pantallas
├── packages/
│   ├── db/                 Prisma schema (15 modelos) + seed
│   └── shared/             Zod + tipos
├── infra/
│   ├── docker-compose.yml             dev local
│   ├── docker-compose.prod.yml        prod (puertos 5434, 6380, 4001, 3001)
│   ├── caddy/barber.caddy             snippet Caddy
│   ├── scripts/
│   │   ├── bootstrap-vps.sh           (NO usar — instala nativo, conflictos)
│   │   ├── deploy-docker.sh           production deploy
│   │   ├── backup.sh                  pg_dump diario
│   │   └── restore.sh
│   └── DEPLOY.md                      guía completa
├── ecosystem.config.js                PM2 (legado, no usado al final)
├── README.md
└── PROYECTOS-CONTEXTO.md              ← este archivo
```

### `CODEX/surco-health/`
```
.
├── apps/
│   ├── api/                Fastify + Prisma + 9 módulos clínicos
│   └── web/                Next.js 14 + 8 pantallas + Odontogram SVG
├── packages/
│   ├── db/                 Prisma schema (28 modelos) + seed multi-vertical
│   ├── shared/             Zod + tipos (auth, patient, appointment, dental,
│   │                       psychology, medical, prescription, consent, file)
│   ├── encryption/         pgcrypto helpers + boot check
│   └── audit/              append-only audit log + queryAudit
├── infra/
│   ├── docker-compose.yml             dev local (Postgres + Redis + MinIO)
│   ├── docker-compose.prod.yml        prod (puertos 5435, 6381, 4002, 3002, 9002, 9003)
│   ├── postgres-init/
│   │   ├── 01-extensions.sql          pgcrypto + pg_trgm
│   │   └── 02-trigger-auditlog.sql    BEFORE UPDATE/DELETE
│   ├── caddy/surco-health.caddy       snippet Caddy
│   ├── scripts/deploy.sh              production deploy idempotente
│   └── DEPLOY.md                      guía completa
├── README.md
└── PROYECTOS-CONTEXTO.md              ← este archivo
```

---

## 🧠 Lecciones aprendidas

1. **Pre-armar todo antes de tocar el VPS.** Cada bug encontrado en producción es 10x más caro que en dev. Generar `pnpm-lock.yaml` y correr `prisma validate` local **siempre** antes del primer push.

2. **Tmux es obligatorio para builds largos.** Cualquier `docker build` > 2 min debe correr dentro de tmux. SSH se cae solo, los builds mueren.

3. **Caddy > Nginx para multi-tenancy.** Auto-HTTPS Let's Encrypt sin tocar certbot, recarga sin downtime, sintaxis 5x más simple.

4. **Aislamiento por prefijo de containers + puertos únicos = sleep tranquilo.** Coexistir 4 proyectos en 1 VPS sin miedo de romperse.

5. **`acceptedPrivacy: z.literal(true)` en Zod = no se puede crear paciente sin aceptación.** Compliance enforced en validation, no como checkbox decorativo.

6. **pgcrypto en pacientes médicos / SOAP = la única forma de poder dormir.** Si filtran la BD, el atacante necesita la `ENCRYPTION_KEY` además. Defensa en profundidad.

7. **Audit log append-only con trigger DB > en aplicación.** Si el código tiene un bug que borra audit, el trigger lo previene de todas formas.

8. **No clonar 1:1 entre proyectos.** Cada vertical tiene requisitos distintos (HCE ≠ ventas, odontograma ≠ POS). Reusar patrones (auth, multi-tenant, plan limits) pero no copiar dominio.

---

## 📝 Convenciones del proyecto

### Naming
- **Tenants/Clínicas:** slug en kebab-case lowercase (`clinica-demo`, `sonrisa-dental`)
- **Containers Docker:** prefijo proyecto + servicio (`saas_barberias_postgres`, `surco_api`)
- **Volúmenes Docker:** mismo patrón (`saas_barberias_pgdata`, `surco_health_pgdata`)
- **Networks Docker:** `{project}_net`
- **Subdominios:** namespace por proyecto (`*.barber.surcoapp.tech`, `*.salud.surcoapp.tech`)

### Branding
- **SaaS Barberías:** color brand `#5b6cff` (azul)
- **Surco Health:** color brand `#3b6bff` (azul más saturado)
- Ambos: Inter font, Tailwind clases utility-first

### Git
- Branch principal: `main`
- Commit messages: español, descriptivos, multilínea con bullets cuando aplica
- Co-author: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Sin push --force a main jamás
- Backups antes de cualquier operación destructiva

### Code style
- TypeScript strict: `true`
- No usar emojis en código de producción (sí en commits y documentación)
- Tabs en archivos `.md`, spaces (2) en código
- Comentarios en español

---

## 🆘 Recovery / troubleshooting general

### "Perdí el contexto" — qué hacer
1. Abrir este archivo `PROYECTOS-CONTEXTO.md` (vive en ambos repos)
2. Pasar a una sesión de Claude Code el contenido de este archivo
3. La sesión arranca con TODO el contexto

### "El VPS no responde"
1. `ping 2.24.89.123` — ¿responde?
2. Si no, ir al panel de Hostinger → VPS → restart
3. Esperar 2 min, reintentar SSH

### "Karpos / Barbería se rompió" tras tocar Surco
1. `docker ps` — ¿están los containers correctos vivos?
2. Si un container está down: `docker compose ... up -d <servicio>` en SU carpeta (ej. `/opt/saas-barberias/`)
3. Surco Health NO afecta otros — pero si quieres rollback total: `cd /opt/surco-health && docker compose -f infra/docker-compose.prod.yml --env-file .env down`

### "Caddy no enruta bien"
1. `sudo nginx -t` → ya, perdón, **`sudo caddy validate --config /etc/caddy/Caddyfile`**
2. Si OK: `sudo systemctl reload caddy`
3. Si falla: `sudo cp /etc/caddy/Caddyfile.bak.XXXX /etc/caddy/Caddyfile && sudo systemctl reload caddy`
4. Ver logs: `sudo journalctl -u caddy -f`

### "Olvidé la ENCRYPTION_KEY de Surco"
- Si encriptaste datos clínicos con ella → **están perdidos** (irrecuperables)
- Si NO has cargado datos reales → cambiarla y `pnpm db:push --force-reset`

---

## 📚 Recursos clave consultados

- [Saludtools – precios y planes Colombia](https://www.saludtools.com/precios)
- [Saludtools – interoperabilidad obligatoria abril 2026](https://www.saludtools.com/interoperabilidad-historia-clinica)
- [Minsalud Resolución 866/2021](https://www.minsalud.gov.co/Normatividad_Nuevo/Resoluci%C3%B3n%20No.%20866%20de%202021.pdf)
- [Resolución 1995/1999](https://www.minsalud.gov.co/Normatividad_Nuevo/RESOLUCI%C3%93N%201995%20DE%201999.pdf)
- [Vulcano IHC Col – RDA Colombia](https://vulcano.ihcecol.gov.co/)
- [Cluster311/cie10 – dataset CIE-10 LATAM](https://github.com/cluster311/cie10)
- [biomathcode/react-odontogram – referencia odontograma SVG](https://github.com/biomathcode/react-odontogram)
- [Doctoralia Pro – precios Colombia](https://pro.doctoralia.co/precios/para-especialistas)
- [Healthatom (Dentalink + Medilink)](https://www.healthatom.com/)
- [Daily.co – teleconsulta para SaaS médico](https://www.daily.co/)
- [Hostinger VPS docs](https://www.hostinger.com/tutorials/vps)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)

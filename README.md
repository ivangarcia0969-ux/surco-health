# Surco Health

SaaS multi-tenant para consultorios médicos, odontológicos, psicológicos y de salud en LATAM.

## ¿Qué resuelve?

| Vertical | Pain point | Solución |
|---|---|---|
| Odontología | Plan de tratamiento por pieza, radiografías, presupuestos | Odontograma digital + plan + archivos rx + plan de pagos |
| Psicología | Notas confidenciales, tests, seguimiento entre sesiones | Notas SOAP encriptadas, tests psicométricos auto-calculados, teleconsulta |
| Médico general | HCE estructurada, CIE-10, prescripciones | Anamnesis + signos vitales + diagnóstico CIE-10 + orden a MIPRES |
| Pediatría | Curvas de crecimiento, calendario vacunal | Curvas OMS automáticas + esquema PAI Colombia |
| Estética | Fotos antes/después, consentimientos | Galería paciente + consentimientos con firma electrónica |

## Compliance built-in

| Norma | Cómo cumplimos |
|---|---|
| **Habeas Data (Ley 1581/2012)** Colombia | Política de privacidad, autorización expresa, registro RNBD documentado |
| **Resolución 1995/1999** Colombia | HCE estructurada, append-only, retención 15 años |
| **Resolución 866/2021** Colombia | Endpoint FHIR R4 + RDA v0.8.1 exportable |
| **Ley 527/1999** firma electrónica | Firma simple (canvas + timestamp + IP) integrada |
| **NOM-024-SSA3-2012** México | Estructura HCE preparada para certificación |
| **HIPAA technical safeguards** | Encriptación at-rest (pgcrypto AES-256), TLS 1.2+, audit log append-only, MFA opcional |

## Stack

- **Backend:** Node 20 + Fastify + Prisma + PostgreSQL 16 + pgcrypto
- **Frontend:** Next.js 14 (App Router) + Tailwind + PWA
- **Cola:** BullMQ + Redis
- **Storage:** MinIO (S3-compatible self-hosted)
- **Tele:** Daily.co SDK
- **Pagos suscripción:** Stripe + Wompi (Colombia)
- **Facturación electrónica:** DIAN vía proveedor (Facture/Alegra/Siigo)
- **Infra:** Docker Compose + Caddy + auto-HTTPS

## Estructura

```
apps/
  api/           Backend Fastify
  web/           Frontend Next.js PWA
  worker/        Worker BullMQ (recordatorios, exports, sync FHIR)
packages/
  db/            Prisma schema (multi-vertical) + cliente
  shared/        Tipos + Zod schemas compartidos
  clinical/      Lógica de dominio clínico (odontograma, vital signs, tests, curvas OMS)
  encryption/    Helpers pgcrypto + KMS interface
  audit/         Audit log append-only
  fhir/          Adaptadores FHIR R4 + RDA Colombia
infra/
  docker-compose.yml    Postgres + Redis + MinIO local
  docker-compose.prod.yml
  caddy/                Snippets Caddyfile
  scripts/              bootstrap, deploy, backup
```

## Roles

| Rol | Acceso |
|---|---|
| **SaaS Admin** | Superadmin de la plataforma (gestión de clínicas, planes, soporte) |
| **Clinic Owner** | Dueño de la clínica/consultorio (gestión completa de su tenant) |
| **Professional** | Médico/odontólogo/psicólogo (su agenda, sus pacientes, HCE de los que atiende) |
| **Receptionist** | Recepción (agenda, contacto, no ve notas clínicas) |
| **Billing** | Facturación (no ve HCE clínica) |

## Planes

| Plan | Precio (USD/profesional/mes) | Características |
|---|---|---|
| **Free** | 0 (hasta 30 citas/mes, 1 profesional) | Agenda + HCE básica + WhatsApp 50/mes |
| **Pro** | 25-30 | + teleconsulta + FEV DIAN + storage 5 GB + recordatorios ilimitados |
| **Clínica** | 45-55 | + multi-sede + reportes + API + storage 50 GB + soporte prioritario |
| **Enterprise** | Negociado | SLA, BAA/DPA, dominio propio, soporte 24/7 |

## Desarrollo local

### Pre-requisitos
- Node 20+
- pnpm 9+
- Docker + Docker Compose

### Setup

```bash
pnpm install
pnpm infra:up           # postgres + redis + minio
cp .env.example .env
# Genera secretos:
openssl rand -base64 64    # JWT_SECRET y JWT_REFRESH_SECRET (2 distintos)
openssl rand -hex 32       # ENCRYPTION_KEY

pnpm db:push            # primer schema (sin migrations todavía)
pnpm db:seed            # planes + tenant demo + datos
pnpm dev                # api en :4000, web en :3000, worker embebido
```

Credenciales del seed:
- **SaaS Admin:** `admin@surcohealth.local` / `admin123`
- **Owner clínica demo:** `owner@clinicademo.local` / `owner123`
- **Profesional:** `dr.garcia@clinicademo.local` / `doctor123`
- **Recepción:** `recep@clinicademo.local` / `recep123`

## Status del proyecto

- [x] Bootstrap monorepo
- [ ] Schema Prisma multi-vertical
- [ ] Auth + tenants + users + audit log
- [ ] Patients + HCE base
- [ ] Appointments + agenda
- [ ] Módulo dental (odontograma)
- [ ] Módulo psicología (SOAP + tests)
- [ ] Módulo médico general (vitales + CIE-10)
- [ ] Teleconsulta Daily.co
- [ ] FHIR export
- [ ] Stripe + Wompi billing
- [ ] Frontend Next.js completo
- [ ] Deploy a VPS

Roadmap detallado en [`docs/ROADMAP.md`](./docs/ROADMAP.md).

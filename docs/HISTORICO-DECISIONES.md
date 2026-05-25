# 🧭 Histórico de decisiones de arquitectura

> Bitácora de cada decisión técnica y de producto, con su razón y alternativas consideradas. Útil para entender "por qué hicimos X y no Y" cuando volvamos meses después.
>
> **Formato:** Architecture Decision Records (ADR) simplificado.

---

## ADR-001: Monorepo con Turborepo + pnpm workspaces

**Fecha:** 2026-05-23 (Barbería) / 2026-05-25 (Surco Health)
**Status:** ✅ Aceptado

### Contexto
Necesitamos compartir tipos (especialmente schemas Zod y enums de Prisma) entre backend y frontend sin publicar paquetes npm.

### Decisión
Monorepo con `pnpm workspaces` + `Turborepo` para orquestar builds.

### Alternativas consideradas
- Nx — más complejo, más opinionado
- Yarn workspaces — más viejo, peor performance
- Repos separados con copia manual — propenso a drift de tipos

### Consecuencias
- ✅ Cambiar un campo Prisma propaga tipos automáticamente al frontend
- ✅ Turbo cache acelera builds (hasta 10x en CI)
- ⚠️ pnpm tiene quirks con Docker (layers de cache + symlinks) — resuelto con multi-stage Dockerfile

---

## ADR-002: PostgreSQL como única DB (no Mongo, no DynamoDB)

**Fecha:** 2026-05-23 / 2026-05-25
**Status:** ✅ Aceptado

### Contexto
Multi-tenant SaaS con relaciones complejas (tenant → users → patients → clinical records → procedures...).

### Decisión
PostgreSQL 16 para todo. Para campos free-text grandes usamos `tsvector` y/o `Json`.

### Alternativas consideradas
- Mongo para HCE notas SOAP — descartado: fragmenta arquitectura, no aporta valor real, no soporta TX cross-collection limpias
- DynamoDB — descartado: vendor lock-in, peor para queries ad-hoc
- SQLite para dev / Postgres para prod — descartado: divergencia de comportamiento (JSONB, pgcrypto, etc.)

### Consecuencias
- ✅ Una sola DB, una sola fuente de verdad, TX cross-table fáciles
- ✅ pgcrypto integrado para encriptación at-rest (Surco Health)
- ✅ pg_trgm para autocompletar CIE-10
- ⚠️ Encriptación de búsqueda full-text en columnas cifradas no funciona — aceptado (notas SOAP no se buscan por texto)

---

## ADR-003: Fastify > Express

**Fecha:** 2026-05-23
**Status:** ✅ Aceptado

### Decisión
Fastify como framework HTTP del backend.

### Razón
- 2-3x más rápido que Express en throughput
- Validación con schemas nativa (no necesita middleware adicional)
- Plugin system limpio, async/await first-class
- TypeScript types muy bien mantenidos

### Consecuencias
- ✅ Performance medible (puede manejar más req/s con menos RAM)
- ⚠️ Ecosistema más pequeño que Express — pero los plugins core (`@fastify/cors`, `helmet`, `rate-limit`, etc.) cubren el 95%

---

## ADR-004: Caddy > Nginx en producción

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
El usuario ya tenía Caddy corriendo en el VPS para Karpos. No queríamos romper su setup instalando Nginx en paralelo.

### Decisión
Usar Caddy para los 2 SaaS (Barbería + Surco Health). Añadir solo bloques nuevos al `/etc/caddy/Caddyfile` existente.

### Razón
- HTTPS automático con Let's Encrypt (sin certbot manual)
- Reload sin downtime
- Sintaxis 5x más simple que Nginx
- Ya está corriendo (no instalar otro proxy)

### Alternativas consideradas
- Nginx + certbot — descartado: tendríamos que reinstalar y migrar lo de Karpos
- Traefik — descartado: bueno pero curva de aprendizaje extra para algo que Caddy ya hace bien

### Consecuencias
- ✅ HTTPS automático y renovado para todos los subdominios
- ✅ Karpos sigue funcionando sin cambios
- ⚠️ Wildcard cert requiere DNS-01 challenge (no implementado todavía — usamos certs por subdominio específico)

---

## ADR-005: Tenancy por subdominio en namespace (`*.barber`, `*.salud`)

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
El usuario ya usaba `*.karpos.surcoapp.tech` para otra app. Para evitar mezclar marcas y permitir crecimiento, decidimos namespacing.

### Decisión
Cada SaaS tiene su namespace:
- Barbería: `*.barber.surcoapp.tech` → `app.barber`, `api.barber`, `tenant-x.barber`
- Surco Health: `*.salud.surcoapp.tech` → `app.salud`, `api.salud`, `clinica-x.salud`

### Alternativas consideradas
- Top-level `app.surcoapp.tech` para uno y namespace para los demás — descartado: inconsistente
- Dominios separados por SaaS — descartado: el usuario quiere todo bajo `surcoapp.tech`

### Consecuencias
- ✅ Aislamiento de marca clarísimo
- ✅ Wildcard DNS necesario por namespace (no global), pero suficiente para escalar
- ⚠️ SSL wildcard requiere DNS-01 — postponed al V2 (path-based tenants en `/reservar/{slug}` mientras tanto)

---

## ADR-006: pgcrypto para encriptación at-rest (Surco Health)

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
HCE incluye notas SOAP psicológicas, antecedentes médicos, tests psicométricos. Compliance LATAM exige protección. Si se filtra la BD, el atacante NO debe poder leer.

### Decisión
- Postgres `pgcrypto` extension activa
- Campos sensibles tipo `Bytes` (bytea) en lugar de `String`
- Encriptación con `pgp_sym_encrypt(text, ${ENCRYPTION_KEY})` desde el helper `@surco/encryption`

### Alternativas consideradas
- Encriptar en aplicación con AES — descartado: clave en runtime, audit más débil, performance peor
- Database-level encryption (TDE) — descartado: protege contra robo del disco, no contra acceso SQL
- KMS de AWS/GCP — descartado: vendor lock-in, sobreingeniería para MVP

### Consecuencias
- ✅ Atacante con dump de Postgres no lee notas SOAP
- ✅ Clave NO está en la DB (vive en env var)
- ⚠️ Si pierdes la `ENCRYPTION_KEY`, los datos están perdidos para siempre
- ⚠️ No se puede buscar full-text en columnas encriptadas (aceptado para SOAP)

### Migración futura
V2: clave por tenant + rotación con AWS KMS.

---

## ADR-007: AuditLog append-only via trigger Postgres

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
Compliance Habeas Data + Res 1995/1999 exige logs de quién accedió a qué HCE. Si la aplicación tiene un bug que borra logs, el compliance falla.

### Decisión
Trigger Postgres `BEFORE UPDATE OR DELETE ON "AuditLog"` que lanza excepción.

```sql
CREATE TRIGGER prevent_audit_log_mutation
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
```

### Alternativas
- Solo controlar en aplicación — descartado: bug en código rompe compliance
- Append-only file system — descartado: complicado, no integra con SQL

### Consecuencias
- ✅ Inmutabilidad garantizada por DB
- ⚠️ Si necesitamos "borrar" un log (caso legal extremo), hay que `DROP TRIGGER` temporalmente — pero esa acción QUEDA en logs de Postgres

---

## ADR-008: HCE append-only via amendments (no UPDATE)

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
Una HCE NO se edita por compliance (Res 1995/1999). Si el médico se equivoca, debe crear una "adenda" que apunte al original.

### Decisión
Schema con `ClinicalRecord.previousRecordId` (auto-referencial). Endpoint `POST /api/clinical/amendments` crea registro nuevo con `type: 'AMENDMENT'`. **No existe endpoint PATCH de ClinicalRecord.**

### Consecuencias
- ✅ Trazabilidad completa: cualquier persona ve el registro original Y todas las adendas
- ✅ El profesional firma cada cambio (signatureHash)
- ⚠️ La UI debe mostrar la cadena de versiones — pendiente en frontend

---

## ADR-009: `acceptedPrivacy` literal(true) en Zod, no boolean

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
Habeas Data (Ley 1581/2012 Colombia) exige consentimiento expreso. Un checkbox decorativo que solo se valida en frontend no sirve.

### Decisión
En `packages/shared/src/schemas/auth.ts` y `patient.ts`:
```ts
acceptedPrivacyPolicy: z.literal(true, {
  errorMap: () => ({ message: 'Debes aceptar la política de privacidad' }),
}),
```

Si llega `false` o `undefined`, **el servidor rechaza el request con 400**.

### Consecuencias
- ✅ Imposible crear tenant o paciente sin aceptación
- ✅ La fecha y versión de política quedan registradas (`privacyAcceptedAt`, `privacyVersion`)
- ⚠️ Hace pruebas y onboarding manual más estrictos — aceptado por compliance

---

## ADR-010: MIPRES como link externo, NO emular

**Fecha:** 2026-05-25 (research)
**Status:** ✅ Aceptado

### Contexto
En Colombia, toda receta No-PBS DEBE generarse en la plataforma MIPRES v2.4 del Minsalud (Circular 044/2025). Vender "receta electrónica que reemplaza MIPRES" es ilegal.

### Decisión
- El campo `Prescription.isMipres` marca si la receta corresponde a No-PBS
- Si `isMipres = true`, el frontend muestra un botón "Abrir en MIPRES" que lanza la plataforma del Minsalud
- Guardamos el `mipresOrderId` después de que el médico la prescribe allá

### Consecuencias
- ✅ Compliance legal estricto
- ✅ El médico no duplica trabajo (datos prellenados en el link)
- ⚠️ UX no es 100% in-app — aceptado, no hay alternativa legal

---

## ADR-011: Daily.co para teleconsulta (no Twilio, no Jitsi MVP)

**Fecha:** 2026-05-25 (planificado, no implementado aún)
**Status:** ⏳ Planificado

### Decisión
Daily.co SDK para MVP. Razón: HIPAA-ready plan disponible, USD 0.004/min (más barato que Twilio Video), API JS sencilla.

### Alternativas
- **Twilio Video:** ~USD 0.004/min participante, pero +costo de grabación, +complejidad
- **Jitsi Meet self-hosted:** gratis pero 40-50% más costo de infra + responsabilidad de seguridad
- **Zoom SDK:** caro, más enfocado a corporate

### Decisión futura
Al escalar (>10k min/mes), evaluar migración a Jitsi self-hosted.

---

## ADR-012: Multi-vertical desde día 1 en Surco Health

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
Decisión del usuario: arrancar el SaaS soportando dental + médico + psicología + pediatría + estética en paralelo, no uno a la vez.

### Decisión
Schema único con `Specialty` enum y perfiles clínicos opcionales por paciente (`DentalChart?`, `MedicalProfile?`, `PsychologyProfile?`, `PediatricProfile?`). Cada profesional tiene su `specialty` y ve solo el catálogo / pantallas relevantes.

### Razón
El research mostró que el 80% de funcionalidad es común; solo el 20% específico (odontograma, SOAP, vital signs). Construir un kernel multi-especialidad fue ~30% más trabajo que un vertical único, pero abre 5x el TAM.

### Consecuencias
- ✅ Pricing por profesional, sin diferenciar especialidad
- ✅ Clínicas multi-disciplinarias soportadas nativamente
- ⚠️ Onboarding del owner debe elegir especialidad principal (afecta el dashboard default)

---

## ADR-013: Roles ampliados a 5 en Surco Health (vs 3 en Barbería)

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Decisión
Roles:
- `SAAS_ADMIN`: nosotros (superadmin de la plataforma)
- `CLINIC_OWNER`: dueño de la clínica
- `PROFESSIONAL`: médico/odontólogo/psicólogo — solo ve SUS pacientes y SU agenda
- `RECEPTIONIST`: agenda + pacientes administrativos, **sin acceso a contenido clínico**
- `BILLING`: facturación, sin acceso clínico

### Razón
En una clínica real, recepción y facturación son personas distintas que NO deben ver el contenido de la HCE. Separación de roles es estándar HIPAA-like.

### Consecuencias
- ✅ Cumple separation of duties
- ⚠️ Plan FREE permite solo 1 usuario → owner. Plan PRO permite 5 profesionales + staff ilimitado.

---

## ADR-014: Notación FDI para odontograma (no Universal, no Palmer)

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Decisión
Sistema FDI (ISO 3950: 11-18, 21-28, 31-38, 41-48) como default. UI permite cambiar a Universal o Palmer en V2.

### Razón
- FDI es el estándar LATAM y europeo
- Universal es US-only
- Palmer está deprecado

### Consecuencias
- ✅ Odontólogos LATAM lo reconocen sin manual
- ⚠️ Si entramos a US, necesitamos Universal — el schema ya soporta `numbering: FDI | UNIVERSAL | PALMER`

---

## ADR-015: Stripe + Wompi (Colombia local) para pagos

**Fecha:** 2026-05-25 (planificado)
**Status:** ⏳ Planificado

### Decisión
Doble pasarela:
- **Stripe** para pagos internacionales (tarjetas Visa/MC, PayPal vía Stripe)
- **Wompi** para Colombia local (PSE, Nequi, Daviplata)

### Razón
Muchos consultorios colombianos NO tienen tarjeta de crédito internacional. Wompi cubre el método de pago dominante en el país.

### Consecuencias
- ✅ TAM más amplio en Colombia
- ⚠️ Doble integración (webhooks separados, etc.)

---

## ADR-016: ENCRYPTION_KEY como env var, no en código ni en BD

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Decisión
- Vive en `.env` con permisos `chmod 600`
- Inyectada al container Docker vía `docker compose --env-file`
- Verificada al boot con `verifyEncryptionSetup()` — falla rápido si está mal configurada

### Razón
- Si la clave estuviera en la BD, atacante con SQL access puede desencriptar todo
- Si estuviera en código, está en GitHub
- Variable de entorno es estándar y compatible con Vault/AWS Secrets para V2

### Consecuencias
- ✅ Cumple defense-in-depth
- ⚠️ Si la pierdes, datos clínicos cifrados son irrecuperables (documentado en DEPLOY.md)

---

## ADR-017: Docker Compose en lugar de Kubernetes

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
Solo tenemos 1 VPS. K8s sería sobreingeniería absoluta.

### Decisión
`docker compose up -d` para todo, gestionado por scripts bash.

### Consecuencias
- ✅ 95% más simple de operar
- ⚠️ No auto-scaling, no rolling updates sin downtime — aceptado para MVP

### Plan futuro
A 100+ tenants y > 1 VPS, considerar K3s o Docker Swarm.

---

## ADR-018: TypeScript strict, sin `any` en lógica de dominio

**Fecha:** 2026-05-23
**Status:** ✅ Aceptado

### Decisión
`tsconfig.base.json` con `strict: true`, `noImplicitAny: true`.

### Consecuencias
- ✅ Refactor sin miedo
- ⚠️ Algunos `as any` en boundaries con Prisma Decimal / Buffer — aceptados con comentario

---

## ADR-019: No PM2 en producción, usar Docker restart policies

**Fecha:** 2026-05-25
**Status:** ✅ Aceptado

### Contexto
Inicialmente planeé usar PM2 + Nginx + Postgres nativo. Al ver el VPS del usuario que ya usaba Docker + Caddy, pivoté.

### Decisión
- `restart: unless-stopped` en docker-compose
- Logs vía `docker logs` (no `/var/log/saas/`)
- Healthchecks nativos de docker compose

### Consecuencias
- ✅ Una sola herramienta de orquestación
- ✅ Reusa el ecosistema Docker que el usuario ya conoce
- ❌ `ecosystem.config.js` quedó como artifact en el repo Barbería (no usado) — podría borrarse en cleanup

---

## ADR-020: Documentar todo en `PROYECTOS-CONTEXTO.md`

**Fecha:** 2026-05-25 (esta sesión)
**Status:** ✅ Aceptado

### Contexto
Sesiones de Claude tienen contexto limitado. Si pasan semanas, perdemos hilos.

### Decisión
- `PROYECTOS-CONTEXTO.md` en raíz de ambos repos (vive con el código en Git)
- `docs/HISTORICO-DECISIONES.md` (este archivo) con cada ADR
- Skill de Claude Code que apunta a estos archivos

### Consecuencias
- ✅ Cualquier futuro Claude que abra estos repos arranca con todo el contexto
- ✅ Aprendizajes no se pierden
- ⚠️ Hay que mantener el archivo actualizado tras cambios mayores — disciplina del usuario + Claude

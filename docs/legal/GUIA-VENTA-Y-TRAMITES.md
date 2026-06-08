# 🚀 Guía para vender YA sin pleitos legales

> Tu situación: **persona natural con RUT · cobro con Wompi · venta asistida
> (concierge)**. Esta guía es tu checklist para cerrar tu primer cliente que paga,
> de forma legal y sin riesgo.

---

## ⚡ Resumen: el camino más rápido a tu primer peso

```
1. Trámites base (1 vez)        →  RUT actualizado + cuenta Wompi + contratos
2. Por cada cliente nuevo        →  Demo → Contrato firmado → Cobro Wompi → Activar
3. Mensual                       →  Cuenta de cobro + renovación
```

Puedes cerrar tu **primer cliente esta semana** si haces los trámites base ya.

---

## 1️⃣ Trámites base (haz esto UNA vez, antes del primer cliente)

### A. RUT como prestador de servicios
- [ ] Verifica que tu **RUT** tenga la actividad económica de servicios de software
      / informática (código CIIU **6201** "Desarrollo de sistemas informáticos" o
      **6202** "Consultoría informática").
- [ ] Si estás bajo el umbral de ingresos, eres **NO responsable de IVA** (antes
      "régimen simplificado"). Confirma con un **contador** — 1 consulta basta.
- [ ] Como persona natural puedes cobrar con **cuenta de cobro** (no necesitas
      facturador electrónico todavía si estás bajo el umbral). Pregunta a tu
      contador si ya debes facturar electrónicamente.

### B. Cuenta Wompi (para recibir pagos)
- [ ] Crea cuenta en **wompi.co** (es de Bancolombia, sirve para persona natural).
- [ ] Verifica tu identidad y vincula tu cuenta bancaria/Nequi.
- [ ] Para venta concierge **no necesitas integrar la API todavía**: usa
      **"Links de pago"** desde el panel de Wompi. Generas un link, se lo mandas al
      cliente por WhatsApp, paga, y tú lo activas. Cero código.

### C. Documentos legales (ya creados — solo personalízalos)
- [ ] `docs/legal/CONTRATO-SERVICIO-SAAS.md` — reemplaza los `[CORCHETES]`.
- [ ] `docs/legal/ANEXO-A-TRATAMIENTO-DATOS-DPA.md` — reemplaza los `[CORCHETES]`.
- [ ] **Hazlos revisar por un abogado** (1-2 horas de su tiempo). Es la mejor
      inversión anti-pleitos que puedes hacer.
- [ ] Convierte el contrato a PDF y úsalo con firma digital (puedes usar
      herramientas gratuitas como firma en PDF, o un servicio como
      Docusign/SignNow para que el cliente firme desde el celular).

### D. Política de privacidad publicada
- [x] Ya está en `https://app.salud.surcoapp.tech/legal/privacidad` y
      `https://app.barber.surcoapp.tech/legal/privacidad` ✅

---

## 2️⃣ Por cada cliente nuevo (el flujo de venta concierge)

```
┌─ DEMO ──────────────────────────────────────────────┐
│ Muestra la app con datos demo. Login owner@...       │
│ Enfatiza: agenda, HCE/odontograma, recordatorios.    │
└──────────────────────────────────────────────────────┘
                      ↓
┌─ PROPUESTA ─────────────────────────────────────────┐
│ Envía precio del plan (ver página /precios).         │
│ Define: # profesionales, plan, mensual o anual.      │
└──────────────────────────────────────────────────────┘
                      ↓
┌─ CONTRATO ──────────────────────────────────────────┐
│ Cliente firma Contrato + Anexo DPA.                  │
│ ⚠️ SIN CONTRATO FIRMADO NO ACTIVES NADA.             │
└──────────────────────────────────────────────────────┘
                      ↓
┌─ COBRO ─────────────────────────────────────────────┐
│ Genera link de pago Wompi por el primer mes/año.     │
│ Cliente paga. Verificas que llegó.                   │
└──────────────────────────────────────────────────────┘
                      ↓
┌─ ACTIVACIÓN ────────────────────────────────────────┐
│ Creas el tenant + usuario owner del cliente y le     │
│ asignas el plan pago (ver sección 3).                │
│ Envías credenciales por canal seguro.                │
└──────────────────────────────────────────────────────┘
                      ↓
┌─ ONBOARDING ────────────────────────────────────────┐
│ Sesión de 30-60 min: cargar profesionales, servicios,│
│ primeros pacientes/clientes. Resuelve dudas.         │
└──────────────────────────────────────────────────────┘
```

### Checklist por cliente
- [ ] Demo realizada
- [ ] Contrato + Anexo DPA **firmados** (guardados en PDF)
- [ ] Pago recibido (Wompi)
- [ ] Cuenta de cobro emitida al cliente
- [ ] Tenant activado con plan pago + fecha de expiración
- [ ] Credenciales entregadas
- [ ] Onboarding agendado

---

## 3️⃣ Cómo activar un cliente que pagó (técnico)

Ver el endpoint de administración:
- **Surco Health:** `POST /api/admin/tenants` (crear) + `POST /api/admin/tenants/:id/plan`
  (asignar plan pago + fecha de expiración). Requiere rol `SAAS_ADMIN`
  (`admin@surcohealth.local`).
- **Barbería:** módulo `admin` ya existente — gestión de tenants desde el panel.

> Detalle de comandos exactos en `docs/RUNBOOK-ACTIVAR-CLIENTE.md`.

---

## 4️⃣ Mensual (mantener el ingreso)

- [ ] **Día de corte:** genera cuenta de cobro y link de pago Wompi.
- [ ] Si paga → extiende `planExpiresAt` un mes más.
- [ ] Si no paga en 30 días → el sistema bloquea acceso automáticamente
      (`TENANT_SUBSCRIPTION_EXPIRED`). No tienes que hacer nada manual.
- [ ] Lleva un registro simple (Excel/Notion): cliente, plan, valor, fecha de pago,
      próxima renovación.

---

## ⚖️ Las 5 reglas de oro anti-pleitos

1. **Nunca actives un cliente sin contrato + Anexo DPA firmados.** Es tu escudo.
2. **Nunca prometas algo que la app no hace.** El landing ya está depurado; no
   agregues promesas verbales que no puedas cumplir.
3. **Tú eres ENCARGADO, no RESPONSABLE.** La clínica/barbería obtiene el Habeas
   Data de sus pacientes/clientes. Repítelo en cada venta.
4. **Guarda todo:** contratos firmados, comprobantes de pago, cuentas de cobro.
5. **Reporta incidentes en 48h.** Si hay una fuga, avisa al cliente por escrito
   dentro de 48 horas. Está en el contrato y te protege.

---

## 🎯 Qué falta para escalar (cuando ya tengas 5-10 clientes)

| Cuándo | Qué |
|---|---|
| 5+ clientes | Migrar de persona natural a **SAS** (limita tu responsabilidad personal) |
| 10+ clientes | Integrar **Wompi API** para cobro automático (self-service) |
| Primer cliente que paga | **Registrar BD ante RNBD/SIC** (la clínica como responsable; tú apóyala) |
| Ingresos > umbral | **Facturación electrónica DIAN** obligatoria |
| Datos crecen | Activar **backups externos** (ya está el script, falta configurar rclone a B2/S3) |

---

## 📌 Importante sobre el RNBD (Registro Nacional de Bases de Datos)

- El **RESPONSABLE** (la clínica/barbería) es quien debe registrar su base ante la
  SIC, no tú como Encargado.
- **Tú (Surco/Barbería SaaS)** como Encargado NO registras las bases de tus clientes.
- Pero si tú mismo manejas una base de datos propia (ej. tus leads/clientes del
  SaaS) por encima de los umbrales, esa sí la registrarías tú.
- Aclara esto en cada venta para que el cliente sepa que es SU obligación.

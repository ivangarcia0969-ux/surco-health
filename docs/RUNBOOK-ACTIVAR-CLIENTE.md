# 🔧 Runbook — Activar un cliente que pagó (Surco Health)

> Venta concierge: pasos técnicos para dar de alta a un cliente DESPUÉS de que
> firmó contrato y pagó por Wompi.

## Opción A — El cliente se registra solo, tú lo activas (recomendado)

1. **El cliente se registra** en https://app.salud.surcoapp.tech/register
   (queda en plan FREE con 14 días de trial).

2. **Tú obtienes un token de SAAS_ADMIN**:
   ```bash
   curl -s -X POST https://api.salud.surcoapp.tech/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@surcohealth.local","password":"TU_PASSWORD_ADMIN"}' \
     | jq -r .accessToken
   ```

3. **Listas los tenants** para encontrar el `id` del cliente:
   ```bash
   TOKEN="<pega_el_accessToken>"
   curl -s https://api.salud.surcoapp.tech/api/admin/tenants \
     -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, tradeName, estado, slug}'
   ```

4. **Activas el plan pago** (ej. plan CLINICA por 1 mes):
   ```bash
   curl -s -X POST https://api.salud.surcoapp.tech/api/admin/tenants/<TENANT_ID>/plan \
     -H "Authorization: Bearer $TOKEN" \
     -H 'Content-Type: application/json' \
     -d '{"tier":"CLINICA","months":1}' | jq
   # → { ok: true, tenant: "...", plan: "Clínica", expiraEl: "2026-07-03..." }
   ```

   Para pago anual: `{"tier":"CLINICA","months":12}`.

5. Listo. El cliente ya tiene acceso pago. Cuando expire, el sistema bloquea
   automáticamente (`TENANT_SUBSCRIPTION_EXPIRED`).

## Renovación mensual

Cuando el cliente paga el siguiente mes, repite el paso 4. La fecha se extiende
**desde la expiración vigente** (no pierde días).

## Suspender (falta de pago / a pedido)

```bash
curl -s -X POST https://api.salud.surcoapp.tech/api/admin/tenants/<ID>/suspend \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"reason":"mora 45 días"}'
```

Reactivar:
```bash
curl -s -X POST https://api.salud.surcoapp.tech/api/admin/tenants/<ID>/reactivate \
  -H "Authorization: Bearer $TOKEN"
```

## Estados posibles de un tenant
| Estado | Significado |
|---|---|
| `TRIAL` | En periodo de prueba (14 días) |
| `TRIAL_VENCIDO` | Trial terminó, no ha pagado |
| `PAGO_ACTIVO` | Plan pago vigente ✅ |
| `EXPIRADO` | Plan pago venció, hay que renovar |
| `SUSPENDIDO` | Suspendido manualmente |
| `SIN_PLAN` | Sin trial ni plan (raro) |

> **Barbería:** usa el módulo `admin` existente (panel web) o endpoints equivalentes.

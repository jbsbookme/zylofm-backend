# Zylo Payments Guide (Prep Work)

## Objetivo
Preparar integración real (Stripe / Apple / Google) sin activarla aún.

## Arquitectura recomendada
- Backend Edge valida webhooks y actualiza `userplan:{userId}`.
- App inicia flujo de compra y recibe intent/URL.
- Provider maneja cobro, backend procesa evento.

## Flujo de suscripción (alto nivel)
1) createSubscription
2) updateSubscription (renovaciones/cambios)
3) cancelSubscription
4) Webhook: verificación de firma + idempotencia

## Webhooks reales
- Verificar firma con secreto por proveedor
- Guardar `event_id` para idempotencia
- Reintentos seguros (procesamiento idempotente)

## Mapeo de planes ↔ SKUs
- `free` → `zylo_free`
- `dj_pro` → `zylo_dj_pro`
- `admin` → `zylo_admin`

## Cambios mínimos futuros
Backend:
- Implementar create/update/cancel reales
- Validación de firma por proveedor
- Actualizar `userplan` con status/expiración

App:
- UI de compra/upgrade
- Manejo de estados: trialing/active/past_due/canceled/expired
- Mensajes claros de límites

## Estados canónicos
- trialing → active | past_due | canceled | expired
- active → past_due | canceled | expired
- past_due → active | canceled | expired
- canceled/expired → terminal

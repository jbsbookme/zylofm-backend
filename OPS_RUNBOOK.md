# Zylo Ops Runbook (Documento vivo)

## 1) Operación diaria (qué revisar)

- Errores por endpoint: `metrics:errors:*` (KV)
- Rate limit hits: `metrics:ratelimit:*`
- Eventos críticos: login, upload, publish
- Latencia percibida (p95 si aplica)
- Estado de uploads (Cloudinary) y asociación a mixes

Checklist diario:
- [ ] 401/403 anómalos
- [ ] 429 > 2% del tráfico
- [ ] Uploads fallidos > 5%
- [ ] Mezclas publicadas vs creadas

## 2) Checklist de deploy

- [ ] Variables de entorno en prod (JWT_SECRET, KV_REST_API_URL/TOKEN, CLOUDINARY_*)
- [ ] FEATURE_UPLOADS=true si aplica
- [ ] FEATURE_LOGS según necesidad
- [ ] BILLING_WEBHOOK_SECRET configurado (si se usa)
- [ ] Verificar `/api/health`
- [ ] Smoke test: login, refresh, create mix, upload, publish

## 3) Manejo de incidentes

### 401 / 403 altos
- Revisar expiración de tokens
- Validar JWT_SECRET correcto
- Verificar clocks y expiraciones
- Confirmar RBAC/plan en KV

### 429 altos
- Confirmar rate limit y tráfico anómalo
- Ajustar límites por endpoint si es necesario
- Activar mitigación (WAF si aplica)

### Uploads fallidos
- Revisar Cloudinary status y credenciales
- Validar `signature` y `version` en `/uploads/complete`
- Confirmar tamaño y formato permitidos

## 4) Rollback con feature flags

- FEATURE_UPLOADS=false para detener uploads
- FEATURE_LOGS=true para aumentar visibilidad

## 5) Rotación de secretos

- JWT_SECRET, KV tokens, Cloudinary keys, webhook secret
- Ventana recomendada: 60–90 días
- Rotar en ventanas de baja carga

## 6) Backups y recuperación

- KV: export lógico diario (script de métricas)
- Cloudinary: backup/retención en proveedor
- Recuperación: restaurar `userplan`, mixes, uploads metadata

## 7) Picos de tráfico

- Verificar 429 y latencia
- Priorizar endpoints críticos (auth, uploads)
- Incrementar límites temporalmente si es seguro
- Activar mitigaciones de red si aplica

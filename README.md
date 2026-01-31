# Zylo Backend (Edge Functions)

Backend serverless para Zylo usando Vercel Edge Functions.

## Requisitos

- Vercel KV
- Cloudinary (uploads de audio)
- Variables de entorno

## Variables de entorno

- JWT_SECRET
- KV_REST_API_URL
- KV_REST_API_TOKEN
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET
- FEATURE_UPLOADS=true|false (soft launch)
- FEATURE_LOGS=true|false (logs mínimos)

## Auth (JWT + refresh rotation)

- Access token: `Bearer` en `Authorization`.
- Refresh token: cookie `refresh_token`.
- Rotación: refresh tokens de un solo uso con `jti` + KV.

### Endpoints (v1 y legacy)

- POST /api/auth/login | /api/v1/auth/login
- POST /api/auth/refresh | /api/v1/auth/refresh
- POST /api/auth/logout | /api/v1/auth/logout
- GET /api/me | /api/v1/me

### Ejemplos curl

Login:

curl -X POST https://<host>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"secret"}'

Refresh:

curl -X POST https://<host>/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<token>"}'

Me:

curl https://<host>/api/v1/me \
  -H "Authorization: Bearer <access_token>"

## RBAC

Roles oficiales: `admin`, `dj`, `user`.

- `admin` puede todo.
- `dj` puede crear mixes y subir audio.
- `user` puede leer mixes publicados.

## Mixes

### Endpoints

- POST /api/mixes | /api/v1/mixes (dj/admin)
- GET /api/mixes | /api/v1/mixes (auth)
- GET /api/mixes/mine | /api/v1/mixes/mine (auth)
- PATCH /api/mixes/admin | /api/v1/mixes/admin (admin)
- PATCH /api/mixes/audio | /api/v1/mixes/audio (owner/admin)

### Ejemplos curl

Crear mix:

curl -X POST https://<host>/api/v1/mixes \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Set 01","audioUrl":"https://..."}'

Listar publicados:

curl https://<host>/api/v1/mixes \
  -H "Authorization: Bearer <access_token>"

Asociar audio a mix:

curl -X PATCH https://<host>/api/v1/mixes/audio \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"mixId":"<mix_id>","audioPublicId":"<public_id>"}'

## Upload de audio (Cloudinary)

### Endpoints

- POST /api/uploads/audio | /api/v1/uploads/audio (dj/admin)
- POST /api/uploads/complete | /api/v1/uploads/complete (dj/admin)

### Flujo

1) Solicitar firma:

curl -X POST https://<host>/api/v1/uploads/audio \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"audio/mpeg","size":1234567}'

2) Subir a Cloudinary con `uploadUrl` y `fields`.

3) Confirmar en backend:

curl -X POST https://<host>/api/v1/uploads/complete \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"public_id":"...","secure_url":"...","duration":123.4,"bytes":1234567,"format":"mp3","resource_type":"video","version":1700000000,"signature":"..."}'

## Rate limiting

Estrategia simple por IP + userId (si existe), usando KV.

Aplicado a:

- /api/auth/*
- /api/uploads/*
- /api/mixes/*

## Headers de seguridad

Incluidos en todas las respuestas JSON:

- Cache-Control: no-store
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: no-referrer
- Permissions-Policy: geolocation=(), microphone=(), camera=()
- Cross-Origin-Resource-Policy: same-site
- Content-Security-Policy: default-src 'none'; frame-ancestors 'none'

## Flujo recomendado en mobile (Flutter)

1) Login -> guardar access token en memoria segura.
2) Guardar refresh token en cookie (manejado por HTTP client).
3) Antes de cada request, usar access token.
4) Si falla con 401, llamar refresh y reintentar.
5) Logout -> llamar endpoint y limpiar tokens locales.

## Soft launch (checklist)

- FEATURE_UPLOADS=false para desactivar uploads temporalmente.
- Monitorizar errores 401/403/429.
- Activar logs mínimos (eventos: login, upload, mix create, moderation).
- Verificar rate limits en producción.
- Probar endpoints v1 con la app móvil.

## Observabilidad opcional

- Cada respuesta incluye `x-request-id`.
- Logger mínimo: requestId, method, path, status, durationMs.
- Métricas KV:
  - errors por endpoint: `metrics:errors:<endpoint>`
  - rate limit hits: `metrics:ratelimit:<keyPrefix>`

## Checklist de pruebas manuales (happy path)

1) Login

curl -X POST https://<host>/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"secret"}'

2) Refresh

curl -X POST https://<host>/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"<token>"}'

3) Crear mix

curl -X POST https://<host>/api/v1/mixes \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Set 01","audioUrl":"https://..."}'

4) Moderar (publicar)

curl -X PATCH https://<host>/api/v1/mixes/admin \
  -H "Authorization: Bearer <admin_access_token>" \
  -H "Content-Type: application/json" \
  -d '{"mixId":"<mix_id>","status":"published"}'

5) Upload audio (firma)

curl -X POST https://<host>/api/v1/uploads/audio \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"contentType":"audio/mpeg","size":1234567}'

6) Upload complete

curl -X POST https://<host>/api/v1/uploads/complete \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"public_id":"...","secure_url":"...","duration":123.4,"bytes":1234567,"format":"mp3","resource_type":"video","version":1700000000,"signature":"..."}'

7) Asociar audio al mix

curl -X PATCH https://<host>/api/v1/mixes/audio \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"mixId":"<mix_id>","audioPublicId":"<public_id>"}'

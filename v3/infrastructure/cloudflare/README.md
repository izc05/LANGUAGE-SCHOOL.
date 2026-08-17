# Cloudflare Tunnel · Language School V3

## Arquitectura

Cloudflare Tunnel nunca apunta a PocketBase directamente.

```text
Internet
  -> Cloudflare Tunnel
  -> http://127.0.0.1:8083 (Nginx)
       -> /        React estático
       -> /api/*   PocketBase 127.0.0.1:8091
```

PocketBase `/_/` no se publica mediante Nginx.

## Opción recomendada: túnel gestionado remotamente

Crea el túnel desde Cloudflare Zero Trust, configura un hostname público y usa como servicio de origen:

```text
http://127.0.0.1:8083
```

Instala `cloudflared` como servicio usando el token que entrega Cloudflare. El token es secreto y nunca se guarda en GitHub.

## Alternativa: túnel gestionado localmente

`config.yml.example` sirve únicamente como plantilla. Copia el archivo fuera del repositorio, sustituye el UUID/hostname y coloca el JSON de credenciales en `/etc/cloudflared/` con permisos restrictivos.

La última regla de `ingress` debe seguir siendo el catch-all `http_status:404`.

Antes de activar un túnel local, valida su configuración con `cloudflared tunnel ingress validate` y comprueba que el servicio de origen responde en `127.0.0.1:8083`.

# Seguridad Cloudflare · FASE 7K

Estas reglas se aplican en la zona real de Cloudflare; no contienen credenciales y este documento funciona como contrato reproducible.

Sustituye `english.example.com` por el hostname real de `PUBLIC_ORIGIN`.

## 1. Turnstile

Crear un widget Turnstile para el hostname público y guardar fuera de GitHub:

```text
TURNSTILE_SITE_KEY=<site-key pública>
TURNSTILE_SECRET_KEY=<secret privada>
TURNSTILE_EXPECTED_ACTION=contact
TURNSTILE_ALLOWED_HOSTNAMES=english.example.com
```

La site key se compila en React. La secret solo la recibe PocketBase mediante `/etc/language-school/production.env`.

El formulario no confía en el widget del navegador: `POST /api/language-school/contact` valida el token contra Siteverify antes de crear `contact_requests`.

## 2. Rate limit · login

Proteger el endpoint que recibe realmente la contraseña, no solo la página `/acceso`.

Expresión objetivo:

```text
http.host eq "english.example.com" and
http.request.uri.path eq "/api/collections/users/auth-with-password" and
http.request.method eq "POST"
```

Política inicial conservadora:

```text
Característica: IP
Umbral inicial: 5 solicitudes / 1 minuto
Acción: Managed Challenge
```

Revisar Security Events después de publicar y ajustar el umbral con tráfico real antes de endurecerlo.

## 3. Rate limit · contacto

Expresión objetivo:

```text
http.host eq "english.example.com" and
http.request.uri.path eq "/api/language-school/contact" and
http.request.method eq "POST"
```

Política inicial:

```text
Característica: IP
Umbral inicial: 10 solicitudes / 1 minuto
Acción: Managed Challenge
```

Turnstile sigue siendo obligatorio aunque Cloudflare no active el rate limit.

## 4. AI Crawl Control

Objetivo de Language School:

```text
Búsqueda web                  PERMITIR
Asistentes/búsqueda IA        PERMITIR
Entrenamiento masivo IA       BLOQUEAR
Scraping de contenido         BLOQUEAR
```

Mantener permitidos los buscadores verificados y, cuando Cloudflare los muestre como crawlers independientes, mantener permitidos los agentes de búsqueda/asistencia que queramos conservar (por ejemplo OAI-SearchBot y ChatGPT-User).

Bloquear los crawlers dedicados a entrenamiento o scraping que no queramos autorizar. La política de origen queda además expresada en `frontend/public/robots.txt` mediante `search=yes`, `ai-input=yes` y `ai-train=no`.

## 5. Bot Fight Mode

**No activarlo de forma automática en esta arquitectura sin probarlo primero.** El mismo hostname sirve el frontend y `/api/*`, y Bot Fight Mode actúa sobre el dominio completo y puede desafiar tráfico legítimo de API.

Primero usar:

1. Turnstile en formularios públicos;
2. rate limiting por endpoint;
3. AI Crawl Control;
4. Security Events para observar falsos positivos.

Si el plan contratado permite Super Bot Fight Mode o Bot Management con excepciones más granulares, reevaluarlo después de observar tráfico real.

## 6. Checklist tras activar reglas

- `/` carga sin challenge para navegación humana normal.
- Google/Bing siguen pudiendo rastrear contenido público.
- `/robots.txt` responde correctamente.
- `/acceso`, `/admin`, `/alumno` y `/profesor` permanecen `noindex`.
- un login válido funciona normalmente.
- intentos repetidos de login alcanzan el rate limit.
- el formulario válido supera Turnstile y llega a Admin.
- un POST directo a `contact_requests` continúa bloqueado.
- un POST al endpoint de contacto sin token devuelve rechazo.
- `/api/health` continúa funcionando a través del Tunnel.
- `/_/` no expone el panel de PocketBase.
- Security Events no muestra falsos positivos relevantes antes de endurecer reglas.

## Comprobación general del Tunnel

Una vez activo el túnel:

1. `/` debe devolver el frontend.
2. `/api/health` debe devolver la salud de PocketBase.
3. `/_/` no debe mostrar el panel administrativo de PocketBase.
4. No debe haber ningún reenvío de puertos 8091/8083 en el router.

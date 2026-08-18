# Cloudflare Tunnel · Language School V3

## Arquitectura

Cloudflare Tunnel nunca apunta a PocketBase directamente.

```text
Internet
  -> Cloudflare
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

# Seguridad Cloudflare · FASE 7K.8

Estas reglas se aplican en la zona real de Cloudflare. El repositorio no contiene credenciales reales y este documento funciona como contrato reproducible de producción.

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

El formulario no confía en el widget del navegador: `POST /api/language-school/contact` valida cada token contra Siteverify antes de crear `contact_requests`.

Contrato de seguridad:

- validación server-side obligatoria;
- token máximo 2048 caracteres;
- cada token es de un solo uso;
- los tokens caducan a los 5 minutos;
- cuando se configuran, también se validan `action=contact` y hostname permitido;
- el secreto nunca aparece en variables `VITE_*`, HTML, JavaScript o GitHub.

## 2. Content Signals en origen

Language School expresa esta política:

```text
search=yes
ai-input=yes
ai-train=no
use=reference
```

`frontend/public/robots.txt` declara la política completa para crawlers.

Además, Nginx publica en las respuestas:

```text
Content-Signal: search=yes, ai-input=yes, ai-train=no
```

Esta segunda capa es deliberada. Cloudflare puede transformar HTML a formatos optimizados para agentes y, cuando el origen publica `Content-Signal`, esa política del origen debe conservarse como autoridad. De esta forma no dependemos de un valor por defecto de la plataforma para decidir si el contenido puede utilizarse para entrenamiento.

## 3. robots.txt gestionado por Cloudflare

Language School **ya sirve su propio `robots.txt`**, con:

- rutas privadas bloqueadas;
- búsqueda pública permitida;
- asistentes/búsqueda IA permitidos;
- crawlers de entrenamiento seleccionados bloqueados;
- `ai-train=no`.

Por tanto, la opción más predecible inicialmente es **mantener el robots.txt gestionado de Cloudflare desactivado** y usar nuestro archivo como fuente de verdad.

Si se decide activar el robots.txt gestionado más adelante, Cloudflare puede anteponer contenido gestionado al archivo existente. Después de activarlo hay que revisar obligatoriamente la respuesta final de `/robots.txt` y confirmar que no existe ninguna contradicción con `ai-input=yes`, las rutas privadas o los agentes de búsqueda que queremos permitir.

`robots.txt` expresa preferencias; no es una barrera técnica. La aplicación efectiva de bloqueos corresponde a AI Crawl Control/WAF.

## 4. AI Crawl Control

Objetivo de Language School:

```text
Búsqueda web                  PERMITIR
Asistentes/búsqueda IA        PERMITIR
Entrenamiento masivo IA       BLOQUEAR
Scraping no autorizado        BLOQUEAR
```

AI Crawl Control está disponible en todos los planes y permite revisar actividad por crawler y decidir `Allow` o `Block` individualmente.

Criterio recomendado:

- permitir crawlers de búsqueda tradicionales verificados;
- permitir crawlers clasificados como AI Search o AI Assistant cuando aporten búsqueda, referencias o acceso iniciado por el usuario;
- bloquear los crawlers dedicados a AI Crawler/training cuando no queramos autorizar ese uso;
- revisar periódicamente la pestaña de `robots.txt` para detectar violaciones;
- si un crawler incumple nuestras directivas, bloquearlo en AI Crawl Control o mediante una regla WAF específica.

Ejemplos que deben distinguirse correctamente:

```text
GPTBot          -> AI Crawler   -> bloquear
OAI-SearchBot   -> AI Search    -> permitir
ChatGPT-User    -> AI Assistant -> permitir
ClaudeBot       -> AI Crawler   -> bloquear
Claude-SearchBot / Claude-User  -> valorar como búsqueda/asistencia
PerplexityBot / Perplexity-User -> valorar como búsqueda/asistencia
```

No usar una regla genérica que bloquee todos los bots de IA si queremos conservar búsqueda y asistencia.

## 5. Rate Limiting en Cloudflare

El origen ya tiene una segunda barrera en Nginx:

```text
login:    5 req/min por IP
contacto: 10 req/min por IP
exceso:   HTTP 429
```

Cloudflare debe actuar antes del Tunnel para absorber ráfagas, pero la configuración disponible depende del plan.

### 5A. Plan Free

El plan Free dispone de **una sola regla de Rate Limiting**, característica IP, periodo mínimo disponible de 10 segundos y no permite usar `Method` en la expresión.

Usar una regla conjunta de ráfaga:

```text
http.request.uri.path eq "/api/collections/users/auth-with-password" or
http.request.uri.path eq "/api/language-school/contact"
```

Configuración inicial:

```text
Característica: IP
Umbral: 5 solicitudes / 10 segundos
Acción: Block
Duración: 10 segundos
```

Nginx mantiene después los límites separados de 5/min para login y 10/min para contacto.

### 5B. Plan Pro

Pro permite dos reglas y periodos más amplios, pero no dispone del campo `Method` en Rate Limiting.

Regla login:

```text
http.request.uri.path eq "/api/collections/users/auth-with-password"
```

```text
IP · 5 solicitudes / 1 minuto · Managed Challenge
```

Regla contacto:

```text
http.request.uri.path eq "/api/language-school/contact"
```

```text
IP · 10 solicitudes / 1 minuto · Managed Challenge
```

Tras observar Security Events, se puede cambiar a `Block` si el tráfico mitigado es inequívocamente abusivo.

### 5C. Plan Business o superior

Business permite incluir `Method` en la expresión y usar counting expressions basadas en el código de respuesta.

Login, expresión de coincidencia:

```text
http.host eq "english.example.com" and
http.request.uri.path eq "/api/collections/users/auth-with-password" and
http.request.method eq "POST"
```

Para reducir falsos positivos, contar solo fallos:

```text
http.request.uri.path eq "/api/collections/users/auth-with-password" and
http.request.method eq "POST" and
http.response.code in {401 403}
```

Política inicial:

```text
IP · 5 fallos / 1 minuto · Managed Challenge
```

Contacto:

```text
http.host eq "english.example.com" and
http.request.uri.path eq "/api/language-school/contact" and
http.request.method eq "POST"
```

```text
IP · 10 solicitudes / 1 minuto · Managed Challenge
```

Turnstile sigue siendo obligatorio aunque Cloudflare no active o no alcance el rate limit.

## 6. Bot Fight Mode

**No activar Bot Fight Mode de forma automática sin probarlo primero.** El mismo hostname sirve frontend y `/api/*`, y en Free Bot Fight Mode no permite exclusiones granulares mediante reglas skip.

Primero usar:

1. Turnstile en formularios públicos;
2. Rate Limiting por endpoint según el plan;
3. AI Crawl Control;
4. Security Events para observar falsos positivos.

Si el plan permite Super Bot Fight Mode o Bot Management, reevaluarlo después de observar tráfico real y crear excepciones explícitas para flujos legítimos.

## 7. Cabeceras antiindexación privadas

React publica metadatos `noindex` dinámicos para:

```text
/acceso
/admin
/alumno
/profesor
```

Nginx añade además, usando la URL original aunque la SPA termine sirviendo `index.html`:

```text
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
```

Esto protege también frente a crawlers que no ejecutan JavaScript.

## 8. Security Events y analítica

Después de activar las reglas:

- revisar Security Events para login y contacto;
- revisar Turnstile Analytics y hostnames inesperados;
- revisar AI Crawl Control > Crawlers;
- revisar AI Crawl Control > Robots.txt para detectar violaciones;
- confirmar que buscadores verificados siguen llegando a páginas públicas;
- no endurecer reglas por intuición si todavía no existe tráfico suficiente.

## 9. Verificador exterior de producción

Cuando el hostname público esté activo, ejecutar desde un equipo externo al servidor:

```bash
bash v3/infrastructure/cloudflare/verify-production.sh https://english.example.com
```

También acepta:

```bash
export PUBLIC_ORIGIN=https://english.example.com
bash v3/infrastructure/cloudflare/verify-production.sh
```

El verificador comprueba sin generar tráfico agresivo:

- HTTPS y presencia de `CF-Ray`;
- `Content-Signal` del origen;
- `robots.txt`;
- `X-Robots-Tag` de portales privados;
- `/api/health`;
- ocultación de `/_/`;
- rechazo del contacto sin Turnstile;
- rechazo del bypass directo de `contact_requests`.

No provoca deliberadamente los rate limits ni bloquea crawlers. Esas pruebas se realizan manualmente desde el panel para no generar mitigaciones artificiales ni bloquear la IP del operador.

## 10. Checklist tras activar reglas

- `/` carga sin challenge para navegación humana normal.
- Google/Bing siguen pudiendo rastrear contenido público.
- `/robots.txt` responde con la política esperada.
- `/acceso`, `/admin`, `/alumno` y `/profesor` reciben `X-Robots-Tag` privado.
- un login válido funciona normalmente.
- intentos repetidos de login alcanzan el rate limit previsto para el plan.
- el formulario válido supera Turnstile y llega a Admin.
- un POST directo a `contact_requests` continúa bloqueado.
- un POST al endpoint de contacto sin token devuelve rechazo.
- `/api/health` continúa funcionando a través del Tunnel.
- `/_/` no expone el panel de PocketBase.
- Security Events no muestra falsos positivos relevantes antes de endurecer reglas.
- Turnstile Analytics no muestra hostnames inesperados.
- AI Crawl Control mantiene bloqueados los crawlers de entrenamiento elegidos y permite búsqueda/asistencia.

## Comprobación general del Tunnel

Una vez activo el túnel:

1. `/` debe devolver el frontend.
2. `/api/health` debe devolver la salud de PocketBase.
3. `/_/` no debe mostrar el panel administrativo de PocketBase.
4. No debe haber ningún reenvío de puertos 8091/8083 en el router.

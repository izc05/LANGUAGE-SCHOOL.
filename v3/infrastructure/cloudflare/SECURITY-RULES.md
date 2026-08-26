# Cloudflare · Seguridad, bots y abuso · Language School

Fecha de referencia: 2026-08-18.

Este documento prepara la configuración de la zona real. **No implica que estas reglas estén activadas** hasta verificarlas en el dashboard de Cloudflare del dominio definitivo.

La arquitectura esperada es:

```text
Internet
  → Cloudflare
  → Tunnel
  → 127.0.0.1:8083 Nginx
  → 127.0.0.1:8091 PocketBase
```

Nginx ya dispone de límites conservadores de defensa en profundidad. Cloudflare debe ser la primera barrera contra scraping, floods y abuso automatizado.

## 1. Principios

1. Permitir usuarios reales y buscadores legítimos.
2. Mantener indexable la web pública.
3. No indexar `/acceso`, `/admin`, `/alumno`, `/profesor` ni `/api`.
4. Tratar `robots.txt` como preferencia de crawler, no como control de seguridad.
5. Usar AI Crawl Control/WAF para bloquear técnicamente crawlers de IA cuando esa sea la política elegida.
6. Aplicar rate limiting a escrituras sensibles, no a toda `/api/`.
7. No desafiar audio, realtime, assets ni navegación normal del Campus.
8. No permitir que una regla de bots bloquee crawlers de búsqueda que queramos conservar.

## 2. `robots.txt` del repositorio

`v3/frontend/public/robots.txt`:

- permite el contenido público;
- desaconseja rastrear rutas privadas/API;
- permite `OAI-SearchBot` en contenido público para conservar descubrimiento en ChatGPT Search;
- bloquea `GPTBot` como señal de exclusión de entrenamiento.

La seguridad real de rutas privadas sigue dependiendo de auth/roles/PocketBase/Nginx/Cloudflare.

## 3. Política recomendada para AI crawlers

En **AI Crawl Control**:

- **Search:** permitir inicialmente, para conservar descubrimiento en motores/buscadores asistidos por IA.
- **Training:** bloquear inicialmente.
- **Agent:** observar primero; bloquear si genera scraping/abuso o si la academia decide no permitir acceso automatizado en tiempo real.

Después revisar la pestaña de crawlers y ajustar por operador/crawler concreto. No mantener allowlists por User-Agent manual cuando Cloudflare ya pueda clasificar el bot de forma verificada.

## 4. Rate limiting · capa Cloudflare

Las capacidades exactas del editor de expresiones y las características de conteo dependen del plan. La intención funcional de las reglas debe conservarse aunque el dashboard obligue a una variante más simple.

### RL-1 · Login

Objetivo:

```text
/api/collections/users/auth-with-password
```

Recomendación inicial:

- contar por IP;
- umbral orientativo: 10 intentos / 1 minuto;
- mitigación: bloquear temporalmente 10 minutos o usar la acción equivalente disponible;
- no excluir errores: los intentos fallidos son precisamente los que interesa contener.

Expresión cuando el plan permita método:

```text
(http.request.uri.path eq "/api/collections/users/auth-with-password" and http.request.method eq "POST")
```

En planes donde no esté disponible `http.request.method`, el path es exclusivo de autenticación y se puede limitar por path.

### RL-2 · Contacto público

Objetivo:

```text
/api/collections/contact_requests/records
```

Recomendación inicial:

- 5 envíos / 1 minuto / IP;
- bloqueo temporal corto si se supera;
- si el spam real persiste, añadir Turnstile al formulario y validación server-side antes de crear el registro.

Expresión cuando el plan permita método:

```text
(http.request.uri.path eq "/api/collections/contact_requests/records" and http.request.method eq "POST")
```

No aplicar el límite a GET de Administración.

### RL-3 · Inicio del test público

Objetivo:

```text
/api/language-school/placement/start
```

Recomendación inicial:

- 10 inicios / 1 minuto / IP;
- el umbral es suficientemente alto para hogares/colegios compartiendo NAT, pero evita creación masiva de intentos.

Expresión cuando el plan permita método:

```text
(http.request.uri.path eq "/api/language-school/placement/start" and http.request.method eq "POST")
```

### RL-4 · Mutaciones del intento público

Rutas:

```text
/api/language-school/placement/attempts/{id}/answer
/api/language-school/placement/attempts/{id}/finish
/api/language-school/placement/attempts/{id}/contact
```

No crear una regla simple contra todo `/api/language-school/placement/attempts/`, porque ahí también viven lecturas y audio protegido.

Si el plan permite expresiones suficientemente específicas, limitar solo POST a `answer|finish|contact`. Si no, dejar esta defensa en Nginx/origen y proteger en Cloudflare principalmente `start`, que es el endpoint anónimo que crea estado.

## 5. Nginx · defensa en profundidad

El reverse proxy aplica presupuestos por la IP restaurada desde `CF-Connecting-IP`, únicamente para POST:

- login: 30/min + burst 10;
- contacto: 10/min + burst 3;
- placement start: 30/min + burst 10;
- placement answer/finish/contact: 300/min + burst 60.

Estos límites son más permisivos que la política de edge a propósito: la capa de origen debe absorber fallos/configuración ausente de Cloudflare sin perjudicar al alumnado legítimo.

Una respuesta limitada por Nginx usa HTTP `429`.

## 6. Turnstile · cuándo activarlo

No se añade por defecto al test de nivel para evitar fricción innecesaria.

Candidato prioritario si aparece spam real: **Contacto**.

Si se implementa Turnstile:

1. el frontend obtiene el token;
2. el token se envía al backend junto al formulario;
3. el backend valida obligatoriamente el token mediante Siteverify;
4. solo tras validación correcta se crea `contact_requests`;
5. nunca confiar únicamente en que el widget apareció en el navegador.

Valorar Turnstile también en login únicamente si el patrón real de ataques justifica la fricción adicional; el rate limiting debe existir igualmente.

## 7. WAF / Bot policy

Recomendación de arranque:

- mantener protección DDoS administrada de Cloudflare;
- bloquear crawlers clasificados para Training mediante AI Crawl Control según decisión de la academia;
- permitir verified search crawlers necesarios para SEO;
- evitar reglas genéricas del tipo “bloquear todo bot” que rompan Google/Bing/OAI-SearchBot;
- revisar eventos WAF después del piloto antes de endurecer más.

## 8. Comprobación después de activar reglas reales

Desde una conexión normal:

- Home y páginas públicas: 200.
- Google/Bing u otros buscadores elegidos: no bloqueados.
- `/robots.txt`: 200.
- Login válido: funciona.
- varios intentos de login rápidos: terminan en mitigación/429 en el umbral configurado.
- un contacto normal: funciona.
- spam repetido de contacto: mitigado.
- test público completo: funciona sin desafíos inesperados.
- Listening/audio: funciona.
- Campus realtime: funciona.
- Admin/Profesor/Alumno: sin falsos positivos.

Revisar Cloudflare Security Events y AI Crawl Control tras la prueba.

## 9. Lo que permanece externo a Git

No guardar aquí:

- Zone ID;
- Account ID;
- API tokens;
- Tunnel token;
- credenciales de Cloudflare.

La aplicación real de estas reglas se registra en el checklist de producción cuando se haga sobre el dominio definitivo.

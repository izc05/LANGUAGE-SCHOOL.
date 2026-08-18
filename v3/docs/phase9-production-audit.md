# FASE 9.0 · Auditoría de Production Readiness

Fecha de auditoría: 2026-08-18

Candidato de entrada: `24c7358fce78404c9a54b38f39b9e37e8b095b89`

## Objetivo

Separar la candidata funcional validada de la candidata realmente desplegable. Esta auditoría no marca como realizadas comprobaciones que requieren el servidor físico, Cloudflare real, credenciales externas o un piloto humano.

## Resumen

La base de producción es mejor de lo que sugerían los defaults del frontend: el flujo oficial de despliegue fuerza `connected`, enlaza PocketBase y Nginx a loopback, bloquea `/_/`, endurece el servicio systemd y dispone de backup/restore defensivos.

La auditoría encontró un P0 real —el instalador no materializaba `pb_hooks`— y varias deudas P1. El P0 y el bloque de configuración fail-safe 9.1 ya tienen corrección en código; su cierre sigue sujeto a que el candidato completo pase las puertas CI sobre el mismo SHA.

## P0 · Bloqueadores de despliegue

### P0-1 · Los hooks de PocketBase no se instalaban

Estado: **RESUELTO EN CÓDIGO · sujeto a puerta CI del candidato de 9.1**.

Hallazgo original: `install-pocketbase.sh` copiaba `pb_migrations`, pero no creaba ni copiaba `pb_hooks`.

Riesgo: los endpoints de aplicación que viven en hooks —Zoom, test de nivel, Listening y otros servicios server-side— funcionaban en CI porque los workflows arrancaban PocketBase contra el árbol del repositorio, pero no quedarían materializados en `/opt/language-school/pocketbase` durante una instalación física nueva.

Corrección aplicada:

1. `install-pocketbase.sh` instala `v3/pocketbase/pb_hooks` en `/opt/language-school/pocketbase/pb_hooks` junto con las migraciones;
2. ambos árboles quedan `root:root`, directorios `0755` y archivos `0644`;
3. `start-pocketbase.sh` exige que `pb_hooks` exista y arranca PocketBase con `--hooksDir` explícito;
4. Infrastructure CI falla si hooks y migraciones dejan de viajar juntos o si se intenta arrancar sin hooks;
5. PocketBase CI carga el mismo directorio de hooks que el runtime real.

## P1 · Obligatorio antes de producción pública

### P1-1 · Configuración frontend fail-safe

Estado: **IMPLEMENTADO EN 9.1 · sujeto a puerta CI**.

Corrección aplicada:

- desarrollo local puede seguir entrando en demo si no hay variables;
- un build de producción exige `VITE_APP_MODE=demo|connected` desde `vite.config.ts`;
- `connected` exige `VITE_POCKETBASE_URL`;
- Frontend CI demuestra que ambos casos inseguros fallan;
- el deploy físico fuerza `connected` y solo acepta `PUBLIC_ORIGIN` HTTPS;
- el deploy rechaza localhost, loopback y hosts reservados/placeholder como `*.example.com`.

### P1-2 · Variables privadas Zoom

Estado: **DOCUMENTADO EN 9.1 · verificación real pendiente del host/Zoom Marketplace**.

Los hooks esperan:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_HOST_USER_ID`
- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`

`v3/infrastructure/PRIVATE-VARIABLES.md` documenta nombres, propósito, permisos, reinicio y rotación. Los valores reales deben añadirse únicamente a `/etc/language-school/production.env`; nunca se versionan ni entran en `VITE_*`.

### P1-3 · Inconsistencia de puertos en documentación

Estado: **RESUELTO EN DOCUMENTACIÓN 9.1 · verificación física pendiente**.

La plantilla actual usa:

- Nginx `127.0.0.1:8083`
- PocketBase `127.0.0.1:8091`

`infrastructure/README.md`, `PRODUCTION-CHECKLIST.md`, Cloudflare e Infrastructure CI quedan alineados con esos valores y recuerdan que la fuente real de configuración es `/etc/language-school/production.env`.

### P1-4 · Contexto real del visitante detrás de Cloudflare Tunnel

Estado: **ABIERTO · 9.2**.

Cloudflare conserva la IP del visitante en `CF-Connecting-IP` y el protocolo original en cabeceras de forwarding. El Nginx actual envía a PocketBase `X-Real-IP $remote_addr` y sobrescribe `X-Forwarded-Proto` con `$scheme`, que es HTTP en el salto local cloudflared → Nginx.

Acción: preservar de forma segura el contexto de Cloudflare sin confiar ciegamente en cabeceras que podrían falsificarse desde una ruta no confiable. Nginx solo debe permanecer accesible por loopback/Tunnel.

### P1-5 · Sin política explícita robots/bots

Estado: **ABIERTO · 9.3**.

`v3/frontend/public` no contiene `robots.txt`.

Acción:

- permitir buscadores legítimos;
- decidir política de crawlers de IA;
- usar `robots.txt` solo como preferencia;
- usar Cloudflare AI Crawl Control/WAF para enforcement real cuando se configure la zona.

### P1-6 · Sin rate limiting explícito de aplicación/edge

Estado: **ABIERTO · 9.3**.

No se ha encontrado Turnstile, captcha, throttle o rate limiting propio en el repositorio.

Superficies prioritarias:

- login PocketBase;
- contacto público;
- inicio/respuestas del test público;
- endpoints públicos que puedan generar escrituras o carga repetida.

Acción: diseñar reglas Cloudflare por ruta y, donde aporte defensa en profundidad, controles server-side. No implementar rate limiting Nginx por `$remote_addr`, porque con Tunnel el origen ve a `cloudflared` y podría agrupar a todos los visitantes.

### P1-7 · Permissions-Policy y futura aula Zoom embebida

Estado: **ABIERTO PARA LA FUTURA UI EMBEBIDA; no rompe la candidata actual**.

Nginx envía actualmente `Permissions-Policy: camera=(), microphone=(), geolocation=()` global.

La autorización server-side de Meeting SDK existe, pero no se ha identificado todavía un cliente Zoom embebido completo en el frontend. Por tanto no rompe hoy una función visible, pero bloquearía cámara/micrófono si la futura aula se ejecuta en el mismo origen.

Acción: mantener la política restrictiva hasta implementar el cliente real; después abrir cámara/micrófono solo donde sea necesario.

## P2 · Recomendado tras P0/P1

### P2-1 · Observabilidad

Existe `health-check.sh` y Admin dispone de estados funcionales, pero falta convertirlo en una rutina operativa: timer/monitor externo, alertas y runbook de caída/recuperación.

### P2-2 · Rendimiento de carga inicial

Vite informa de un chunk principal mayor de 500 kB. En el candidato 8C el JS principal ronda 1.65 MB minificado / 435 kB gzip.

Acción: medir y aplicar lazy loading/code splitting por rutas pesadas sin romper Intro, Campus o Admin.

### P2-3 · Prueba automatizada del paquete físico

Infrastructure CI valida sintaxis, loopback, hooks/migraciones, origen público, checksums, Nginx, Cloudflare catch-all y timer. Sigue pendiente una simulación todavía más completa del instalador físico con systemd/usuarios reales, que no sustituye al piloto en host.

## P3 · Mejoras opcionales

- réplica/off-site adicional de backup después de validar el disco externo;
- métricas de capacidad y espacio en disco;
- automatización de rotación/retención más avanzada si el volumen real lo exige.

## Fortalezas verificadas

- deploy oficial fuerza `connected` y exige un `PUBLIC_ORIGIN` HTTPS no-placeholder;
- PocketBase solo acepta `127.0.0.1:<puerto>` en el wrapper de arranque;
- PocketBase exige el árbol `pb_hooks` antes de arrancar;
- Nginx solo escucha en loopback según la instalación prevista;
- PocketBase `/_/` se bloquea en reverse proxy;
- Cloudflare Tunnel apunta a Nginx, no a PocketBase;
- servicio systemd usa usuario dedicado, `UMask=0077`, `NoNewPrivileges` y filesystem endurecido;
- backup aborta si el disco externo no es un mountpoint real;
- backup crea SHA-256 y retención;
- restore exige checksum y revierte automáticamente si PocketBase no recupera salud;
- `health-check.sh` comprueba servicio, API directa, API por proxy, frontend y bloqueo de `/_/`.

## Validaciones que NO pueden marcarse desde GitHub

Permanecen externas hasta tener evidencia del host real:

- hardware/SSD/red/SSH;
- `production.env` real;
- Cloudflare Tunnel y dominio HTTPS real;
- credenciales Zoom reales;
- puertos del router/firewall real;
- mount del disco externo;
- backup nocturno observado;
- restore drill real;
- piloto con alumnos/profesores reales;
- audios Listening académicos definitivos.

## Orden aprobado tras 9.0

1. P0-1 hooks de PocketBase + prueba Infrastructure CI.
2. 9.1 configuración fail-safe + secretos documentados + puertos coherentes.
3. 9.2 Nginx/proxy/contexto Cloudflare.
4. 9.3 robots, bots y abuso.
5. 9.4 observabilidad.
6. 9.5 backup/restore drill preparado.
7. 9.6 integraciones externas.
8. 9.7 rendimiento.
9. 9.8 despliegue/piloto real.
10. 9.9 cierre final.

# FASE 9.0 · Auditoría de Production Readiness

Fecha de auditoría: 2026-08-18

Candidato de entrada: `24c7358fce78404c9a54b38f39b9e37e8b095b89`

## Objetivo

Separar la candidata funcional validada de la candidata realmente desplegable. Esta auditoría no marca como realizadas comprobaciones que requieren el servidor físico, Cloudflare real, credenciales externas o un piloto humano.

## Resumen

La base de producción es mejor de lo que sugerían los defaults del frontend: el flujo oficial de despliegue fuerza `connected`, exige `PUBLIC_ORIGIN`, enlaza PocketBase y Nginx a loopback, bloquea `/_/`, endurece el servicio systemd y dispone de backup/restore defensivos.

Sin embargo, se ha encontrado un defecto P0 que impediría que una instalación nueva reproduzca toda la aplicación: `install-pocketbase.sh` instala migraciones pero no `pb_hooks`.

## P0 · Bloqueadores de despliegue

### P0-1 · Los hooks de PocketBase no se instalan

Estado: **ABIERTO**.

`v3/infrastructure/raspberry-pi/install-pocketbase.sh` copia `pb_migrations`, pero no crea ni copia `pb_hooks`.

Los endpoints de aplicación que viven en hooks —entre ellos Zoom, test de nivel, Listening y otros servicios server-side— funcionan en CI porque los workflows arrancan PocketBase contra el árbol del repositorio, pero no quedarían materializados en `/opt/language-school/pocketbase` durante una instalación física nueva.

Corrección obligatoria:

1. instalar `v3/pocketbase/pb_hooks` en `/opt/language-school/pocketbase/pb_hooks`;
2. mantener propiedad root y permisos de solo lectura para el usuario de servicio;
3. hacer explícito `--hooksDir` en `start-pocketbase.sh`;
4. ampliar Infrastructure CI para fallar si hooks y migraciones no viajan juntos.

## P1 · Obligatorio antes de producción pública

### P1-1 · Defaults frontend seguros solo a través del script oficial

`frontend/src/config/environment.ts` cae a `demo` y localhost en un build genérico. El script oficial `deploy-frontend.sh` sí fuerza `VITE_APP_MODE=connected`, exige `PUBLIC_ORIGIN` y compila `VITE_POCKETBASE_URL` con ese origen.

Acción: hacer que el flujo de producción rechace explícitamente dominios placeholder y documentar que ningún despliegue alternativo puede usar un build genérico.

### P1-2 · Plantilla de producción no documenta las variables Zoom

Los hooks esperan:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`

La plantilla versionada evita correctamente valores secretos, pero el procedimiento actual no deja un checklist claro de variables privadas que deben añadirse manualmente a `/etc/language-school/production.env`.

Acción: documentar nombres y validación sin añadir valores reales al repositorio.

### P1-3 · Inconsistencia de puertos en documentación

La configuración actual de ejemplo usa:

- Nginx `127.0.0.1:8083`
- PocketBase `127.0.0.1:8091`

`cloudflare/config.yml.example` coincide con `8083`, pero `infrastructure/README.md` y `PRODUCTION-CHECKLIST.md` conservan referencias antiguas `8080/8090`.

Acción: unificar documentación con los valores de `production.env` y evitar checks escritos contra puertos obsoletos.

### P1-4 · Contexto real del visitante detrás de Cloudflare Tunnel

Cloudflare conserva la IP del visitante en `CF-Connecting-IP` y el protocolo original en `X-Forwarded-Proto`. El Nginx actual envía a PocketBase `X-Real-IP $remote_addr` y sobrescribe `X-Forwarded-Proto` con `$scheme`, que es HTTP en el salto local cloudflared → Nginx.

Acción: preservar de forma segura el contexto de Cloudflare sin confiar ciegamente en cabeceras que podrían falsificarse desde una ruta no confiable. Nginx solo debe permanecer accesible por loopback/Tunnel.

### P1-5 · Sin política explícita robots/bots

`v3/frontend/public` no contiene `robots.txt`.

Acción:

- permitir buscadores legítimos;
- decidir política de crawlers de IA;
- usar `robots.txt` solo como preferencia;
- usar Cloudflare AI Crawl Control/WAF para enforcement real cuando se configure la zona.

### P1-6 · Sin rate limiting explícito de aplicación/edge

No se ha encontrado Turnstile, captcha, throttle o rate limiting propio en el repositorio.

Superficies prioritarias:

- login PocketBase;
- contacto público;
- inicio/respuestas del test público;
- endpoints públicos que puedan generar escrituras o carga repetida.

Acción: diseñar reglas Cloudflare por ruta y, donde aporte defensa en profundidad, controles server-side. No implementar rate limiting Nginx por `$remote_addr`, porque con Tunnel el origen ve a `cloudflared` y podría agrupar a todos los visitantes.

### P1-7 · Permissions-Policy y futura aula Zoom embebida

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

Infrastructure CI valida sintaxis, loopback, checksums, Nginx, Cloudflare catch-all y timer, pero no realiza una instalación simulada del paquete PocketBase completo.

Acción: añadir assertions de artefactos (`pb_hooks`, `pb_migrations`, wrapper y permisos esperados) y ampliar gradualmente el smoke de infraestructura.

## P3 · Mejoras opcionales

- réplica/off-site adicional de backup después de validar el disco externo;
- métricas de capacidad y espacio en disco;
- automatización de rotación/retención más avanzada si el volumen real lo exige.

## Fortalezas verificadas

- deploy oficial fuerza `connected` y exige `PUBLIC_ORIGIN`;
- PocketBase solo acepta `127.0.0.1:<puerto>` en el wrapper de arranque;
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

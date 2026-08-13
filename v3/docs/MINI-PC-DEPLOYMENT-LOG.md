# Mini PC · registro de despliegue de preproducción

Fecha de instalación: 2026-08-13 (Europe/Madrid).

## Host auditado

- Hostname: `Isi-Minipc`.
- Sistema: Ubuntu 24.04.4 LTS.
- Kernel: Linux 7.0.0-28-generic.
- Arquitectura: `x86_64`, instalada como PocketBase `linux_amd64`.
- Git: 2.43.0.
- Node.js: 22.23.2, compatible con Vite 8.
- npm: 10.9.8.
- PocketBase Language School: 0.39.9, checksum SHA-256 oficial verificado.
- Nginx: 1.24.0.
- cloudflared existente: 2026.7.3.
- Docker existente: 29.6.2.

## Discos

- Sistema: `/dev/sda2`, ext4, 233 GB, 107 GB disponibles durante la auditoría.
- Backup externo real: `/dev/sdb1`, NTFS3, montado en `/mnt/pocketbase-backup`, 211 GB disponibles durante la auditoría.

## Conflictos y decisiones

- `127.0.0.1:8090` ya estaba ocupado por el PocketBase de otro proyecto; se eligió `127.0.0.1:8091` para Language School.
- `127.0.0.1:8080` ya estaba ocupado por Docker; se eligió `127.0.0.1:8083` para Nginx de Language School.
- No se detuvo ni se reutilizó ningún puerto existente.
- Nginx no estaba instalado. Se instaló únicamente el paquete necesario y se desactivó el sitio genérico que Ubuntu había añadido en `0.0.0.0:80`; su archivo original se conservó.
- Cloudflare y sus túneles existentes no se modificaron.

## Rutas instaladas

- Checkout: `/home/isi/projects/language-school`.
- Rama: `feat/v3-platform-structure`.
- PocketBase: `/opt/language-school/pocketbase`.
- Frontend: `/opt/language-school/frontend`.
- Datos persistentes: `/var/lib/language-school/pb_data`.
- Configuración local: `/etc/language-school/production.env`, `root:root`, modo `0640`.
- Nginx: `/etc/nginx/sites-available/language-school.conf`.
- Backups: `/mnt/pocketbase-backup/language-school`.

## Resultado

- Migraciones frescas: PASS, 11 migraciones aplicadas.
- Propietario de `pb_data`: `languageschool:languageschool`.
- Superusuario local: creado, sin registrar identidad ni credenciales en este documento.
- Primer ADMIN de Language School: creado y acceso a `/admin` confirmado por Isi.
- Frontend: TypeScript PASS, Vite build PASS, `npm ci` con 0 vulnerabilidades.
- Aviso no bloqueante: bundle principal superior a 500 kB después de minificación.
- Editor `/admin/web`: acceso autenticado PASS, controles `Guardar borrador` y `Guardar y publicar` presentes, vista previa renderizada y sin nombres técnicos visibles.
- Servicio `language-school-pocketbase`: habilitado y activo.
- Servicio `nginx`: habilitado y activo.
- PocketBase: solo `127.0.0.1:8091`.
- Nginx Language School: solo `127.0.0.1:8083`.
- Health-check directo y mediante proxy: PASS.
- Rutas `/`, `/programas`, `/profesores`, `/sobre-nosotros`, `/tarifas`, `/contacto` y `/acceso`: HTTP 200.
- Panel interno `/_/` mediante Nginx: bloqueado con HTTP 404.
- Backup físico: configurado, primera copia manual y checksum creados, timer nocturno activo.
- Restauración física: pendiente de prueba específica.
- Cloudflare público, DNS y HTTPS: no configurados en esta fase.

## Servicios preexistentes preservados

- Atelier Lumière: HTTP 200 después del despliegue.
- Docker: activo.
- Cloudflare Tunnel: activo y sin cambios.
- PocketBase preexistente en `127.0.0.1:8090`: activo.
- Servicios existentes en `3000`, `4000`, `5174`, `8080`, `8081`, `8082`, `8090`, `11434` y `18789`: preservados.

## GitHub y pendientes

- FASE 9.2A: **COMPLETADA**.
- HEAD de código desplegado: `924772e378b0582735edae8942e163997c610552`.
- Cierre de copy para piloto: `8dac3a7`, `a3a88e4`, `4b2cb62` y `924772e`.
- Frontend CI: PASS.
- PocketBase CI: PASS.
- Infrastructure CI: PASS.
- E2E CI: **30/30 PASS**.
- Mini PC health y redespliegue exclusivo del frontend: PASS.
- Backup y checksum: PASS; la prueba de restauración física continúa pendiente y no se marca como completada.
- Siguiente bloque: seguir desarrollando sobre el mini PC antes de publicar por dominio; Cloudflare, DNS, HTTPS y SMTP continúan pendientes.
- Raspberry Pi 4: pendiente; no se marca como instalada.

## FASE 9.2B.6 · Primera clase real de prueba — ✅ COMPLETADA

- Clase programada desde `/admin/clases`: `Conversation Pilot`.
- Ámbito: `English B1 Pilot` → `B1 Pilot A` → `Laura Prueba Docente` → `Alex Alumno Prueba`.
- Horario programado: 18/08/2026, 18:00–19:00; estado `SCHEDULED` / Programada.
- ADMIN: clase, grupo, profesor, horario y lista de asistencia preparada para Alex verificados.
- PROFESOR: Laura ve la misma sesión y únicamente a Alex como alumno relacionado para asistencia; no se registró asistencia ni se cambió el estado.
- ALUMNO: Alex ve una única clase próxima y el resumen muestra `Conversation Pilot · B1 Pilot A`.
- Incidencia corregida: el envío de la programación conservaba el valor inicial de los campos nativos de fecha/hora. El ajuste se publicó en `edfa579` y se validó creando la sesión correcta; el intento con horario erróneo quedó cancelado, sin asistencia.
- `bash v3/infrastructure/raspberry-pi/health-check.sh`: PASS.

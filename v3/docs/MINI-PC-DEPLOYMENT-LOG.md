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

## FASE 9.2B.12 → 9.2B.16 · Cierre de preproducción real — ✅ COMPLETADA

- Auditoría de roles: PASS. ADMIN conserva el control global; Laura solo accede a su ámbito docente (B1 Pilot A y Alex); Alex solo accede a su portal. Los intentos de rutas ajenas redirigen al portal del rol correspondiente.
- Responsive: PASS en móvil (390 px) para web pública, los tres portales y sus acciones principales; también comprobado en tableta (768 px). Sin desbordamiento horizontal detectado.
- Backup real: `language-school-20260813T210325Z.tar.gz` creado en `/mnt/pocketbase-backup/language-school`; SHA-256 validado con `OK`.
- Restore real: PASS desde el archivo anterior. La primera ejecución detectó un falso negativo del validador de contenido del archivo; se corrigió de forma versionada en `6cbba67` y la segunda ejecución terminó con `Restore health check: SUCCESS`.
- Seguridad de restauración: se preservó la copia anterior en `/var/lib/language-school/pb_data.before-restore-20260813T210858Z`.
- Verificación posterior por interfaz: recuperados Laura, Alex, English B1 Pilot, B1 Pilot A, Conversation Pilot, asistencia `Presente`, material, tarea corregida con nota 8, archivo privado y aviso original. El aviso temporal `TEMP RESTORE MARKER`, creado después de la copia, no existe tras restaurar.
- Servicio PocketBase: activo; Nginx y PocketBase permanecen enlazados solo en `127.0.0.1:8083` y `127.0.0.1:8091`.
- Timer de backup: habilitado y activo; siguiente ejecución nocturna programada.
- Health-check completo y portada HTTP: PASS. Atelier Lumière comprobado sin cambios (respuesta HTTP 302 de su acceso protegido).
- CI de `6cbba67`: Frontend, PocketBase, Infrastructure y E2E PASS.
- Cloudflare público, DNS, HTTPS y SMTP: continúan pendientes y no se modificaron.

## FASE 9.3A · Preparación segura para publicación — ✅ COMPLETADA (sin publicar)

- Baseline: rama `feat/v3-platform-structure`, HEAD `6198e2d9c5e97c49ba3ae923f2fbf4a1d62f7a57`, árbol limpio y health-check PASS.
- Cloudflared existente: instalado (`2026.7.3`), habilitado y activo como servicio systemd. No se inspeccionaron ni registraron tokens o credenciales.
- Arquitectura Atelier: túnel Cloudflare gestionado remotamente, con conector activo en `Isi-Minipc`; no hay contenedor Docker de cloudflared. Atelier se mantuvo intacto (HTTP 302 de su acceso protegido).
- Cloudflare: una única zona disponible, `isivoltpro.com`; un túnel existente saludable. No se crearon ni editaron rutas, hostnames, DNS ni túneles.
- Candidato elegido por Isi: `language-school.isivoltpro.com`. Sigue sin crear ni publicar.
- Estrategia recomendada: reutilizar el túnel/conector existente y añadir en la fase posterior un hostname con origen exclusivo `http://127.0.0.1:8083`.
- Seguridad de origen: Nginx sirve en `127.0.0.1:8083`, `/api/` proxy a `127.0.0.1:8091` y `/_/` devuelve 404. No hay listeners Language School en 80 o 443.
- `PUBLIC_ORIGIN` actual: `http://127.0.0.1:8083`. Propuesto: `https://language-school.isivoltpro.com`; requerirá reconstruir y desplegar el frontend al activar la publicación.
- SMTP y recuperación de contraseña por correo: pendientes de una fase posterior, sin proveedor ni credenciales configurados.
- Cloudflare público, DNS, HTTPS, SMTP y router port-forward: sin cambios en esta fase.

## FASE 9.2B.6 · Primera clase real de prueba — ✅ COMPLETADA

- Clase programada desde `/admin/clases`: `Conversation Pilot`.
- Ámbito: `English B1 Pilot` → `B1 Pilot A` → `Laura Prueba Docente` → `Alex Alumno Prueba`.
- Horario programado: 18/08/2026, 18:00–19:00; estado `SCHEDULED` / Programada.
- ADMIN: clase, grupo, profesor, horario y lista de asistencia preparada para Alex verificados.
- PROFESOR: Laura ve la misma sesión y únicamente a Alex como alumno relacionado para asistencia; no se registró asistencia ni se cambió el estado.
- ALUMNO: Alex ve una única clase próxima y el resumen muestra `Conversation Pilot · B1 Pilot A`.
- Incidencia corregida: el envío de la programación conservaba el valor inicial de los campos nativos de fecha/hora. El ajuste se publicó en `edfa579` y se validó creando la sesión correcta; el intento con horario erróneo quedó cancelado, sin asistencia.
- `bash v3/infrastructure/raspberry-pi/health-check.sh`: PASS.

## FASE 9.2B.7 · Material de clase — ✅ COMPLETADA

- Material publicado desde `/profesor/material`: `Conversation Pilot · Vocabulary`.
- Destino: `B1 Pilot A`; archivo piloto PDF sin datos personales, `conversation-pilot-material.pdf`.
- PROFESOR: PASS. Laura visualiza el recurso, su destino de grupo y las acciones de gestión dentro de su ámbito.
- PUBLICACIÓN: PASS. El recurso quedó activo y visible como material de grupo.
- ALUMNO: PASS. Alex visualiza título, descripción, archivo y etiqueta `Tu grupo` en `/alumno/material`.
- DESCARGA: PASS. La descarga protegida se confirmó desde el botón normal del alumno y el PDF corresponde al material piloto validado.
- PERMISOS: PASS. Alex solo dispone de lectura/descarga; no aparecen controles de edición, borrado ni cambio de destino.
- Incidencia corregida: la apertura asíncrona en una nueva pestaña podía ser bloqueada por el navegador. La descarga autorizada se realiza ahora en la pestaña actual (`564cf91`, `9377e88`); Frontend, PocketBase, Infrastructure y E2E CI PASS.
- `bash v3/infrastructure/raspberry-pi/health-check.sh`: PASS.

## FASE 9.2B.8 · Tarea → entrega → corrección — ✅ COMPLETADA

- Tarea publicada por Laura desde `/profesor/tareas`: `Pilot Writing Task`, destinada exclusivamente al grupo `B1 Pilot A` y con fecha límite 20/08/2026 a las 20:00.
- Se corrigió la persistencia de la fecha límite de tareas (`da7c24a`) y se sustituyó la confirmación nativa de borrado por una confirmación visible en la interfaz (`1153465`), evitando bloqueos del navegador durante una operación sensible.
- ALUMNO: Alex visualiza una única tarea pendiente, entrega una respuesta ficticia sin adjunto y la entrega persiste tras recargar.
- PROFESOR: Laura recibe una única entrega de Alex, añade feedback, calificación `8` y la marca como revisada; el estado y los datos persisten tras recargar.
- ALUMNO FINAL: Alex visualiza estado `Corregida`, la calificación `8` y el feedback; no aparecen controles para modificar ni reenviar la entrega revisada.
- CI de `1153465`: Frontend, PocketBase, Infrastructure y E2E PASS.
- `bash v3/infrastructure/raspberry-pi/health-check.sh`: PASS.

## FASE 9.2B.9 · Archivo privado del alumno — ✅ COMPLETADA

- Archivo ficticio conservado en el espacio privado de Alex: `student-private-pilot.txt`, con título visible `Private Pilot File`.
- SUBIDA ALUMNO: PASS. Se corrigió la colección y el selector de archivos para admitir texto plano (`text/plain`) mediante la migración `1786649200_allow_plain_text_student_files.js`, publicada en `f73bcf8`.
- PERSISTENCIA: PASS. Tras recargar, el espacio de Alex muestra exactamente un archivo activo, sin duplicados inesperados.
- DESCARGA ALUMNO: PASS. Alex confirmó desde el botón normal de la interfaz que el archivo `.txt` se descarga correctamente.
- VISIBILIDAD PROFESOR: PASS. Laura lo ve únicamente desde la ficha de Alex en `/profesor/alumnos`, debido a su relación activa en `B1 Pilot A`.
- DESCARGA PROFESOR: PASS. La descarga autorizada contiene `Private student pilot file.` y no se accedió a `pb_data`.
- SOLO LECTURA PROFESOR: PASS. Laura solo dispone de `Descargar`; no aparecen acciones para sustituir, editar, eliminar, reasignar ni cambiar propietario.
- PERMISOS: PASS. Alex es redirigido de `/profesor/alumnos` a `/alumno`; conserva en cambio su propio control de archivo (`Archivar`).
- CI de `e98309c`: Frontend, PocketBase, Infrastructure y E2E PASS.
- `bash v3/infrastructure/raspberry-pi/health-check.sh`: PASS.

## FASE 9.2B.10 · Aviso ADMIN → Alumno — ✅ COMPLETADA

- CREACIÓN ADMIN: PASS. Se creó un único aviso desde `/admin/avisos`: `Bienvenido a la prueba`.
- DESTINATARIO: `Alex Alumno Prueba`, seleccionado como alumno individual; tipo `GENERAL` y estado equivalente publicado/enviado.
- VISIBILIDAD ALUMNO: PASS. Alex lo ve en `/alumno/avisos` con el contenido completo.
- CONTENIDO: PASS. Incluye las tres secciones ficticias sobre acceso a clases, materiales, tareas, correcciones y archivos.
- PERSISTENCIA: PASS. El aviso existe una sola vez tanto en ADMIN como en ALUMNO tras recargar.
- ESTADO LEÍDO: PASS. Al abrirlo en el listado de Alex, cambió de `Nuevo` a `Leído` y el contador pasó de 1 a 0; persistió tras recargar.
- PERMISOS: PASS. Alex no puede entrar a `/admin/avisos` (redirección a `/alumno`) ni dispone de edición, creación, destinatario, autor o borrado. Laura no muestra este aviso individual de Alex en su resumen docente.
- `bash v3/infrastructure/raspberry-pi/health-check.sh`: PASS.

## FASE 9.2B.11 · Asistencia — ✅ COMPLETADA

- CLASE UTILIZADA: `Conversation Pilot` · `B1 Pilot A` · Laura Prueba Docente · 18/08/2026 18:00–19:00.
- ASISTENCIA FUTURA: PERMITIDA. La interfaz docente habilita la gestión de asistencia aunque la clase permanece en estado Programada y futura; se usó la clase existente, sin alterar fecha ni estado.
- ALUMNO EN LISTA: PASS. Laura ve únicamente a Alex Alumno Prueba, con matrícula ACTIVE en B1 Pilot A.
- REGISTRO PRESENT: PASS. Laura marcó `Presente` desde `/profesor/clases`.
- PERSISTENCIA: PASS. El resultado persiste después de recargar.
- EDICIÓN: PASS. La asistencia cambió temporalmente `Presente → Ausente → Presente`, confirmada tras cada recarga.
- SIN DUPLICADOS: PASS. La interfaz conserva una sola fila de Alex y el estado final es `Presente`.
- ADMIN VE MISMO REGISTRO: PASS. `/admin/clases` muestra Alex Alumno Prueba como `Presente` en Conversation Pilot, sin crear otro registro.
- ALUMNO VE: NO APLICA. Por ser una clase futura/programada, `/alumno/clases` la muestra como próxima y no expone todavía estado de asistencia.
- SOLO LECTURA ALUMNO: NO APLICA para asistencia futura; el alumno no dispone de controles de gestión y `/profesor/clases` redirige a `/alumno`.
- PERMISOS: PASS. Profesor en su ámbito, ADMIN global, estudiante sin acceso docente.
- `bash v3/infrastructure/raspberry-pi/health-check.sh`: PASS.

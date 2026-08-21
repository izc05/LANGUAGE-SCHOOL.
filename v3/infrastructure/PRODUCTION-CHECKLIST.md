# Language School V3 · Checklist de producción

No marcar una casilla hasta comprobar el resultado en la Raspberry/host real.

Los puertos de esta lista corresponden a la plantilla actual (`PROXY_URL=127.0.0.1:8083`, `PB_URL=127.0.0.1:8091`). Si se cambian en `/etc/language-school/production.env`, sustituirlos también en las comprobaciones manuales, manteniendo ambos exclusivamente en loopback.

## A. Hardware y sistema

- [ ] Raspberry Pi 4/host Linux ARM64 o amd64 actualizado.
- [ ] Arranque desde SSD principal confirmado.
- [ ] Fuente de alimentación estable.
- [ ] Ethernet operativo.
- [ ] Hora/zona horaria correctas.
- [ ] Usuario de administración con SSH funcional.
- [ ] Disco externo de backup identificado por UUID y montado de forma persistente.

## B. Configuración local

- [ ] `/etc/language-school/production.env` creado desde `.env.example`.
- [ ] El archivo sigue siendo `root:root` y modo `0640`.
- [ ] `PUBLIC_ORIGIN` usa HTTPS y apunta al dominio/subdominio definitivo, no a un placeholder.
- [ ] `PB_URL` y `PROXY_URL` continúan en `127.0.0.1`.
- [ ] `SMTP_ENABLED=true` y host, puerto, remitente, TLS/autenticación y credenciales SMTP corresponden al proveedor real; no quedan placeholders.
- [ ] Ninguna contraseña/token está en el repositorio ni en `VITE_*`.
- [ ] Variables privadas Zoom, si se usan, existen solo en el host según `PRIVATE-VARIABLES.md`.
- [ ] `BACKUP_MOUNT` coincide con un mountpoint real.

## C. PocketBase

- [ ] **Antes de actualizar el piloto existente**, realizar una copia física de su `pb_data`, generar SHA-256, validar el checksum y conservar al menos una copia fuera del SSD principal.
- [ ] Inventariar la base del piloto antes de promoverla: cuentas STUDENT/TEACHER, matrículas, grupos, clases, pagos, contactos y archivos existentes están identificados como reales o de prueba.
- [ ] Si la base piloto contiene fixtures/datos ficticios, NO promoverla como producción: apartar la copia anterior para rollback y preparar una base limpia antes de cargar datos reales.
- [ ] Antes de introducir datos reales verificar explícitamente: **0 STUDENT, 0 TEACHER, 0 matrículas, 0 grupos, 0 clases y 0 `student_payments`**. El contenido estructural/CMS y el banco DRAFT del test de nivel sí pueden existir.
- [ ] `install-pocketbase.sh` finaliza sin errores.
- [ ] SHA-256 de la arquitectura del host verificado.
- [ ] Usuario `languageschool` creado.
- [ ] `/var/lib/language-school/pb_data` pertenece a `languageschool` y no es legible por otros usuarios.
- [ ] `/opt/language-school/pocketbase/pb_migrations` existe y contiene las migraciones de la revisión desplegada.
- [ ] `/opt/language-school/pocketbase/pb_hooks` existe y contiene los hooks server-side de la misma revisión.
- [ ] Tras arrancar PocketBase, `settings.meta.appURL` corresponde exactamente a `PUBLIC_ORIGIN`, de modo que invitaciones y recuperación nunca apunten a localhost ni a `/_/`.
- [ ] Remitente/SMTP de PocketBase configurado y un correo de prueba real recibido antes de activar el acceso MFA de Administración.
- [ ] `migrate.sh` aplica todas las migraciones.
- [ ] Primer superuser creado localmente.
- [ ] Primer ADMIN de aplicación creado.
- [ ] Login ADMIN con contraseña correcta devuelve desafío MFA y no una sesión completa.
- [ ] El ADMIN recibe por correo el código de 6 cifras y puede completar el acceso dentro de su ventana de validez.
- [ ] Código MFA incorrecto o caducado no permite entrar en Administración.
- [ ] Crear temporalmente una invitación STUDENT y una TEACHER, recibir/abrir el enlace real, elegir contraseña propia y confirmar que el token queda usado y no se puede reutilizar.
- [ ] Solicitar recuperación de contraseña de una cuenta temporal, confirmar que el email usa el dominio final, establecer una contraseña nueva y comprobar que la anterior y el token consumido ya no sirven.
- [ ] La solicitud de recuperación con un email no registrado mantiene respuesta pública neutral y no revela si la cuenta existe.
- [ ] `systemctl is-active language-school-pocketbase` = active.
- [ ] `curl http://127.0.0.1:8091/api/health` responde correctamente.

## D. Frontend, Nginx y observabilidad local

- [ ] `install-nginx.sh` supera `nginx -t`.
- [ ] Nginx escucha en `127.0.0.1:8083`.
- [ ] PocketBase escucha en `127.0.0.1:8091`.
- [ ] `deploy-frontend.sh` compila en modo `connected`.
- [ ] Un `PUBLIC_ORIGIN` HTTP/local/placeholder es rechazado por el deploy.
- [ ] `/opt/language-school/frontend/index.html` existe.
- [ ] `http://127.0.0.1:8083/` devuelve la web.
- [ ] `http://127.0.0.1:8083/api/health` devuelve PocketBase.
- [ ] `http://127.0.0.1:8083/_/` NO muestra el panel PocketBase.
- [ ] `health-check.sh` = SUCCESS.
- [ ] `install-health-monitor.sh` instala y habilita `language-school-health.timer`.
- [ ] `systemctl list-timers language-school-health.timer` muestra la siguiente ejecución.
- [ ] `sudo systemctl start language-school-health.service` finaliza correctamente.
- [ ] `journalctl -u language-school-health.service` muestra solo estados técnicos, sin PII ni secretos.
- [ ] Admin → Sistema muestra Backend, Zoom y Test de nivel sin exponer credenciales.

## E. Cloudflare

- [ ] Tunnel creado.
- [ ] Origen configurado exclusivamente a `http://127.0.0.1:8083` (o al `PROXY_URL` loopback configurado).
- [ ] Dominio/subdominio resuelve por HTTPS.
- [ ] Web pública carga por HTTPS.
- [ ] Login ADMIN por HTTPS exige contraseña + código MFA antes de abrir `/admin`.
- [ ] `/api/health` funciona por HTTPS.
- [ ] No hay puertos 8083/8091 abiertos en el router (ni los equivalentes configurados si se cambiaron).
- [ ] PocketBase `/_/` no está publicado.

## F. Seguridad funcional

- [ ] Crear Alumno A y Alumno B mediante el flujo canónico de invitación, nunca fijando su contraseña desde Administración.
- [ ] Crear Profesor A y Profesor B mediante el flujo canónico de invitación, nunca fijando su contraseña desde Administración.
- [ ] Separar cada pareja en grupos distintos.
- [ ] Confirmar aislamiento Alumno A/B.
- [ ] Confirmar aislamiento Profesor A/B.
- [ ] Confirmar que STUDENT y TEACHER siguen accediendo con su flujo normal y que OTP no funciona como login alternativo para esos roles.
- [ ] Confirmar que un ADMIN no obtiene token válido mediante contraseña solamente ni accediendo directamente a `/admin`.
- [ ] Confirmar que una sesión ADMIN no puede crear directamente un usuario con contraseña ni modificar la contraseña/`verified` de STUDENT o TEACHER.
- [ ] Probar archivo privado + token protegido.
- [ ] Pausar matrícula y confirmar revocación inmediata del profesor.
- [ ] Probar rechazo de asistencia fuera del grupo.
- [ ] Verificar reglas Cloudflare de bots/rate limiting previstas en FASE 9.3.

## G. Backup

- [ ] Disco externo aparece como mountpoint real.
- [ ] `install-backup.sh` habilita el timer.
- [ ] Primera copia manual finaliza correctamente.
- [ ] Archivo `.tar.gz` existe en el disco externo.
- [ ] Archivo `.sha256` existe y valida.
- [ ] `systemctl list-timers language-school-backup.timer` muestra siguiente ejecución.
- [ ] Desmontar/simular ausencia del disco confirma que el backup FALLA en vez de escribir en SSD.

## H. Restore

- [ ] Crear datos de prueba después de un backup.
- [ ] Ejecutar `restore.sh` con una copia conocida.
- [ ] PocketBase vuelve a `active`.
- [ ] `/api/health` responde.
- [ ] Los datos vuelven al estado de la copia.
- [ ] Se conserva temporalmente `pb_data.before-restore-*` hasta verificar todo.

## I. Integraciones reales

- [ ] Zoom Server-to-Server OAuth configurado y verificado desde Admin, si se activa.
- [ ] Zoom Meeting SDK configurado y verificado desde Admin, si se activa.
- [ ] Crear una clase ONLINE/HYBRID de prueba y generar su reunión desde Admin → Aula online.
- [ ] Confirmar que el enlace de participante queda asociado a la clase sin exponer el enlace de anfitrión.
- [ ] Entrar como alumno con matrícula ACTIVE desde Mis clases → Aula online y completar una unión real con cámara/micrófono.
- [ ] Confirmar que un alumno de otro grupo no puede abrir el contenido de la clase ni obtener firma Meeting SDK.
- [ ] Confirmar por HTTPS que `Permissions-Policy` habilita cámara/micrófono únicamente en `/alumno/aula/...` y los bloquea en el resto de la web.
- [ ] Salir del aula y confirmar retorno a `/alumno/clases` con cámara/micrófono de nuevo bloqueados para el documento normal.
- [ ] Probar también el fallback `Abrir con Zoom` cuando el SDK no pueda cargarse o el navegador no sea compatible.
- [ ] Ningún secreto Zoom aparece en navegador, logs evitables o CMS.
- [ ] Audios Listening académicos definitivos cargados antes de publicar la versión real del test con Listening.
- [ ] Reproducir una pregunta Listening real como visitante y como alumno, verificando que transcripción y answer key no aparecen en el cliente.

## J. Piloto

- [ ] 2–3 alumnos reales de prueba.
- [ ] 1–2 profesores de prueba.
- [ ] Flujo ADMIN completo, incluido MFA por correo en un navegador/sesión nueva.
- [ ] Flujo PROFESOR completo.
- [ ] Flujo ALUMNO completo.
- [ ] Test de nivel público y Campus.
- [ ] Prueba móvil.
- [ ] Subida/descarga de PDF, Word, imagen y audio.
- [ ] Tarea → entrega → corrección.
- [ ] Clase → asistencia.
- [ ] Backup nocturno observado al menos una vez.

## Criterio final

La V3 solo sustituye la web anterior cuando A–I estén verificadas en el entorno real y el piloto J no tenga incidencias críticas.

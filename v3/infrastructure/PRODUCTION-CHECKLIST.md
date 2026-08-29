# Language School V3 · Checklist de producción

No marcar una casilla hasta comprobar el resultado en la Raspberry real.

## A. Hardware y sistema

- [ ] Raspberry Pi 4 con sistema ARM64 actualizado.
- [ ] Arranque desde SSD principal confirmado.
- [ ] Fuente de alimentación estable.
- [ ] Ethernet operativo.
- [ ] Hora/zona horaria correctas.
- [ ] Usuario de administración con SSH funcional.
- [ ] Disco externo de backup identificado por UUID y montado de forma persistente.

## B. Configuración local

- [ ] `/etc/language-school/production.env` creado desde `.env.example`.
- [ ] `PUBLIC_ORIGIN` apunta al dominio/subdominio definitivo.
- [ ] Ninguna contraseña/token está en el repositorio.
- [ ] `BACKUP_MOUNT` coincide con un mountpoint real.

## C. PocketBase

- [ ] `install-pocketbase.sh` finaliza sin errores.
- [ ] SHA-256 ARM64 verificado.
- [ ] Usuario `languageschool` creado.
- [ ] `/var/lib/language-school/pb_data` pertenece a `languageschool` y no es legible por otros usuarios.
- [ ] `migrate.sh` aplica todas las migraciones.
- [ ] Primer superuser creado localmente.
- [ ] Primer ADMIN de aplicación creado.
- [ ] `systemctl is-active language-school-pocketbase` = active.
- [ ] `curl http://127.0.0.1:8090/api/health` responde correctamente.

## D. Frontend y Nginx

- [ ] `install-nginx.sh` supera `nginx -t`.
- [ ] Nginx escucha en `127.0.0.1:8080`.
- [ ] PocketBase escucha en `127.0.0.1:8090`.
- [ ] `deploy-frontend.sh` compila en modo `connected`.
- [ ] `/opt/language-school/frontend/index.html` existe.
- [ ] `http://127.0.0.1:8080/` devuelve la web.
- [ ] `http://127.0.0.1:8080/api/health` devuelve PocketBase.
- [ ] `http://127.0.0.1:8080/_/` NO muestra el panel PocketBase.
- [ ] `health-check.sh` = SUCCESS.

## E. Cloudflare

- [ ] Tunnel creado.
- [ ] Origen configurado exclusivamente a `http://127.0.0.1:8080`.
- [ ] Dominio/subdominio resuelve por HTTPS.
- [ ] Web pública carga por HTTPS.
- [ ] Login ADMIN funciona por HTTPS.
- [ ] `/api/health` funciona por HTTPS.
- [ ] No hay puertos 8080/8090 abiertos en el router.
- [ ] PocketBase `/_/` no está publicado.

## F. Seguridad funcional

- [ ] Crear Alumno A y Alumno B.
- [ ] Crear Profesor A y Profesor B.
- [ ] Separar cada pareja en grupos distintos.
- [ ] Confirmar aislamiento Alumno A/B.
- [ ] Confirmar aislamiento Profesor A/B.
- [ ] Probar archivo privado + token protegido.
- [ ] Pausar matrícula y confirmar revocación inmediata del profesor.
- [ ] Probar rechazo de asistencia fuera del grupo.

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

## I. Piloto

- [ ] 2–3 alumnos reales de prueba.
- [ ] 1–2 profesores de prueba.
- [ ] Flujo ADMIN completo.
- [ ] Flujo PROFESOR completo.
- [ ] Flujo ALUMNO completo.
- [ ] Prueba móvil.
- [ ] Subida/descarga de PDF, Word, imagen y audio.
- [ ] Tarea → entrega → corrección.
- [ ] Clase → asistencia.
- [ ] Backup nocturno observado al menos una vez.

## Criterio final

La V3 solo sustituye la web anterior cuando todas las secciones A–H estén verificadas y el piloto I no tenga incidencias críticas.

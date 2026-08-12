# Language School V3 · Registro de ejecución

Este archivo es la **fuente de verdad** del desarrollo. Cada bloque se marca por fase, cambios realizados, validación y siguiente destino.

## Estado global
- Repositorio: `izc05/LANGUAGE-SCHOOL.`
- Rama: `feat/v3-platform-structure`
- PR: `#2`
- V3: `v3/`
- Frontend: React + TypeScript + Vite
- Backend: PocketBase `0.39.9`
- Producción prevista: Raspberry Pi 4 + SSD + disco externo de backup
- Frente activo: **FASE 9.2 · Raspberry Pi 4 + SSD**
- Bloqueo actual: ejecución física pendiente de disponer de la Raspberry/SSD delante.

### Estados
- ✅ COMPLETADA = implementada y validada.
- 🟡 EN CURSO = desarrollo/validación activa.
- ⏳ PENDIENTE = planificada.
- 🔒 BLOQUEADA = requiere hardware/dominio/decisión externa.

---

## FASE 0 · Arquitectura V3 — ✅ COMPLETADA
- `v3/frontend`, `v3/pocketbase`, `v3/infrastructure`, `v3/docs`.
- Web anterior intacta.
- Secretos, `.env`, `pb_data`, backups y datos privados fuera de GitHub.

## FASE 1 · Frontend público y portales — ✅ COMPLETADA
- `/`, `/blog`, `/acceso`, `/alumno`, `/profesor`, `/admin`.
- Responsive + GitHub Actions.

## FASE 2 · CMS y gestión académica visual — ✅ COMPLETADA
- ADMIN visual para Web, Multimedia, Blog, Alumnos, Profesores, Cursos y Clases.

## FASE 3 · Fundación PocketBase — ✅ COMPLETADA Y REVALIDADA

### Migraciones
1. `1786561920_create_identity_and_courses.js`
2. `1786562400_create_academic_core.js`
3. `1786563000_create_public_cms.js`
4. `1786563300_seed_blog_categories.js`
5. `1786563600_create_student_learning_core.js`
6. `1786563900_expand_teacher_student_scope.js`
7. `1786564200_tighten_teacher_authoring_scope.js`
8. `1786564500_allow_teacher_student_file_read.js`
9. `1786564800_tighten_teacher_attendance_scope.js`

### Correcciones de fundación descubiertas por CI real
- Migración 1 personaliza la colección `users` incorporada por PocketBase; no crea ni elimina otra `users`.
- Colecciones base con timestamps declaran `created` y `updated` como `autodate`.
- CI inspecciona la salida real de `migrate up`/rollback y falla ante errores impresos.
- CI levanta PocketBase 0.39.9 real y comprueba `/api/health`.

Validación:
- fresh database + todas las migraciones ✅
- arranque PocketBase real ✅
- rollback última migración ✅

## FASE 4 · CMS real ↔ PocketBase — ✅ COMPLETADA
- Home, editor, multimedia y blog conectados.
- Frontend CI ✅

## FASE 5 · Autenticación — ✅ COMPLETADA
- Login, refresh, cuenta `ACTIVE`, guards, redirección por rol y logout.
- Frontend CI ✅

---

## FASE 6 · Alumno real — ✅ COMPLETADA Y VALIDADA A/B
- `studentPortal.ts`.
- `/alumno`, `/alumno/archivos`, `/alumno/material`, `/alumno/tareas`, `/alumno/clases`, `/alumno/avisos`.
- Archivos privados protegidos.
- Frontend CI ✅

### 6.7 Prueba A/B — ✅ COMPLETADA EN POCKETBASE REAL TEMPORAL
`security-isolation-smoke.sh` demuestra:
- Alumno A puede leer su matrícula y no la de B.
- Alumno A no puede leer usuario/grupo/archivo de B.
- conocer IDs ajenos no concede acceso.
- Alumno A descarga su archivo protegido con token.
- Alumno B no puede descargar el archivo protegido de A.

---

## FASE 7 · Profesor real — ✅ COMPLETADA Y VALIDADA A/B

### 7.1–7.5 — ✅ COMPLETADAS
- `teacherPortal.ts`, `teacherStudents.ts`, `teacherClasses.ts`.
- `/profesor`, `/profesor/alumnos`, `/profesor/clases`, `/profesor/material`, `/profesor/tareas`, `/profesor/correcciones`.
- Profesor restringido a grupos/alumnos propios.
- Archivos del alumno: solo lectura/descarga con relación académica activa.
- Asistencia: solo alumno `ACTIVE` del grupo de la clase; `class` y `student` inmutables al actualizar.
- Frontend CI ✅

### 7.6 Prueba seguridad profesor — ✅ COMPLETADA EN POCKETBASE REAL TEMPORAL
`security-isolation-smoke.sh` demuestra:
- Profesor A ve Alumno A/Grupo A y no Alumno B/Grupo B.
- Profesor B no ve Alumno A.
- Profesor A relacionado puede descargar archivo protegido de Alumno A.
- Profesor B no puede descargarlo.
- Profesor A puede registrar asistencia de Alumno A en Grupo A.
- Profesor A no puede registrar asistencia de Alumno B fuera del grupo.
- Profesor A no puede publicar material a Alumno B no relacionado.
- al pausar la matrícula A, el profesor pierde inmediatamente lectura y descarga del archivo de A.

Validación conjunta:
- PocketBase CI ✅
- Frontend CI ✅

---

## FASE 8 · Administración académica real — ✅ COMPLETADA Y VALIDADA END-TO-END

### 8.1 Servicios ADMIN — ✅
`adminAcademic.ts`: usuarios, perfiles, cursos, grupos, matrículas, clases y asistencia.

### 8.2 Alumnos y profesores — ✅
- `/admin/alumnos`: alta cuenta+perfil, activar/desactivar, curso/grupo/profesor/próxima clase reales.
- `/admin/profesores`: alta cuenta+perfil, activar/desactivar, grupos/alumnos/clases reales.

### 8.3 Cursos, grupos y matrículas — ✅
- `/admin/cursos` real.
- curso/visibilidad/archivo-reactivación.
- grupo con profesor, año, horario y capacidad.
- matrícula/reactivación/pausa/finalización/cancelación.
- ocupación desde matrículas `ACTIVE`.

### 8.4 Calendario y asistencia ADMIN — ✅
- `/admin/clases` real.
- calendario semanal, filtros profesor/grupo, programación, estados y asistencia global.

### 8.5 Validación ADMIN — ✅
`admin-flow-smoke.sh` ejecuta sobre PocketBase real temporal:
`superuser temporal → ADMIN aplicación → login ADMIN → profesor+perfil → alumno+perfil → curso → grupo → matrícula → clase → asistencia`.

Resultado:
- flujo ADMIN completo ✅
- reglas ADMIN reales ✅
- servidor PocketBase real ✅
- Frontend CI ✅

---

## FASE 9 · Raspberry Pi 4 y producción — 🟡 EN CURSO

### 9.1 Paquete reproducible de producción — ✅ COMPLETADA Y VALIDADA

Arquitectura fijada:
`Internet → Cloudflare Tunnel → 127.0.0.1:8080 Nginx → React + /api/* → 127.0.0.1:8090 PocketBase`.

Paquete creado en `v3/infrastructure/`:

#### Configuración
- `.env.example` sin secretos.
- `PUBLIC_ORIGIN` para compilar frontend conectado.
- PocketBase 0.39.9 ARM64 fijado.
- SHA-256 oficial fijado y comprobado en CI.

#### Raspberry/PocketBase
- `raspberry-pi/prepare-production-env.sh`.
- `raspberry-pi/install-pocketbase.sh`.
- `raspberry-pi/language-school-pocketbase.service` endurecido con systemd.
- `raspberry-pi/migrate.sh` con detección explícita de errores de migración.
- `raspberry-pi/bootstrap-admin.sh` interactivo: superuser local + primer ADMIN de aplicación, sin guardar contraseñas.
- `raspberry-pi/deploy-frontend.sh`.
- `raspberry-pi/health-check.sh`.

#### Reverse proxy
- `reverse-proxy/language-school.nginx.conf`.
- `reverse-proxy/install-nginx.sh`.
- Nginx escucha solo en `127.0.0.1:8080`.
- PocketBase escucha solo en `127.0.0.1:8090`.
- Solo `/api/*` se reenvía a PocketBase; `/_/` no se publica.

#### Cloudflare
- `cloudflare/README.md`.
- `cloudflare/config.yml.example` sin credenciales.
- origen fijado a `http://127.0.0.1:8080`.
- catch-all final `http_status:404`.

#### Backup/restore
- `backups/backup.sh`: aborta si el disco configurado no es un mountpoint real, detiene PocketBase, crea tar consistente, SHA-256, retención y reinicia servicio.
- `backups/restore.sh`: exige checksum, conserva estado previo y hace rollback automático si PocketBase no vuelve sano.
- `backups/install-backup.sh`.
- `backups/language-school-backup.service`.
- `backups/language-school-backup.timer`: diario 03:30 con retraso aleatorio máximo de 15 min.

#### Documentación
- `infrastructure/README.md`: runbook exacto de instalación y actualización.
- `infrastructure/PRODUCTION-CHECKLIST.md`: verificación física antes de sustituir la web anterior.

#### V3 Infrastructure CI
Nuevo workflow `.github/workflows/v3-infrastructure-ci.yml` valida:
- sintaxis de todos los scripts Bash.
- ausencia de claves tipo password/token/secret en `.env.example`.
- descarga y SHA-256 real del ZIP ARM64 oficial de PocketBase 0.39.9.
- sintaxis Nginx mediante `nginx -t`.
- catch-all de Cloudflare.
- calendario systemd del backup.

Validación conjunta al cierre de 9.1:
- V3 Infrastructure CI ✅
- V3 PocketBase CI ✅
- V3 Frontend CI ✅

### 9.2 Raspberry + SSD — 🔒 PENDIENTE DE HARDWARE
Siguiente ejecución física:
1. instalar sistema ARM64 en SSD;
2. confirmar boot desde SSD;
3. configurar usuario, SSH, hostname y red;
4. clonar/actualizar repositorio;
5. aplicar el paquete 9.1 siguiendo `infrastructure/README.md` y `PRODUCTION-CHECKLIST.md`.

### 9.3 HTTPS / acceso exterior — ⏳ PENDIENTE DE 9.2
- crear/conectar Cloudflare Tunnel.
- dominio/subdominio definitivo.
- validar HTTPS y `/api/health` exterior.
- confirmar que `/_/` no está publicado.

### 9.4 Backup/restore físico — ⏳ PENDIENTE DE 9.2
- montar disco externo por UUID.
- primera copia manual.
- habilitar timer.
- prueba real de ausencia del disco.
- prueba real de restauración.

## FASE 10 · Piloto y endurecimiento — ⏳ PENDIENTE
- 2–3 alumnos.
- pruebas funcionales finales.
- backups/restauración.
- móvil.
- accesibilidad.
- errores/logs.
- piloto controlado.

---

## Dirección del proyecto
`Estructura → Frontend → CMS → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Seguridad A/B → Producción → Raspberry → Piloto`

Cada nueva sesión debe empezar leyendo este archivo y actualizarlo al finalizar cada bloque relevante.

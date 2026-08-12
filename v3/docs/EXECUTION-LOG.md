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
- Frente activo: **FASES 6.7 + 7.6 · Seguridad A/B en PocketBase temporal**
- Hardware: FASE 9 sigue pendiente de SSD/Raspberry, pero ya no bloquea las pruebas de reglas porque CI levanta PocketBase real temporal.

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
- Migración 1 ya **personaliza la colección `users` incorporada por PocketBase**; no intenta crear ni borrar una segunda `users`.
- Las colecciones base declaran `created` y `updated` mediante `autodate` cuando la aplicación los usa para índices/ordenación.
- El workflow ya no acepta falsos positivos: inspecciona la salida de `migrate up`/rollback y falla ante errores impresos por PocketBase.
- CI levanta un servidor PocketBase 0.39.9 real y comprueba `/api/health`.

Validación actual:
- Fresh database + todas las migraciones ✅
- Arranque PocketBase real ✅
- Rollback última migración ✅

## FASE 4 · CMS real ↔ PocketBase — ✅ COMPLETADA
- Home, editor, multimedia y blog conectados.
- Frontend CI ✅

## FASE 5 · Autenticación — ✅ COMPLETADA
- Login, refresh, cuenta `ACTIVE`, guards, redirección por rol y logout.
- Frontend CI ✅

---

## FASE 6 · Alumno real — 🟡 IMPLEMENTACIÓN COMPLETA / SEGURIDAD A/B EN VALIDACIÓN
- `studentPortal.ts`.
- `/alumno`, `/alumno/archivos`, `/alumno/material`, `/alumno/tareas`, `/alumno/clases`, `/alumno/avisos`.
- Archivos privados protegidos.
- Frontend CI ✅

### 6.7 Prueba A/B — 🟡 EN CURSO EN CI
Debe demostrar:
- Alumno A no puede leer usuario, matrícula ni archivo de Alumno B.
- conocer IDs ajenos no concede acceso.
- token de archivo protegido funciona para propietario y falla para alumno ajeno.

---

## FASE 7 · Profesor real — 🟡 IMPLEMENTACIÓN COMPLETA / SEGURIDAD A/B EN VALIDACIÓN

### 7.1–7.5 — ✅ COMPLETADAS
- `teacherPortal.ts`, `teacherStudents.ts`, `teacherClasses.ts`.
- `/profesor`, `/profesor/alumnos`, `/profesor/clases`, `/profesor/material`, `/profesor/tareas`, `/profesor/correcciones`.
- Profesor restringido a grupos/alumnos propios.
- Archivos del alumno: solo lectura/descarga con relación académica activa.
- Asistencia: solo alumno `ACTIVE` del grupo de la clase; `class` y `student` inmutables al actualizar.
- Frontend CI ✅

### 7.6 Prueba seguridad profesor — 🟡 EN CURSO EN CI
Debe demostrar:
- Profesor A no puede leer grupo/alumno/archivo de Profesor B.
- Profesor relacionado sí puede descargar archivo protegido de su alumno.
- Profesor no puede registrar asistencia para alumno fuera del grupo.

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

### 8.5 Validación ADMIN — ✅ COMPLETADA
CI ejecuta sobre PocketBase temporal el flujo real:
`superuser temporal → ADMIN de aplicación → login ADMIN → profesor+perfil → alumno+perfil → curso → grupo → matrícula → clase → asistencia`.

Resultado:
- flujo ADMIN completo ✅
- reglas ADMIN reales ✅
- PocketBase server real ✅
- Frontend CI ✅

---

## FASE 9 · Raspberry Pi 4 y producción — 🔒 PENDIENTE DE HARDWARE
- SSD.
- sistema 64-bit.
- PocketBase ARM64.
- servicio persistente.
- migraciones.
- primer ADMIN.
- frontend.
- HTTPS / Cloudflare.
- backup externo automático.
- prueba de restauración.

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
`Estructura → Frontend → CMS → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Seguridad A/B → Raspberry → Piloto`

Cada nueva sesión debe empezar leyendo este archivo y actualizarlo al finalizar cada bloque relevante.

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
- Frente activo: **FASE 8.5 · Validación del flujo ADMIN**
- Validaciones bloqueadas por servidor físico: **6.7 y 7.6**

### Estados
- ✅ COMPLETADA = implementada y validada en CI.
- 🟡 EN CURSO = desarrollo activo.
- ⏳ PENDIENTE = planificada.
- 🔒 BLOQUEADA = requiere instancia real/hardware/dominio.

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

## FASE 3 · Fundación PocketBase — ✅ COMPLETADA
Migraciones:
1. `1786561920_create_identity_and_courses.js`
2. `1786562400_create_academic_core.js`
3. `1786563000_create_public_cms.js`
4. `1786563300_seed_blog_categories.js`

Seguridad base: roles `ADMIN`, `TEACHER`, `STUDENT`, denegación por defecto, archivos protegidos y superuser fuera del navegador.

## FASE 4 · CMS real ↔ PocketBase — ✅ COMPLETADA
- Home, editor, multimedia y blog conectados.
- Frontend CI ✅
- PocketBase CI ✅

## FASE 5 · Autenticación — ✅ COMPLETADA
- Login, refresh, cuenta `ACTIVE`, guards, redirección por rol y logout.
- Frontend CI ✅
- PocketBase CI ✅

---

## FASE 6 · Alumno real — 🟡 IMPLEMENTACIÓN TERMINADA / PRUEBA REAL PENDIENTE
- Migración 5 `1786563600_create_student_learning_core.js`.
- `studentPortal.ts`.
- `/alumno`, `/alumno/archivos`, `/alumno/material`, `/alumno/tareas`, `/alumno/clases`, `/alumno/avisos`.
- Frontend CI ✅
- PocketBase CI ✅

### 6.7 Prueba A/B — 🔒 BLOQUEADA
Demostrar aislamiento Alumno A/Alumno B y descargas protegidas reales.

---

## FASE 7 · Profesor real — 🟡 IMPLEMENTACIÓN TERMINADA / PRUEBA REAL PENDIENTE

### 7.1 — ✅
Migración 6 `1786563900_expand_teacher_student_scope.js` + `teacherPortal.ts`.

### 7.2 — ✅
Dashboard `/profesor` real.

### 7.3 — ✅
Migración 7 `1786564200_tighten_teacher_authoring_scope.js`.
- `/profesor/material`
- `/profesor/tareas`
- `/profesor/correcciones`

### 7.4 — ✅
Migración 8 `1786564500_allow_teacher_student_file_read.js` + `teacherStudents.ts`.
- `/profesor/alumnos`
- archivos alumno solo lectura/descarga para profesor relacionado.

### 7.5 — ✅
Migración 9 `1786564800_tighten_teacher_attendance_scope.js` + `teacherClasses.ts`.
- `/profesor/clases`
- crear clase en grupo propio.
- completar/cancelar/reabrir.
- asistencia solo de alumnos `ACTIVE` del grupo.
- `class` y `student` inmutables al actualizar asistencia.
- Frontend CI ✅
- PocketBase CI ✅

### 7.6 Prueba seguridad profesor — 🔒 BLOQUEADA
Demostrar aislamiento Profesor A/Profesor B y rechazo de accesos fuera de relación académica.

---

## FASE 8 · Administración académica real — 🟡 EN CURSO

### 8.1 Servicios ADMIN — ✅ COMPLETADA
`adminAcademic.ts` centraliza usuarios, perfiles, cursos, grupos, matrículas, clases y asistencia.
- Frontend CI ✅
- PocketBase CI ✅

### 8.2 Alumnos y profesores — ✅ COMPLETADA

`/admin/alumnos`
- usuarios `STUDENT` reales.
- alta cuenta + perfil.
- activar/desactivar.
- grupo, curso, profesor y próxima clase desde relaciones reales.

`/admin/profesores`
- usuarios `TEACHER` reales.
- alta cuenta + perfil.
- activar/desactivar.
- grupos, alumnos relacionados y clases reales.

Validación:
- Frontend CI ✅
- PocketBase CI ✅

### 8.3 Cursos, grupos y matrículas — ✅ COMPLETADA

`/admin/cursos`
- cursos reales desde PocketBase.
- alta de curso y visibilidad pública/privada.
- archivar/reactivar curso.
- grupos reales con curso, profesor, año, horario y capacidad.
- alta de grupo con profesor asignado.
- pausar/reactivar grupo.
- matrícula alumno → grupo.
- si la relación alumno/grupo ya existía, se reactiva el registro histórico en lugar de duplicarlo.
- pausar/reactivar/finalizar/cancelar matrícula.
- ocupación global y por curso/grupo calculada desde matrículas `ACTIVE`.
- modo demo preservado.

Validación:
- Frontend CI ✅
- PocketBase CI ✅

### 8.4 Calendario y asistencia ADMIN — ✅ COMPLETADA

`/admin/clases`
- clases globales reales.
- calendario semanal de 7 días.
- navegación semana anterior/hoy/siguiente.
- filtros por profesor y grupo.
- programación de clase con profesor derivado del grupo.
- métricas de semana, hoy, pendientes y horas docentes.
- seleccionar clase.
- completar/cancelar/reabrir.
- alumnos con matrícula `ACTIVE` del grupo.
- registrar/corregir asistencia Presente/Ausente/Justificada.

Validación:
- Frontend CI ✅
- PocketBase CI ✅

### 8.5 Validación ADMIN — 🟡 EN CURSO
Objetivo: comprobar el flujo completo `alta alumno/profesor → curso → grupo → matrícula → clase → asistencia` antes de llegar a la Raspberry.

---

## FASE 9 · Raspberry Pi 4 y producción — 🔒 BLOQUEADA POR HARDWARE
- SSD, sistema 64-bit, PocketBase ARM64, servicio persistente, migraciones, primer ADMIN, frontend, HTTPS/Cloudflare, backup automático y restore.

## FASE 10 · Piloto y endurecimiento — ⏳ PENDIENTE
- 2–3 alumnos.
- pruebas A/B.
- backups/restauración.
- móvil.
- accesibilidad.
- errores/logs.
- piloto controlado.

---

## Dirección del proyecto
`Estructura → Frontend → CMS → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Raspberry → Piloto`

Cada nueva sesión debe empezar leyendo este archivo y actualizarlo al finalizar cada bloque relevante.

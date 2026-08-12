# Language School V3 · Registro de ejecución

Este archivo es la **fuente de verdad** del desarrollo. Cada bloque se marca por fase, cambios realizados, validación y siguiente destino.

## Estado global

- Repositorio: `izc05/LANGUAGE-SCHOOL.`
- Rama de trabajo: `feat/v3-platform-structure`
- PR activa: `#2`
- V3 aislada en: `v3/`
- Frontend: React + TypeScript + Vite
- Backend objetivo: PocketBase `0.39.9`
- Producción: Raspberry Pi 4 + SSD + disco externo de backup
- Frente activo: **FASE 8.1 · Servicios de administración académica**
- Validaciones bloqueadas por servidor físico: **6.7 y 7.6**

### Estados
- ✅ COMPLETADA = implementada y validada en CI.
- 🟡 EN CURSO = desarrollo activo.
- ⏳ PENDIENTE = planificada.
- 🔒 BLOQUEADA = requiere instancia real/hardware/dominio.

---

## FASE 0 · Arquitectura y separación V3 — ✅ COMPLETADA

- `v3/frontend`
- `v3/pocketbase`
- `v3/infrastructure`
- `v3/docs`
- La web antigua permanece intacta.
- `.env`, `pb_data`, secretos, backups y datos privados fuera de GitHub.

---

## FASE 1 · Frontend público y portales — ✅ COMPLETADA

- `/` Home
- `/blog`
- `/acceso`
- `/alumno`
- `/profesor`
- `/admin`
- Diseño responsive.
- GitHub Actions para compilar el frontend.

---

## FASE 2 · CMS y gestión académica visual — ✅ COMPLETADA

ADMIN visual para Web/portada, Multimedia, Blog, Alumnos, Profesores, Cursos y Clases/calendario.

---

## FASE 3 · Fundación PocketBase — ✅ COMPLETADA

### Migraciones base
1. `1786561920_create_identity_and_courses.js` → `users`, `student_profiles`, `teacher_profiles`, `courses`
2. `1786562400_create_academic_core.js` → `groups`, `enrollments`, `classes`, `student_files`
3. `1786563000_create_public_cms.js` → CMS público y configuración
4. `1786563300_seed_blog_categories.js` → categorías iniciales

### Base de seguridad
- Roles `ADMIN`, `TEACHER`, `STUDENT`.
- Denegar por defecto y abrir solo lo necesario.
- Archivos privados protegidos.
- Nunca usar superuser desde el navegador.
- PocketBase CI ejecuta `migrate up` + rollback.

---

## FASE 4 · CMS real ↔ PocketBase — ✅ COMPLETADA

- `site_pages`, `media_library`, `blog_posts` conectados.
- Home pública y editor ADMIN.
- Multimedia real.
- Blog con borradores/publicación, categorías e imágenes.
- Frontend CI ✅
- PocketBase CI ✅

---

## FASE 5 · Autenticación y portales privados — ✅ COMPLETADA

- `authWithPassword`.
- refresh de sesión.
- solo cuentas `ACTIVE`.
- guards por rol.
- redirección ADMIN/TEACHER/STUDENT.
- usuario/rol real en cabecera.
- logout.
- modo demo preservado.
- Frontend CI ✅
- PocketBase CI ✅

---

## FASE 6 · Alumno real — 🟡 IMPLEMENTACIÓN TERMINADA / PRUEBA REAL PENDIENTE

### 6.1 Backend alumno — ✅
Migración 5 · `1786563600_create_student_learning_core.js`
- acceso por matrícula `ACTIVE`
- `attendance`, `materials`, `assignments`, `assignment_submissions`, `notifications`
- archivos protegidos

### 6.2 Servicios alumno — ✅
`studentPortal.ts`: perfil, matrículas, clases, asistencia, archivos, material, tareas, entregas, avisos y tokens temporales.

### 6.3–6.6 Portal alumno — ✅
- `/alumno`
- `/alumno/archivos`
- `/alumno/material`
- `/alumno/tareas`
- `/alumno/clases`
- `/alumno/avisos`

### 6.7 Prueba A/B — 🔒 BLOQUEADA HASTA INSTANCIA REAL
Debe demostrar aislamiento Alumno A/Alumno B y validez real de tokens protegidos.

---

## FASE 7 · Profesor real — 🟡 IMPLEMENTACIÓN TERMINADA / PRUEBA REAL PENDIENTE

### 7.1 Backend y servicios profesor — ✅ COMPLETADA
Migración 6 · `1786563900_expand_teacher_student_scope.js`
- profesor solo accede a alumnos de matrículas `ACTIVE` en grupos propios.
- `teacherPortal.ts` centraliza grupos, alumnos, clases, material, tareas y entregas.

### 7.2 Dashboard profesor — ✅ COMPLETADA
`/profesor`: alumnos, grupos, agenda, entregas y material.

### 7.3 Material, tareas y correcciones — ✅ COMPLETADA
Migración 7 · `1786564200_tighten_teacher_authoring_scope.js`
- autoría restringida a grupos/alumnos propios.
- `/profesor/material`
- `/profesor/tareas`
- `/profesor/correcciones`
- Frontend CI ✅
- PocketBase CI ✅

### 7.4 Alumnos y archivos autorizados — ✅ COMPLETADA
Migración 8 · `1786564500_allow_teacher_student_file_read.js`
- `student_files` solo lectura para profesor con matrícula activa relacionada.
- `teacherStudents.ts` verifica ámbito antes de consultar.
- `/profesor/alumnos` con ficha y descarga protegida.
- Frontend CI ✅
- PocketBase CI ✅

### 7.5 Clases y asistencia del profesor — ✅ COMPLETADA

Migración 9 · `1786564800_tighten_teacher_attendance_scope.js`
- asistencia TEACHER solo si la clase pertenece al profesor.
- el alumno debe tener matrícula `ACTIVE` en el grupo de esa clase.
- `class` y `student` no pueden cambiarse al actualizar asistencia.

`teacherClasses.ts`
- listar agenda propia.
- crear clase solo en grupo propio.
- cambiar estado de clase propia.
- listar alumnos activos del grupo.
- listar asistencia.
- crear/actualizar asistencia.

`/profesor/clases`
- programar clase.
- agenda.
- completar/cancelar/reabrir.
- registrar Presente/Ausente/Justificada.
- responsive.

Validación final:
- Frontend CI ✅
- PocketBase CI ✅

### 7.6 Validación seguridad profesor — 🔒 BLOQUEADA HASTA INSTANCIA REAL
Debe demostrar aislamiento Profesor A/Profesor B, archivos protegidos y rechazo real de asistencia fuera de grupo.

---

## FASE 8 · Administración académica real — 🟡 EN CURSO

### 8.1 Servicios de administración académica — 🟡 EN CURSO
Objetivo:
- usuarios/alumnos/profesores.
- perfiles.
- cursos.
- grupos.
- matrículas.
- clases.
- asistencia.
- operaciones ADMIN centralizadas y auditables desde un servicio frontend.

### 8.2 Alumnos y profesores — ⏳ PENDIENTE
- alta.
- edición.
- activar/inactivar/suspender.
- perfiles relacionados.

### 8.3 Cursos, grupos y matrículas — ⏳ PENDIENTE
- CRUD cursos.
- CRUD grupos.
- asignar profesor.
- matricular alumno.
- estados e histórico.

### 8.4 Calendario y asistencia ADMIN — ⏳ PENDIENTE
- clases globales.
- filtros por profesor/grupo.
- asistencia y revisión.

### 8.5 Validación ADMIN — ⏳ PENDIENTE
- flujos completos de alta → grupo → matrícula → clase → asistencia.

---

## FASE 9 · Raspberry Pi 4 y producción — 🔒 BLOQUEADA POR HARDWARE

- SSD.
- sistema 64-bit.
- PocketBase ARM64.
- servicio persistente.
- migraciones.
- superuser local.
- primer ADMIN.
- frontend.
- HTTPS / Cloudflare.
- backup externo automático.
- prueba de restauración.

---

## FASE 10 · Piloto y endurecimiento — ⏳ PENDIENTE

- 2–3 alumnos de prueba.
- pruebas A/B.
- límites.
- backups/restauración.
- móvil.
- accesibilidad.
- errores/logs.
- prueba pública controlada.

---

## Dirección del proyecto

`Estructura → Frontend → CMS visual → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Raspberry → Piloto`

Cuando una validación dependa únicamente de la instancia física, se puede avanzar en implementación sin declarar esa validación como cerrada.

Cada nueva sesión debe empezar leyendo este archivo y actualizarlo al finalizar cada bloque relevante.

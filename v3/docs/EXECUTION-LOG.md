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
- Frente activo: **FASE 7.4 · Alumnos y archivos autorizados para profesor**
- Validaciones bloqueadas por servidor físico: **6.7 y 7.5**

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

ADMIN visual para:
- Web/portada
- Multimedia
- Blog
- Alumnos
- Profesores
- Cursos
- Clases/calendario

---

## FASE 3 · Fundación PocketBase — ✅ COMPLETADA

### Migración 1 · `1786561920_create_identity_and_courses.js`
- `users`
- `student_profiles`
- `teacher_profiles`
- `courses`

### Migración 2 · `1786562400_create_academic_core.js`
- `groups`
- `enrollments`
- `classes`
- `student_files`

### Migración 3 · `1786563000_create_public_cms.js`
- `blog_categories`
- `blog_posts`
- `media_library`
- `site_pages`
- `pricing_plans`
- `site_settings`
- `contact_requests`

### Migración 4 · `1786563300_seed_blog_categories.js`
- Speaking
- Vocabulary
- Grammar
- Exams
- Kids
- Academia

### Base de seguridad
- Roles `ADMIN`, `TEACHER`, `STUDENT`.
- Denegar por defecto y abrir solo lo necesario.
- Archivos privados protegidos.
- Nunca usar superuser desde el navegador.
- PocketBase CI ejecuta `migrate up` + rollback.

---

## FASE 4 · CMS real ↔ PocketBase — ✅ COMPLETADA

### 4.1 Servicios CMS
- `site_pages`
- `media_library`
- `blog_posts`

### 4.2 Home pública
- Lee `site_pages.home` en modo connected.
- Fallback seguro en demo/caída del backend.

### 4.3 Editor Home
- cargar
- guardar borrador
- publicar
- preview

### 4.4 Multimedia
- listar
- subir
- borrar
- seleccionar recurso existente
- vincular imagen a portada mediante `mediaId`

### 4.5 Blog
- listado público solo `PUBLISHED`
- crear/editar/eliminar
- borrador/publicación
- categorías
- imagen de portada

### Validación
- Frontend CI ✅
- PocketBase CI ✅

---

## FASE 5 · Autenticación y portales privados — ✅ COMPLETADA

### 5.1 Login/sesión
- `authWithPassword`
- refresh
- cuenta `ACTIVE` obligatoria
- sesión inactiva/suspendida invalidada

### 5.2 Guards
- ADMIN → `/admin`
- TEACHER → `/profesor`
- STUDENT → `/alumno`
- `RequireRole`

### 5.3 Logout/UI
- usuario real en cabecera
- rol real
- logout
- modo demo preservado

### Validación
- Frontend CI ✅
- PocketBase CI ✅

---

## FASE 6 · Alumno real — 🟡 IMPLEMENTACIÓN TERMINADA / PRUEBA REAL PENDIENTE

### 6.1 Backend alumno — ✅

Migración 5 · `1786563600_create_student_learning_core.js`
- acceso a grupo/curso por matrícula `ACTIVE`
- `attendance`
- `materials`
- `assignments`
- `assignment_submissions`
- `notifications`
- archivos/adjuntos protegidos
- tareas DRAFT ocultas al alumno
- feedback/calificación no editables por alumno

PocketBase CI ✅

### 6.2 Servicios alumno — ✅

`studentPortal.ts`
- perfil
- matrículas
- grupos/curso
- clases
- asistencia
- archivos
- material
- tareas
- entregas
- avisos
- tokens temporales de archivos protegidos

Principio: las operaciones propias derivan el alumno desde la sesión, no reciben un `studentId` arbitrario.

Frontend CI ✅

### 6.3 Dashboard alumno — ✅

`/alumno`
- próxima clase
- nivel
- contadores
- tareas
- material
- archivos
- avisos

### 6.4 Mis archivos — ✅

`/alumno/archivos`
- listar/buscar
- subir
- 20 MB
- archivar
- descarga protegida

### 6.5 Material/Tareas/Entregas — ✅

`/alumno/material`
- material autorizado
- filtros
- descarga protegida

`/alumno/tareas`
- pendiente/entregada/corregida
- texto + archivo
- adjuntos protegidos
- feedback/calificación
- índice único contra doble entrega

### 6.6 Clases/Avisos — ✅

`/alumno/clases`
- próximas
- histórico
- grupo/curso
- asistencia

`/alumno/avisos`
- todos/sin leer
- marcar leído

### 6.7 Prueba A/B — 🔒 BLOQUEADA HASTA INSTANCIA REAL

Debe demostrar:
- Alumno A no puede leer datos/archivos de Alumno B.
- conocer un ID no concede acceso.
- tokens de archivo siguen la `viewRule`.

---

## FASE 7 · Profesor real — 🟡 EN CURSO

### 7.1 Backend y servicios profesor — ✅ COMPLETADA

Migración 6 · `1786563900_expand_teacher_student_scope.js`
- TEACHER puede leer únicamente usuarios STUDENT de matrículas `ACTIVE` pertenecientes a grupos propios.
- mismo límite para `student_profiles`.

`teacherPortal.ts`
- perfil profesor
- grupos propios
- matrículas/alumnos autorizados
- clases propias
- material propio
- tareas propias
- entregas de sus tareas

Principio: las consultas derivan siempre el profesor desde la sesión.

Validación:
- PocketBase CI ✅
- Frontend CI ✅

### 7.2 Dashboard profesor — ✅ COMPLETADA

`/profesor`
- alumnos activos únicos
- grupos
- clases de hoy
- próxima hora
- entregas pendientes
- material reciente
- nombres de alumnos autorizados

`teacherNav.ts` creado para navegación real.

Frontend CI ✅

### 7.3 Material, tareas y correcciones — ✅ COMPLETADA

#### 7.3.1 Seguridad de autoría

Migración 7 · `1786564200_tighten_teacher_authoring_scope.js`

Reglas reforzadas:
- profesor crea clases solo en grupos propios
- profesor no puede retargetear clase a otro grupo al editar
- material TEACHER solo a grupo propio o alumno con matrícula activa del profesor
- material de curso completo queda reservado a ADMIN por ahora
- tarea solo a grupo propio o alumno autorizado
- profesor no puede cambiar propietario/destino de material o tarea después de crear
- feedback/calificación solo sobre entregas de tareas del profesor
- avisos TEACHER solo a alumnos activos de sus grupos

PocketBase CI ✅

#### 7.3.2 Servicios de autoría

`teacherPortal.ts` ampliado:
- `createTeacherMaterial`
- `deleteTeacherMaterial`
- descarga protegida de material
- `createTeacherAssignment`
- cambiar estado tarea
- eliminar tarea
- descargar adjunto tarea
- `reviewTeacherSubmission`
- descargar archivo entregado

#### 7.3.3 Pantallas

`/profesor/material`
- destino grupo/alumno autorizado
- subida protegida
- publicar
- listar/abrir/eliminar

`/profesor/tareas`
- destino grupo/alumno
- instrucciones
- fecha límite
- adjunto
- borrador/publicación
- cerrar/reabrir/eliminar

`/profesor/correcciones`
- entregas autorizadas
- respuesta de alumno
- archivo entregado protegido
- feedback
- calificación
- REVISADA/DEVUELTA

### Validación final 7.3
- V3 Frontend CI ✅
- V3 PocketBase CI ✅

### 7.4 Alumnos y archivos autorizados — 🟡 EN CURSO

Siguiente bloque:
- `/profesor/alumnos`
- lista solo alumnos matriculados en grupos propios
- ficha de alumno
- grupos y datos académicos autorizados
- ampliar `student_files.view/listRule` para TEACHER **solo lectura** si existe matrícula `ACTIVE` en grupo propio
- descargar archivo protegido del alumno mediante token temporal
- profesor NO podrá editar, archivar ni borrar el archivo privado del alumno

### 7.5 Clases del profesor — ⏳ PENDIENTE

`/profesor/clases`
- agenda propia
- crear clase solo en grupo propio
- completar/cancelar
- asistencia de alumnos del grupo

### 7.6 Validación seguridad profesor — 🔒 BLOQUEADA HASTA INSTANCIA REAL

Debe demostrar:
- Profesor A no puede ver grupo/alumno de Profesor B.
- Profesor A no puede descargar archivo de alumno sin relación activa.
- Profesor solo puede crear contenido dentro de su ámbito.

---

## FASE 8 · Administración académica real — ⏳ PENDIENTE

- alta/baja alumnos/profesores
- cursos/grupos
- matrículas
- calendario
- asistencia
- estados/histórico

---

## FASE 9 · Raspberry Pi 4 y producción — 🔒 BLOQUEADA POR HARDWARE

- SSD
- sistema 64-bit
- PocketBase ARM64
- servicio persistente
- migraciones
- superuser local
- primer ADMIN
- frontend
- HTTPS / Cloudflare
- backup externo automático
- prueba de restauración

---

## FASE 10 · Piloto y endurecimiento — ⏳ PENDIENTE

- 2–3 alumnos de prueba
- pruebas A/B
- límites
- backups/restauración
- móvil
- accesibilidad
- errores/logs
- prueba pública controlada

---

## Dirección del proyecto

`Estructura → Frontend → CMS visual → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Raspberry → Piloto`

Cuando una validación dependa únicamente de la instancia física, se puede avanzar en implementación sin declarar esa validación como cerrada.

Cada nueva sesión debe empezar leyendo este archivo y actualizarlo al finalizar cada bloque relevante.
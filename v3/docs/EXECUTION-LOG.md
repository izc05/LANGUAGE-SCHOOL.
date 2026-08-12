# Language School V3 · Registro de ejecución

Este documento es la fuente de verdad del desarrollo de la V3. Cada fase debe dejar constancia de: objetivo, cambios, validación, estado y siguiente paso.

## Estado global

- Repositorio: `izc05/LANGUAGE-SCHOOL.`
- Rama de trabajo: `feat/v3-platform-structure`
- PR activa: `#2`
- Estrategia: V3 aislada en `v3/` hasta validar la sustitución de la web anterior.
- Backend: PocketBase `0.39.9`.
- Frontend: React + TypeScript + Vite.
- Producción prevista: Raspberry Pi 4 + SSD + backup externo.
- Frente activo: `7.1 · Backend y servicios del profesor`.
- Bloqueo conocido: `6.7 · prueba A/B con usuarios reales`, pendiente de instancia PocketBase real.

## Convención de estados

- ✅ COMPLETADA: implementada y validada.
- 🟡 EN CURSO: desarrollo activo o con una validación pendiente.
- ⏳ PENDIENTE: definida, todavía no iniciada.
- 🔒 BLOQUEADA: depende de hardware, dominio, credenciales o decisión externa.

---

## FASE 0 · Arquitectura y separación V3 — ✅ COMPLETADA

V3 aislada en `v3/`, con frontend, PocketBase, infraestructura y documentación separados. Secretos, `.env`, `pb_data`, backups y datos privados quedan fuera de GitHub.

---

## FASE 1 · Frontend público y portales — ✅ COMPLETADA

Aplicación React + TypeScript + Vite con Home, Blog, Acceso, Alumno, Profesor, Admin, diseño responsive y CI de compilación.

---

## FASE 2 · CMS y gestión académica visual — ✅ COMPLETADA

Interfaz ADMIN para Web, Multimedia, Blog, Alumnos, Profesores, Cursos y Clases/Calendario.

---

## FASE 3 · Fundación PocketBase — ✅ COMPLETADA

### Migraciones base
1. `1786561920_create_identity_and_courses.js`
   - `users`, `student_profiles`, `teacher_profiles`, `courses`
2. `1786562400_create_academic_core.js`
   - `groups`, `enrollments`, `classes`, `student_files`
3. `1786563000_create_public_cms.js`
   - `blog_categories`, `blog_posts`, `media_library`, `site_pages`, `pricing_plans`, `site_settings`, `contact_requests`
4. `1786563300_seed_blog_categories.js`
   - categorías iniciales de blog

### Seguridad base
- Roles `ADMIN`, `TEACHER`, `STUDENT`.
- Denegar por defecto y abrir lo mínimo necesario.
- Archivos privados protegidos.
- Superuser fuera del navegador.
- CI aplica migraciones y prueba rollback contra PocketBase `0.39.9`.

---

## FASE 4 · Conexión real CMS ↔ PocketBase — ✅ COMPLETADA

- Portada lee/escribe `site_pages`.
- ADMIN puede guardar borrador/publicar.
- Multimedia real en `media_library`.
- Imagen de Home vinculada por `mediaId` y resuelta en la web pública.
- Blog público lee solo `PUBLISHED`.
- ADMIN crea, edita, publica y elimina artículos.
- Categorías e imágenes de portada reales.
- `V3 Frontend CI`: ✅ success.
- `V3 PocketBase CI`: ✅ success.

---

## FASE 5 · Autenticación y portales privados — ✅ COMPLETADA

### 5.1 Login y sesión
- Login real con `users.authWithPassword`.
- Refresh de sesión.
- Solo `ACTIVE` puede conservar acceso.
- Mensajes de error seguros.

### 5.2 Guards y redirección
- `ADMIN` → `/admin`.
- `TEACHER` → `/profesor`.
- `STUDENT` → `/alumno`.
- `RequireRole` impide entrar a portales de otro rol.

### 5.3 Logout y UI de sesión
- Logout real.
- Cabeceras privadas usan usuario/rol autenticado en modo conectado.
- Modo demo mantiene las vistas de desarrollo.

### Validación
- `V3 Frontend CI`: ✅ success.
- `V3 PocketBase CI`: ✅ success.

---

## FASE 6 · Alumno real — 🟡 IMPLEMENTACIÓN COMPLETA / VALIDACIÓN REAL PENDIENTE

### Objetivo
Sustituir los datos ficticios del portal de alumno por datos autorizados de PocketBase sin permitir acceso cruzado entre alumnos.

### FASE 6.1 · Backend académico del alumno — ✅ COMPLETADA

#### Migración 5
`1786563600_create_student_learning_core.js`

#### Cambios y colecciones
- `groups`: alumno solo ve grupos de matrículas `ACTIVE`.
- `courses`: alumno matriculado puede ver su curso aunque no sea público.
- `attendance`.
- `materials` con archivo protegido.
- `assignments` con adjunto protegido y `DRAFT` oculto al alumno.
- `assignment_submissions` con archivo protegido, feedback y calificación protegidos contra edición del alumno.
- `notifications` limitadas al destinatario.

#### Validación
- PocketBase `migrate up`: ✅ success.
- Rollback: ✅ success.

### FASE 6.2 · Capa de servicios del alumno — ✅ COMPLETADA

`frontend/src/services/pocketbase/studentPortal.ts`

Incluye:
- perfil propio
- matrículas/grupos/curso
- clases próximas/recientes
- asistencia
- archivos propios
- material
- tareas y entregas
- avisos
- snapshot de dashboard
- tokens temporales para archivos protegidos

Las operaciones propias derivan siempre el alumno desde la sesión, no desde un `studentId` arbitrario entregado por la pantalla.

### FASE 6.3 · Dashboard alumno real — ✅ COMPLETADA

`/alumno`
- próxima clase
- nivel actual
- clases recientes/próximas
- tareas pendientes/entregadas
- material autorizado
- archivos propios
- avisos
- estados vacíos y errores seguros
- modo demo conservado

### FASE 6.4 · Mis archivos — ✅ COMPLETADA

`/alumno/archivos`
- navegación real del portal
- listado y búsqueda
- subida PDF/Word/audio/imagen
- límite 20 MB
- categoría/descripcion
- archivado
- descarga protegida mediante token temporal
- `RequireRole(['STUDENT'])`
- demo sin persistencia

### FASE 6.5 · Material, tareas y entregas — ✅ COMPLETADA

`/alumno/material`
- material autorizado por alumno/grupo/curso
- filtros y búsqueda
- descarga protegida

`/alumno/tareas`
- tareas pendientes, entregadas y corregidas
- adjunto protegido de la actividad
- entrega mediante texto y/o archivo
- máximo 20 MB
- índice único evita entrega duplicada del mismo alumno para la misma tarea
- visualización de feedback y calificación
- acceso protegido al archivo entregado

### FASE 6.6 · Clases y avisos — ✅ COMPLETADA

`/alumno/clases`
- próximas clases
- historial
- grupo/curso
- horario
- estado de asistencia cuando existe

`/alumno/avisos`
- todos / sin leer
- tipos de aviso
- fecha
- marcado como leído
- solo avisos del destinatario autenticado

### Validación de implementación Fase 6
- `V3 Frontend CI`: ✅ success.
- `V3 PocketBase CI`: ✅ success.
- Todas las rutas de `studentNav` ya tienen pantalla real o demo funcional.

### FASE 6.7 · Validación A/B de seguridad — 🔒 BLOQUEADA HASTA INSTANCIA REAL

Pendiente crear usuarios reales:
- Alumno A.
- Alumno B.
- Profesor relacionado con A.
- Profesor no relacionado con A.

Debe demostrarse:
- A no puede leer perfil, matrícula, clases, tareas, avisos o archivos de B.
- conocer un ID de B no concede acceso.
- un token de archivo protegido solo descarga recursos cuya `viewRule` autoriza.
- profesor sin relación académica no accede al alumno.

### Criterio de cierre final de Fase 6
La implementación está terminada. Fase 6 se marcará totalmente ✅ cuando pase la prueba real A/B.

---

## FASE 7 · Profesor real — 🟡 EN CURSO

### FASE 7.1 · Backend y servicios del profesor — 🟡 EN CURSO
- revisar reglas existentes desde el punto de vista TEACHER
- restringir acceso a alumnos mediante grupos propios
- servicio central del profesor
- grupos propios
- alumnos matriculados en grupos propios
- clases propias
- material propio
- tareas propias
- entregas de sus tareas

### FASE 7.2 · Dashboard profesor — ⏳ PENDIENTE
- agenda
- alumnos/grupos
- tareas pendientes de corregir
- material reciente

### FASE 7.3 · Gestión de material y tareas — ⏳ PENDIENTE
- publicar material a curso/grupo/alumno autorizado
- crear tarea
- revisar entrega
- feedback/calificación

### FASE 7.4 · Alumnos y archivos autorizados — ⏳ PENDIENTE
- ver alumnos solo de grupos propios
- acceso a archivos del alumno únicamente por relación académica verificada

### FASE 7.5 · Validación seguridad profesor — 🔒 PENDIENTE DE INSTANCIA REAL
- profesor A no puede consultar grupos/alumnos de profesor B
- acceso a archivos solo si existe relación válida

---

## FASE 8 · Administración académica real — ⏳ PENDIENTE

- alta/baja de alumnos y profesores
- cursos y grupos
- matrículas
- calendario
- asistencia
- estados e histórico

---

## FASE 9 · Raspberry Pi 4 y producción — 🔒 BLOQUEADA POR HARDWARE

- preparar SSD
- sistema 64-bit
- PocketBase ARM64
- servicio persistente
- migraciones
- superuser local
- primer usuario `ADMIN`
- frontend
- HTTPS / Cloudflare
- backup externo automático
- prueba de restauración

---

## FASE 10 · Piloto y endurecimiento — ⏳ PENDIENTE

- 2–3 alumnos de prueba
- pruebas A/B de aislamiento
- relación profesor/alumno
- límites de archivo
- backups/restauración
- responsive móvil
- accesibilidad básica
- registro de errores
- prueba pública controlada

---

## Dirección del proyecto

`Estructura → Frontend → CMS visual → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Raspberry → Piloto`

Cuando una fase de validación esté bloqueada únicamente por hardware, puede avanzarse en la implementación de la fase siguiente sin declarar cerrada la validación pendiente.

Cada nueva sesión debe comenzar leyendo este archivo y actualizarlo al terminar un bloque relevante.
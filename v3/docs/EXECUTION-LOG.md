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
- Fase actual: `6.5 · Material, tareas y entregas del alumno`.

## Convención de estados

- ✅ COMPLETADA: implementada y validada.
- 🟡 EN CURSO: desarrollo activo.
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

## FASE 6 · Alumno real — 🟡 EN CURSO

### Objetivo
Sustituir los datos ficticios del portal de alumno por datos autorizados de PocketBase sin permitir acceso cruzado entre alumnos.

### FASE 6.1 · Backend académico del alumno — ✅ COMPLETADA

#### Migración 5
`1786563600_create_student_learning_core.js`

#### Cambios en reglas existentes
- `groups`: un `STUDENT` solo puede leer grupos alcanzables mediante su matrícula `ACTIVE`.
- `courses`: un `STUDENT` puede leer su curso aunque no sea público si llega a él mediante una matrícula `ACTIVE`.
- ADMIN y TEACHER conservan su ámbito anterior.

#### Colecciones nuevas
- `attendance`
- `materials`
- `assignments`
- `assignment_submissions`
- `notifications`

#### Seguridad
- Materiales y adjuntos académicos son archivos protegidos.
- Tareas `DRAFT` no son visibles para alumnos.
- Entregas pertenecen al alumno autenticado.
- Un alumno no puede alterar `teacher_feedback` ni `grade_text`.
- Avisos solo son legibles por su destinatario o ADMIN.
- Las reglas de escritura de profesor y alumno están vinculadas a relaciones del registro, no a IDs confiados solo por la UI.

#### Validación
- PocketBase `migrate up`: ✅ success.
- Rollback última migración: ✅ success.

### FASE 6.2 · Capa de servicios del alumno — ✅ COMPLETADA

Archivo central: `frontend/src/services/pocketbase/studentPortal.ts`.

Funciones implementadas:
- perfil propio
- matrículas/grupos/curso
- próximas clases
- clases recientes
- asistencia
- archivos privados
- subida/archivado/borrado de archivo propio
- URL protegida de descarga con token temporal
- material autorizado
- tareas
- entregas
- avisos y marcar como leído
- snapshot del dashboard

Principio aplicado: las operaciones propias no reciben un `studentId` arbitrario; obtienen siempre el alumno desde la sesión autenticada.

#### Validación
`V3 Frontend CI`: ✅ success tras corregir el tipo `download` del SDK de PocketBase.

### FASE 6.3 · Dashboard alumno real — ✅ COMPLETADA

En modo `connected`, `/alumno` muestra:
- próxima clase real
- nivel derivado de la matrícula/curso
- clases recientes y próximas
- tareas pendientes/entregadas
- material autorizado
- archivos propios
- avisos nuevos/leídos
- estados vacíos y mensaje seguro de error

En `demo` se conserva el dashboard ficticio para revisión visual sin servidor.

#### Validación
`V3 Frontend CI`: ✅ success.

### FASE 6.4 · Mis archivos — ✅ COMPLETADA

Ruta: `/alumno/archivos`.

Implementado:
- navegación real del portal mediante `studentNav`
- listado de archivos propios
- filtro/buscador
- subida PDF/Word/audio/imagen
- límite cliente de 20 MB alineado con PocketBase
- categoría y descripción
- archivado
- descarga mediante token temporal para archivo protegido
- ruta protegida con `RequireRole(['STUDENT'])`
- modo demo sin enviar archivos a ningún servidor

El servidor sigue siendo la autoridad: conocer un ID o URL no sustituye la `viewRule` de PocketBase.

#### Validación
`V3 Frontend CI`: ✅ success.

### FASE 6.5 · Material, tareas y entregas — 🟡 EN CURSO

Siguiente bloque:
- `/alumno/material`
- descarga protegida de material autorizado
- `/alumno/tareas`
- distinguir pendiente/entregada/corregida
- entrega con texto y/o archivo
- impedir segunda entrega duplicada por índice único
- mostrar feedback/calificación cuando exista

### FASE 6.6 · Clases y avisos — ⏳ PENDIENTE
- `/alumno/clases`
- calendario/listado de próximas y realizadas
- `/alumno/avisos`
- lectura y marcado como leído

### FASE 6.7 · Validación de seguridad — 🔒 PARCIALMENTE BLOQUEADA HASTA INSTANCIA REAL
- CI valida sintaxis y migraciones.
- Con instancia real se crearán Alumno A y Alumno B.
- Debe demostrarse que A no puede leer registros, expansiones ni archivos de B.
- También se validará que un profesor sin relación académica no accede al alumno.

### Criterio de cierre de Fase 6
Un `STUDENT` autenticado debe ver únicamente su perfil, matrículas, clases, material, tareas, entregas, avisos y archivos; ningún identificador conocido debe permitir acceder a datos de otro alumno.

---

## FASE 7 · Profesor real — ⏳ PENDIENTE

- Grupos asignados.
- Alumnos autorizados.
- Clases.
- Material.
- Tareas.
- Correcciones.
- Acceso a archivos únicamente por relación académica verificada.

---

## FASE 8 · Administración académica real — ⏳ PENDIENTE

- Alta/baja de alumnos y profesores.
- Cursos y grupos.
- Matrículas.
- Calendario.
- Asistencia.
- Estados e histórico.

---

## FASE 9 · Raspberry Pi 4 y producción — 🔒 BLOQUEADA POR HARDWARE

- Preparar SSD.
- Instalar sistema 64-bit.
- Instalar PocketBase ARM64.
- Servicio persistente.
- Aplicar migraciones.
- Crear superuser local.
- Crear primer usuario `ADMIN`.
- Desplegar frontend.
- HTTPS / Cloudflare.
- Backup automático al segundo disco.
- Prueba de restauración.

---

## FASE 10 · Piloto y endurecimiento — ⏳ PENDIENTE

- 2–3 alumnos de prueba.
- Pruebas A/B de aislamiento.
- Prueba de relación profesor/alumno.
- Límites de archivo.
- Backups/restauración.
- Responsive móvil.
- Accesibilidad básica.
- Registro de errores.
- Prueba pública controlada.

---

## Dirección del proyecto

`Estructura → Frontend → CMS visual → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Raspberry → Piloto`

Cada nueva sesión debe comenzar leyendo este archivo y actualizarlo al terminar un bloque relevante.
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
- Fase actual: `6.1 · Backend académico del alumno`.

## Convención de estados

- ✅ COMPLETADA: implementada y validada.
- 🟡 EN CURSO: desarrollo activo.
- ⏳ PENDIENTE: definida, todavía no iniciada.
- 🔒 BLOQUEADA: depende de hardware, dominio, credenciales o decisión externa.

---

## FASE 0 · Arquitectura y separación V3 — ✅ COMPLETADA

### Objetivo
Crear una V3 limpia dentro del repositorio existente sin romper la web antigua.

### Cambios guardados
- Estructura `v3/frontend`, `v3/pocketbase`, `v3/infrastructure` y `v3/docs`.
- Separación de web pública, alumno, profesor y administrador.
- Documentación de arquitectura, modelo de datos, reglas de acceso y despliegue.
- Exclusión de `.env`, `pb_data`, backups y secretos del repositorio.

### Validación
Estructura versionada en GitHub y PR independiente contra `main`.

---

## FASE 1 · Frontend público y portales — ✅ COMPLETADA

### Objetivo
Convertir la V3 en una aplicación React real y navegable.

### Cambios guardados
- Portada `/`.
- Blog `/blog`.
- Acceso `/acceso`.
- Portal alumno `/alumno`.
- Portal profesor `/profesor`.
- Dashboard administrador `/admin`.
- Diseño responsive y sistema visual común.
- GitHub Actions para compilar el frontend.

### Validación
GitHub Actions ejecuta `npm run build` correctamente.

---

## FASE 2 · CMS y gestión académica visual — ✅ COMPLETADA

### Objetivo
Diseñar el flujo completo del administrador antes de conectar datos reales.

### Cambios guardados
- `/admin/web`: editor de portada y preview.
- `/admin/multimedia`: biblioteca multimedia.
- `/admin/blog`: gestión y editor de artículos.
- `/admin/alumnos`: listado y ficha conceptual de alumno.
- `/admin/profesores`: gestión docente.
- `/admin/cursos`: cursos, niveles, grupos y plazas.
- `/admin/clases`: calendario y próximas clases.

### Validación
Frontend compilado correctamente después de cada bloque.

---

## FASE 3 · Fundación PocketBase — ✅ COMPLETADA

### Objetivo
Pasar de una maqueta a una arquitectura backend reproducible.

### Cambios guardados
- SDK JavaScript de PocketBase en el frontend.
- Cliente central de PocketBase.
- Autenticación por email/contraseña.
- Roles `ADMIN`, `TEACHER`, `STUDENT`.
- Modos `demo` y `connected`.
- Colecciones versionadas mediante migraciones.

### Migración 1 · identidad y cursos
- `users`
- `student_profiles`
- `teacher_profiles`
- `courses`

### Migración 2 · núcleo académico
- `groups`
- `enrollments`
- `classes`
- `student_files`

### Migración 3 · CMS público
- `blog_categories`
- `blog_posts`
- `media_library`
- `site_pages`
- `pricing_plans`
- `site_settings`
- `contact_requests`

### Seguridad
- Denegación por defecto en datos privados.
- `student_files.file` protegido.
- Sin credenciales de superuser en el navegador.
- Administración mediante rol de aplicación, no mediante superuser web.

### Validación
GitHub Actions descarga PocketBase `0.39.9`, ejecuta `migrate up` en una base temporal y realiza rollback correctamente.

---

## FASE 4 · Conexión real CMS ↔ PocketBase — ✅ COMPLETADA

### Objetivo
Conectar las interfaces CMS existentes a PocketBase sin perder el modo demo.

### FASE 4.1 · Capa de servicios CMS — ✅ COMPLETADA
- Tipos seguros para contenido de portada.
- Servicio `site_pages` con lectura y guardado de la Home.
- Servicio `media_library` con listado, subida, edición, borrado y URL de archivos.
- Servicio `blog_posts` con listado público/admin, categorías, crear, editar y borrar.
- Generación de URLs de archivos mediante PocketBase.
- Fallback local de contenido para `VITE_APP_MODE=demo`.

### FASE 4.2 · Portada pública — ✅ COMPLETADA
- Lee `site_pages.key = home` en modo `connected`.
- Mantiene contenido local seguro en modo demo.
- La Home continúa operativa si PocketBase no responde.
- Los errores internos no se muestran al visitante.

### FASE 4.3 · Editor de portada — ✅ COMPLETADA
- Carga el contenido actual desde PocketBase.
- `Guardar y publicar` actualiza `site_pages` con estado `PUBLISHED`.
- `Guardar borrador` actualiza el registro con estado `DRAFT`.
- Mantiene vista previa antes de publicar.
- Solo queda accesible a rol `ADMIN` en modo conectado.

### FASE 4.4 · Multimedia — ✅ COMPLETADA
- Biblioteca real desde `media_library`.
- Subida de imágenes a PocketBase.
- Borrado desde administración.
- Filtros por uso y búsqueda.
- Selección de imagen existente desde el editor de portada.
- Subida directa desde el editor de portada a Multimedia.
- El identificador del recurso queda guardado en el JSON de `site_pages`.
- La portada pública resuelve ese `mediaId` y muestra la imagen real.
- Los archivos privados de alumnos siguen separados en `student_files`.

### FASE 4.5 · Blog — ✅ COMPLETADA
- Blog público lee únicamente artículos `PUBLISHED`.
- Administración lista contenidos reales.
- Crear artículo.
- Guardar borrador.
- Publicar.
- Editar.
- Eliminar.
- Categorías reales desde PocketBase.
- Imagen de portada almacenada en `blog_posts.cover_image`.
- La web pública muestra esa portada cuando existe.

### Migración 4 · categorías iniciales de blog — ✅ COMPLETADA
- `Speaking`
- `Vocabulary`
- `Grammar`
- `Exams`
- `Kids`
- `Academia`

### Validación final de Fase 4
- `V3 Frontend CI`: ✅ success.
- `V3 PocketBase CI`: ✅ success.
- Migraciones aplicadas y rollback probado contra PocketBase `0.39.9`.

### Resultado
El CMS ya tiene un camino completo `ADMIN → PocketBase → web pública` para portada, imágenes y blog.

---

## FASE 5 · Autenticación y portales privados — ✅ COMPLETADA

### Objetivo
Activar login real y proteger rutas por rol.

### FASE 5.1 · Login y sesión — ✅ COMPLETADA
- Formulario real en modo `connected`.
- Autenticación con `users.authWithPassword`.
- Mensajes de error seguros.
- Restauración/refresco de sesión al arrancar la SPA.
- Cuenta `ACTIVE` obligatoria tanto en login como al refrescar un token existente.
- Una cuenta `INACTIVE` o `SUSPENDED` pierde acceso aunque conserve una sesión anterior.

### FASE 5.2 · Redirección y guards — ✅ COMPLETADA
- `ADMIN` → `/admin`.
- `TEACHER` → `/profesor`.
- `STUDENT` → `/alumno`.
- `RequireRole` protege las rutas en modo conectado.
- Un usuario autenticado que intenta abrir un portal de otro rol vuelve a su portal permitido.
- Modo demo conserva las vistas de desarrollo mientras no exista la Raspberry.

### FASE 5.3 · Logout y sesión UI — ✅ COMPLETADA
- Logout real mediante limpieza de `authStore`.
- Cabecera privada usa nombre, apellido y rol de la sesión real en modo conectado.
- Se eliminan nombres ficticios de la sesión conectada.
- Botón `Cerrar sesión` devuelve a `/acceso`.

### Validación final de Fase 5
- `V3 Frontend CI`: ✅ success.
- `V3 PocketBase CI`: ✅ success.

### Resultado
La aplicación ya tiene el flujo técnico completo `LOGIN → SESIÓN → GUARD POR ROL → PORTAL → LOGOUT` preparado para una instancia real de PocketBase.

---

## FASE 6 · Alumno real — 🟡 EN CURSO

### Objetivo
Sustituir progresivamente los datos ficticios del portal de alumno por datos autorizados de PocketBase.

### FASE 6.1 · Backend académico del alumno — 🟡 EN CURSO
- Permitir al alumno leer únicamente sus grupos y cursos matriculados.
- Mantener aislamiento total entre alumnos.
- Crear `attendance`.
- Crear `materials`.
- Crear `assignments`.
- Crear `assignment_submissions`.
- Crear `notifications`.
- Proteger los archivos académicos con reglas PocketBase.
- Validar migración y rollback en CI.

### FASE 6.2 · Capa de servicios del alumno — ⏳ PENDIENTE
- Perfil propio.
- Matrículas/grupos.
- Próximas clases.
- Material.
- Archivos privados.
- Tareas y entregas.
- Notificaciones.

### FASE 6.3 · Dashboard alumno real — ⏳ PENDIENTE
- Próxima clase real.
- Contadores de clases/tareas/material/archivos.
- Material reciente.
- Trabajo pendiente.
- Estados vacíos y errores seguros.

### FASE 6.4 · Mis archivos — ⏳ PENDIENTE
- Listar archivos propios.
- Subir archivo protegido.
- Descargar archivo protegido.
- Archivar/eliminar según reglas.
- Nunca aceptar un `student` distinto al usuario autenticado.

### FASE 6.5 · Material, tareas y entregas — ⏳ PENDIENTE
- Material autorizado por grupo/alumno.
- Tareas directas o de grupo.
- Entrega del alumno.
- Estado de corrección.

### FASE 6.6 · Validación de seguridad — 🔒 PARCIALMENTE BLOQUEADA HASTA INSTANCIA REAL
- CI valida sintaxis y migraciones.
- Las pruebas completas con usuarios reales `A/B` se ejecutarán al disponer de una instancia PocketBase accesible.
- Debe demostrarse que Alumno A no puede leer registros ni archivos de Alumno B.

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

- Crear 2–3 alumnos de prueba.
- Probar aislamiento entre alumnos.
- Probar profesor con y sin relación académica.
- Límites de archivo.
- Backups/restauración.
- Responsive móvil.
- Accesibilidad básica.
- Registro de errores.
- Preparación para prueba pública controlada.

---

## Dirección del proyecto

El orden no se alterará salvo incidencia crítica:

`Estructura → Frontend → CMS visual → PocketBase → CMS real → Login → Alumno → Profesor → Admin académico → Raspberry → Piloto`

Cada nueva sesión debe comenzar leyendo este archivo y actualizarlo al terminar un bloque relevante.
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
- Fase actual: `5 · Autenticación y portales privados`.

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

## FASE 5 · Autenticación y portales privados — 🟡 EN CURSO

### Objetivo
Activar login real y proteger rutas por rol.

### FASE 5.1 · Login y sesión — 🟡 EN CURSO
- Revisar formulario real de login.
- Autenticación con `users.authWithPassword`.
- Mensajes de error seguros.
- Restauración/refresco de sesión.
- Cuenta `ACTIVE` obligatoria.

### FASE 5.2 · Redirección y guards — ⏳ PENDIENTE
- Redirect automático según `ADMIN`, `TEACHER`, `STUDENT`.
- Validar `RequireRole` en modo conectado.
- Mantener vistas demo durante desarrollo.

### FASE 5.3 · Logout y sesión UI — ⏳ PENDIENTE
- Logout real.
- Estado de usuario actual en cabecera.
- Evitar nombre/rol ficticio en modo conectado.

### Criterio de cierre de Fase 5
Un usuario real debe poder iniciar sesión, llegar únicamente a su portal, mantener/refrescar la sesión y cerrarla sin poder acceder a rutas de otro rol.

---

## FASE 6 · Alumno real — ⏳ PENDIENTE

- Perfil propio.
- Matrículas.
- Próximas clases.
- Material.
- Archivos privados.
- Tareas y entregas.
- Notificaciones.

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
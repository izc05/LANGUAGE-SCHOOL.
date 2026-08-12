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

### Resultado
Base preparada para crecer sin mezclar la web antigua con la plataforma nueva.

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

## FASE 4 · Conexión real CMS ↔ PocketBase — 🟡 EN CURSO

### Objetivo
Conectar las interfaces existentes a PocketBase sin perder el modo demo.

### FASE 4.1 · Capa de servicios CMS — 🟡 EN CURSO
- Crear tipos de contenido de portada.
- Crear servicio `site_pages`.
- Crear servicio `media_library`.
- Crear servicio `blog_posts`.
- Generar URLs de archivos mediante PocketBase.

### FASE 4.2 · Portada pública — ⏳ PENDIENTE
- Leer `site_pages.key = home` cuando `VITE_APP_MODE=connected`.
- Mantener datos locales como fallback en demo.
- Mostrar estado seguro si PocketBase no responde.

### FASE 4.3 · Editor de portada — ⏳ PENDIENTE
- Cargar contenido actual desde PocketBase.
- Guardar cambios reales como ADMIN.
- Mantener preview local antes de guardar.

### FASE 4.4 · Multimedia — ⏳ PENDIENTE
- Listar archivos reales.
- Subir imagen real.
- Eliminar/editar metadatos con permisos ADMIN.
- Seleccionar recursos desde el CMS.

### FASE 4.5 · Blog — ⏳ PENDIENTE
- Leer artículos publicados en web pública.
- CRUD real de artículos desde ADMIN.
- Borrador/publicación y fechas.
- Portada y categoría.

### Criterio de cierre de Fase 4
La portada, biblioteca y blog deben funcionar contra una instancia real de PocketBase sin cambiar la interfaz diseñada.

---

## FASE 5 · Autenticación y portales privados — ⏳ PENDIENTE

### Objetivo
Activar login real y proteger rutas por rol.

- Login conectado.
- Redirect por rol.
- Guard de rutas ADMIN/TEACHER/STUDENT.
- Refresh de sesión.
- Logout.
- Validación de cuentas inactivas/suspendidas.

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
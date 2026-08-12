# Modelo de datos PocketBase · Language School V3

Este documento define la estructura funcional inicial. Los nombres y campos se convertirán posteriormente en migraciones versionadas.

## 1. `users` · Auth collection

Cuenta única de acceso.

Campos de aplicación:
- `name`
- `surname`
- `role`: `ADMIN | TEACHER | STUDENT`
- `status`: `ACTIVE | INACTIVE | SUSPENDED`
- `avatar`
- `phone`

El email, contraseña y tokens pertenecen al sistema de autenticación de PocketBase.

## 2. `student_profiles`

Perfil extendido de alumno.

- `user` → users, único
- `birth_date` opcional
- `guardian_name` opcional
- `guardian_phone` opcional
- `notes_private` solo administración/profesor autorizado
- `active`

## 3. `teacher_profiles`

- `user` → users, único
- `bio`
- `specialties`
- `public_photo`
- `public_profile`
- `active`

## 4. `courses`

Catálogo académico.

- `title`
- `slug`
- `level`
- `description`
- `cover_image`
- `status`
- `public_visible`

## 5. `groups`

Grupo real de alumnos de un curso.

- `name`
- `course` → courses
- `teacher` → users
- `academic_year`
- `schedule_text`
- `capacity`
- `status`

## 6. `enrollments`

Relación alumno-grupo.

- `student` → users
- `group` → groups
- `status`: `ACTIVE | PAUSED | FINISHED | CANCELLED`
- `joined_at`
- `ended_at`

Debe evitarse la matrícula activa duplicada del mismo alumno en el mismo grupo.

## 7. `classes`

Sesiones concretas.

- `group` → groups
- `teacher` → users
- `starts_at`
- `ends_at`
- `topic`
- `description`
- `status`: `SCHEDULED | COMPLETED | CANCELLED`

## 8. `attendance`

- `class` → classes
- `student` → users
- `status`: `PRESENT | ABSENT | JUSTIFIED`
- `notes`

## 9. `materials`

Material docente compartido.

- `title`
- `description`
- `file`
- `teacher` → users
- `course` → courses, opcional
- `group` → groups, opcional
- `student` → users, opcional
- `visibility`: `COURSE | GROUP | STUDENT`
- `published`

## 10. `student_files`

Espacio privado del alumno.

- `title`
- `file`
- `student` → users
- `uploaded_by` → users
- `category`
- `description`
- `status`

El alumno relacionado será el criterio principal de autorización.

## 11. `assignments`

- `title`
- `description`
- `teacher` → users
- `group` → groups, opcional
- `student` → users, opcional
- `attachment`
- `due_at`
- `status`

## 12. `assignment_submissions`

- `assignment` → assignments
- `student` → users
- `file`
- `text_answer`
- `submitted_at`
- `teacher_feedback`
- `grade_text`
- `status`: `SUBMITTED | REVIEWED | RETURNED`

## 13. `blog_categories`

- `name`
- `slug`
- `description`
- `active`

## 14. `blog_posts`

- `title`
- `slug`
- `excerpt`
- `content`
- `cover_image`
- `category` → blog_categories
- `author` → users
- `status`: `DRAFT | PUBLISHED | ARCHIVED`
- `published_at`
- `seo_title`
- `seo_description`

Solo `PUBLISHED` será visible públicamente.

## 15. `media_library`

Biblioteca de recursos administrables.

- `title`
- `file`
- `alt_text`
- `media_type`
- `usage`
- `uploaded_by` → users

## 16. `site_pages`

Contenido editable de la web.

- `key` único, por ejemplo `home`, `academy`, `contact`
- `title`
- `content` JSON
- `status`

El JSON contendrá bloques/valores controlados por la aplicación, no HTML arbitrario de confianza.

## 17. `pricing_plans`

- `name`
- `description`
- `price`
- `billing_text`
- `features`
- `sort_order`
- `active`
- `featured`

## 18. `site_settings`

Registro de configuración global.

- `academy_name`
- `logo`
- `phone`
- `email`
- `whatsapp`
- `address`
- `social_links`
- `legal_texts`

## 19. `notifications`

- `recipient` → users
- `title`
- `body`
- `type`
- `read_at`
- `created_by` → users

## 20. `contact_requests`

Solicitudes recibidas desde la web pública.

- `name`
- `email`
- `phone`
- `interest`
- `message`
- `status`: `NEW | CONTACTED | CLOSED`

## Futuro

No se incorporarán pagos, facturación o mensajería compleja hasta que la base académica y los permisos estén validados. Se añadirán mediante nuevas migraciones sin romper las colecciones anteriores.

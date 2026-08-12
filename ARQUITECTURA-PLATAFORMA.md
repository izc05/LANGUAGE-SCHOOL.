# Language School · Arquitectura de la plataforma

## Objetivo

Convertir la web pública de Language School en una plataforma completa para una academia de inglés, preparada para ejecutarse en una Raspberry Pi 4, con PocketBase como backend principal y GitHub como repositorio de código y control de versiones.

## Decisión tecnológica

La plataforma se montará sobre **PocketBase** en la Raspberry Pi 4.

PocketBase se encargará de:
- autenticación
- usuarios
- roles
- base de datos
- API
- relaciones entre alumnos, profesores y contenidos
- subida y gestión de archivos
- reglas de acceso por colección
- administración técnica del backend

La aplicación web tendrá su propio panel de administración orientado al uso diario de la academia. El administrador de la academia no tendrá que entrar en GitHub ni en el panel técnico de PocketBase para publicar contenido, cambiar imágenes o gestionar alumnos.

## Zonas de la aplicación

### 1. Web pública
- Inicio
- Academia / metodología
- Cursos
- Precios
- Blog
- Contacto
- Acceso de alumnos

### 2. Área privada de alumno
- Perfil
- Próxima clase
- Calendario
- Material del profesor
- Mis archivos
- Entrega de tareas
- Historial de tareas
- Listening / recursos
- Mensajes y avisos

Cada alumno tendrá acceso únicamente a sus propios datos y archivos.

### 3. Área de profesor
- Alumnos asignados
- Clases
- Material
- Tareas
- Correcciones
- Archivos por alumno
- Avisos

### 4. Administración
- Dashboard
- Alta/baja de alumnos
- Alta/baja de profesores
- Gestión de roles
- Gestión de clases
- Gestión de contenidos de la web
- Biblioteca de imágenes
- Blog: borradores, publicar, editar y archivar
- Tarifas
- Copias de seguridad y estado del almacenamiento

## Gestión editable de la web

El administrador no deberá editar HTML ni entrar en GitHub para cambiar el contenido diario. El panel permitirá modificar:

- Logo
- Imagen principal
- Imágenes de secciones
- Textos de portada
- Cursos
- Profesores
- Tarifas
- Datos de contacto
- Artículos del blog
- Imágenes del blog

Todos estos datos se almacenarán en PocketBase.

## Arquitectura prevista en Raspberry Pi 4

```text
Internet
  |
Cloudflare / HTTPS
  |
Raspberry Pi 4
  |
  +-- Web pública
  +-- Área privada de alumnos
  +-- Área de profesores
  +-- Panel de administración
  |
  +-- PocketBase
  |     +-- autenticación
  |     +-- API REST / realtime
  |     +-- base de datos SQLite
  |     +-- reglas de acceso
  |     +-- archivos gestionados
  |
  +-- SSD principal
  |     +-- aplicación
  |     +-- PocketBase
  |     +-- pb_data
  |     +-- archivos
  |
  +-- Disco de backup
        +-- copias de pb_data
        +-- copias de configuración
        +-- copias de archivos
```

## Roles iniciales

### ADMIN
Control total de la academia y de los contenidos.

### TEACHER
Acceso a alumnos asignados, clases, tareas y material.

### STUDENT
Acceso únicamente a su perfil, clases, tareas y archivos.

## Modelo inicial de PocketBase

### users · colección Auth
Campos adicionales previstos:
- name
- surname
- role: ADMIN | TEACHER | STUDENT
- status: ACTIVE | INACTIVE
- phone
- avatar

No se confiará únicamente en el frontend para proteger datos. Las reglas de PocketBase deberán impedir el acceso a registros no autorizados.

### student_profiles
- user
- teacher
- level
- birth_date opcional
- notes privadas del profesor
- start_date
- active

### teacher_profiles
- user
- bio
- specialties
- photo
- active

### courses
- title
- slug
- description
- level
- image
- active
- sort_order

### classes
- student o grupo
- teacher
- course
- start_at
- end_at
- title
- notes
- status

### student_files
- owner
- student
- teacher opcional
- file
- title
- description
- category
- visibility
- created

### assignments
- title
- description
- student
- teacher
- due_at
- attachment opcional
- status

### assignment_submissions
- assignment
- student
- file
- comment
- submitted_at
- correction
- corrected_file opcional
- grade opcional

### blog_posts
Estados previstos:
- DRAFT
- PUBLISHED
- ARCHIVED

Campos:
- title
- slug
- excerpt
- content
- cover_image
- category
- author
- status
- published_at
- seo_title
- seo_description

### media_library
- file
- title
- alt_text
- category
- uploaded_by

### site_settings
Colección para contenido editable de la web:
- site_name
- logo
- hero_title
- hero_text
- hero_image
- contact_email
- contact_phone
- whatsapp
- address
- social_links

### notifications
- recipient
- title
- message
- type
- read
- created

## Seguridad de archivos

No se expondrán carpetas del sistema directamente a Internet.

Los archivos privados estarán asociados a registros de PocketBase y protegidos mediante reglas de acceso. Cada archivo tendrá relación con el alumno y/o profesor correspondiente.

Principios:
- un alumno solo podrá consultar sus propios registros
- un profesor solo podrá consultar alumnos que tenga asignados
- un administrador tendrá acceso global
- las páginas públicas solo consultarán colecciones y campos expresamente públicos
- nunca se almacenarán contraseñas, tokens o secretos en GitHub

## Blog y multimedia

El blog y la biblioteca multimedia se gestionarán desde el panel de administración de la propia web.

Flujo de blog:
1. crear borrador
2. subir o seleccionar imagen de portada
3. editar contenido
4. previsualizar
5. publicar
6. archivar cuando proceda

El administrador podrá reutilizar imágenes de la biblioteca multimedia sin tener que volver a subirlas.

## Fases

### Fase 1 · Fundación pública
- reparar estructura actual de assets
- añadir Blog
- añadir entrada al Área de alumnos
- mantener vista pública compatible con GitHub Pages

### Fase 2 · Panel de administración visual
- Dashboard
- gestión de páginas
- biblioteca multimedia
- editor de blog
- diseño de usuarios

Inicialmente funcionará con datos de demostración para poder desarrollar antes de disponer de la Raspberry Pi.

### Fase 3 · PocketBase
- instalar PocketBase en Raspberry Pi
- crear colección Auth
- crear colecciones de negocio
- crear relaciones
- definir reglas de acceso
- conectar la web mediante el SDK/API de PocketBase
- login real
- gestión real del blog
- gestión real de imágenes

### Fase 4 · Portal de alumnos y profesores
- material privado
- subida de archivos
- tareas
- entregas
- correcciones
- calendario
- historial
- mensajes y avisos

### Fase 5 · Raspberry Pi en producción
- arranque desde SSD
- servicio de PocketBase
- despliegue de la aplicación web
- volúmenes persistentes
- copias automáticas de `pb_data`
- backup en segundo disco
- HTTPS
- dominio
- Cloudflare
- monitorización

## Estructura de almacenamiento prevista

```text
/opt/language-school/
├── app/
├── pocketbase/
│   ├── pocketbase
│   ├── pb_migrations/
│   └── pb_data/
├── backups/
└── scripts/
```

`pb_data` contendrá los datos persistentes de PocketBase y deberá incluirse en la estrategia de copias de seguridad. Las migraciones sí podrán mantenerse versionadas en GitHub cuando las creemos.

## Principio de trabajo

GitHub contendrá:
- código fuente
- documentación
- migraciones de PocketBase
- configuración no secreta
- historial de cambios

La Raspberry Pi contendrá:
- instancia de PocketBase
- base de datos real
- archivos reales de alumnos
- credenciales y secretos

Los datos privados de alumnos nunca se almacenarán en el repositorio público.

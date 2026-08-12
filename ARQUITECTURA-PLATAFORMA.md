# Language School · Arquitectura de la plataforma

## Objetivo

Convertir la web pública de Language School en una plataforma completa para una academia de inglés, preparada para ejecutarse en una Raspberry Pi 4 y desarrollarse/versionarse desde GitHub.

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

Los cambios se almacenarán en base de datos y/o almacenamiento del servidor.

## Arquitectura prevista en Raspberry Pi 4

```text
Internet
  |
Cloudflare / HTTPS
  |
Raspberry Pi 4
  |
  +-- Web pública
  +-- API / Backend
  +-- Base de datos PostgreSQL
  +-- Almacenamiento privado
  |     +-- alumnos
  |     +-- profesores
  |     +-- blog
  |     +-- multimedia
  |
  +-- Copias de seguridad
```

## Roles iniciales

### ADMIN
Control total de la academia y de los contenidos.

### TEACHER
Acceso a alumnos asignados, clases, tareas y material.

### STUDENT
Acceso únicamente a su perfil, clases, tareas y archivos.

## Almacenamiento de archivos

No se expondrán carpetas del sistema directamente a Internet.

Cada archivo tendrá como mínimo:
- propietario
- alumno relacionado
- profesor relacionado cuando corresponda
- nombre original
- nombre interno
- tipo MIME
- tamaño
- fecha de subida
- permisos
- estado

La descarga se realizará siempre después de validar la sesión y los permisos del usuario.

## Blog

Estados previstos:
- DRAFT
- PUBLISHED
- ARCHIVED

Campos básicos:
- título
- slug
- resumen
- contenido
- imagen de portada
- categoría
- autor
- fecha de publicación
- SEO title
- SEO description

## Fases

### Fase 1 · Fundación pública
- Reparar estructura actual de assets
- Añadir Blog
- Añadir entrada al Área de alumnos
- Mantener vista pública compatible con GitHub Pages

### Fase 2 · Panel de administración visual
- Dashboard
- Gestión de páginas
- Biblioteca multimedia
- Editor de blog
- Diseño de usuarios

Inicialmente funcionará con datos de demostración para poder desarrollar antes de disponer de la Raspberry Pi.

### Fase 3 · Backend
- Autenticación
- Roles
- PostgreSQL
- API
- Gestión real del blog
- Gestión real de imágenes

### Fase 4 · Portal de alumnos
- Material privado
- Subida de archivos
- Tareas
- Calendario
- Historial

### Fase 5 · Raspberry Pi
- Docker
- Base de datos
- Volúmenes SSD
- Backups en segundo disco
- HTTPS
- Dominio
- Monitorización

## Principio de trabajo

GitHub contendrá el código fuente y el historial de cambios. Los archivos privados de alumnos, contraseñas, base de datos y secretos nunca se almacenarán en el repositorio público.

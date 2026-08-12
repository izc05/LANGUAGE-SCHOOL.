# Arquitectura · Language School V3

## Principios

1. Una sola plataforma con cuatro experiencias: pública, alumno, profesor y administración.
2. PocketBase es el backend principal: autenticación, API, base de datos, relaciones, reglas de acceso y archivos.
3. El frontend nunca será la barrera de seguridad. Las reglas reales vivirán en PocketBase.
4. Los contenidos habituales de la academia deben editarse desde administración, no desde GitHub.
5. Los archivos privados nunca se servirán como una carpeta pública del sistema.
6. La aplicación se diseña desde el inicio para funcionar en Raspberry Pi 4 y poder migrarse a otro servidor sin rehacerla.

## Flujo general

```text
Internet
  │
  ▼
Cloudflare / HTTPS
  │
  ▼
Raspberry Pi 4
  │
  ├── Frontend Language School V3
  │     ├── Web pública
  │     ├── Alumno
  │     ├── Profesor
  │     └── Admin
  │
  └── PocketBase
        ├── Auth
        ├── Collections
        ├── API
        ├── Access rules
        └── File storage
              │
              ▼
             SSD

Segundo disco USB → backups
```

## Frontend

La aplicación se organiza por dominio y no por páginas sueltas. Los módulos principales serán:

- `auth`
- `site-content`
- `blog`
- `media`
- `students`
- `teachers`
- `courses`
- `classes`
- `assignments`
- `files`
- `notifications`

### Rutas previstas

#### Públicas
- `/`
- `/academia`
- `/cursos`
- `/precios`
- `/profesores`
- `/blog`
- `/blog/:slug`
- `/contacto`
- `/acceso`

#### Alumno
- `/app/alumno`
- `/app/alumno/clases`
- `/app/alumno/material`
- `/app/alumno/archivos`
- `/app/alumno/tareas`
- `/app/alumno/calendario`
- `/app/alumno/avisos`
- `/app/alumno/perfil`

#### Profesor
- `/app/profesor`
- `/app/profesor/alumnos`
- `/app/profesor/clases`
- `/app/profesor/material`
- `/app/profesor/tareas`
- `/app/profesor/correcciones`

#### Administración
- `/admin`
- `/admin/alumnos`
- `/admin/profesores`
- `/admin/cursos`
- `/admin/clases`
- `/admin/web`
- `/admin/blog`
- `/admin/multimedia`
- `/admin/tarifas`
- `/admin/configuracion`

## CMS interno

No se instalará un CMS separado. La propia zona Admin será el CMS de Language School.

Desde Admin se podrá cambiar:

- logo
- imagen de portada
- textos principales
- imágenes de secciones
- cursos
- profesores
- tarifas
- datos de contacto
- artículos del blog
- categorías
- recursos multimedia

Estos cambios se guardarán en PocketBase.

## Archivos de alumnos

Cada archivo tendrá relación con su propietario y contexto. Nunca se confiará en una ruta de carpeta como mecanismo de autorización.

Ejemplo de flujo:

```text
Alumno autenticado
  → solicita archivo
  → PocketBase valida regla de acceso
  → autoriza o deniega
  → entrega del archivo
```

## Despliegue

El código se versiona en GitHub. La Raspberry recibe una versión concreta del código y ejecuta PocketBase con datos persistentes fuera del repositorio.

No se versionan:

- `pb_data`
- `.env`
- secretos
- tokens
- archivos de alumnos
- backups
- logs con datos sensibles

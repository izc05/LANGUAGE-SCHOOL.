# PocketBase · Language School V3

PocketBase será el backend principal de la plataforma.

## Versiones objetivo

- PocketBase server: `0.39.9`
- PocketBase JavaScript SDK: `0.27.x`

PocketBase todavía no ha llegado a v1.0, por lo que las actualizaciones se harán de forma controlada y leyendo el changelog antes de cambiar la versión del servidor.

## Responsabilidades

- autenticación
- roles y reglas de acceso
- colecciones y relaciones
- API
- almacenamiento de archivos
- blog y contenidos editables
- datos académicos

## Estructura

```text
pocketbase/
├── pb_migrations/    # migraciones versionadas
├── pb_hooks/         # hooks versionados si fueran necesarios
└── README.md
```

`pb_data` NO forma parte del repositorio.

## Migraciones actuales

1. `1786561920_create_identity_and_courses.js`
   - `users`
   - `student_profiles`
   - `teacher_profiles`
   - `courses`

2. `1786562400_create_academic_core.js`
   - `groups`
   - `enrollments`
   - `classes`
   - `student_files`

3. `1786563000_create_public_cms.js`
   - `blog_categories`
   - `blog_posts`
   - `media_library`
   - `site_pages`
   - `pricing_plans`
   - `site_settings`
   - `contact_requests`
   - contenido inicial de la portada y configuración básica

Todas estas migraciones se prueban en GitHub Actions contra PocketBase `0.39.9`, incluyendo aplicación y rollback de la última migración.

## Arranque inicial en Raspberry Pi

1. Instalar el binario ARM64 de PocketBase en el SSD.
2. Mantener `pb_data` fuera del repositorio y en almacenamiento persistente.
3. Copiar/sincronizar `pb_migrations` desde GitHub.
4. Ejecutar `pocketbase migrate up` antes de publicar una nueva versión.
5. Crear el primer superuser local de PocketBase.
6. Desde el Dashboard crear la primera cuenta de la colección `users` con `role=ADMIN` y `status=ACTIVE`.
7. Configurar HTTPS/reverse proxy antes de activar `VITE_APP_MODE=connected` en el frontend.

## Modos del frontend

### Demo

```env
VITE_APP_MODE=demo
VITE_POCKETBASE_URL=http://127.0.0.1:8090
```

Las vistas privadas siguen accesibles para diseñar y revisar la interfaz mientras el servidor físico no está disponible.

### Connected

```env
VITE_APP_MODE=connected
VITE_POCKETBASE_URL=https://api.tudominio.es
```

En este modo se activa el login real, refresco de autenticación y protección de rutas por rol.

## Producción

En Raspberry Pi se mantendrán separados:

- binario/servicio PocketBase
- código y migraciones
- `pb_data` persistente en SSD
- backups en segundo disco
- secretos y configuración local

Los archivos de `student_files` están definidos como protegidos y las reglas de colección limitan su acceso al alumno propietario y al administrador. El acceso de profesores a archivos privados se abrirá posteriormente con reglas verificadas por relación académica, no de forma global.

## Regla de seguridad

La cuenta superuser se reserva para administración del backend y mantenimiento. El frontend público nunca recibirá sus credenciales. Ninguna variable `VITE_*` puede contener secretos porque queda incorporada al código entregado al navegador.

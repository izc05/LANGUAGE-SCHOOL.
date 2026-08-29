# Reglas de acceso · Language School V3

## Principio de seguridad

La interfaz puede ocultar botones, pero la seguridad real debe estar en PocketBase. Toda colección privada tendrá reglas explícitas de lectura, creación, edición y borrado.

## Roles

### ADMIN

- Gestión total de alumnos, profesores, cursos, grupos, clases y contenidos.
- Gestión de blog, multimedia, tarifas y configuración.
- Acceso a todos los archivos académicos necesarios.
- No se utilizará una cuenta superuser de PocketBase desde el navegador.

### TEACHER

- Puede consultar su propio perfil.
- Puede consultar los grupos en los que es profesor.
- Puede consultar alumnos matriculados en sus grupos.
- Puede crear/editar clases, materiales, tareas y correcciones dentro de su ámbito.
- Puede acceder a archivos de alumnos únicamente cuando exista una relación académica autorizada.
- No puede modificar roles, configuración global ni otros profesores.

### STUDENT

- Puede consultar y editar los campos permitidos de su propio perfil.
- Puede consultar sus matrículas, grupos y clases.
- Puede descargar materiales que le correspondan.
- Puede consultar y subir sus propios archivos y entregas.
- Puede consultar exclusivamente sus propias notificaciones.
- No puede listar ni consultar registros privados de otros alumnos.

## Acceso público

Sin autenticación solo se permite acceder a contenido expresamente público:

- páginas publicadas
- cursos marcados como públicos
- profesores con perfil público
- tarifas activas
- artículos `PUBLISHED`
- imágenes destinadas a la web pública
- formulario de contacto con creación limitada y validada

## Reglas críticas

1. Denegar por defecto y abrir únicamente lo necesario.
2. Las relaciones `student`, `teacher`, `group` y `recipient` forman parte de la autorización.
3. Los archivos privados deben seguir las mismas reglas que sus registros.
4. Un identificador conocido no concede acceso.
5. Nunca exponer credenciales de administrador o superuser en variables `VITE_*`.
6. Validar tamaño y tipos de archivo aceptados.
7. No permitir HTML arbitrario en contenido editable sin un proceso seguro de sanitización.
8. Mantener registro de cambios administrativos relevantes cuando se implemente auditoría.

## Matriz inicial

| Recurso | Público | Alumno | Profesor | Admin |
|---|---:|---:|---:|---:|
| Web publicada | Leer | Leer | Leer | CRUD |
| Blog publicado | Leer | Leer | Leer | CRUD |
| Perfil propio | No | Propio | Propio | CRUD |
| Otros alumnos | No | No | Asignados | CRUD |
| Grupos | No | Matriculados | Propios | CRUD |
| Clases | No | Propias | Propias | CRUD |
| Material | Público si aplica | Autorizado | Propio/autorizado | CRUD |
| Archivos alumno | No | Propios | Autorizados | CRUD |
| Tareas | No | Propias | Propias | CRUD |
| Entregas | No | Propias | Alumnos autorizados | CRUD |
| Multimedia admin | Solo pública | No | Según necesidad | CRUD |
| Configuración | Lectura pública parcial | No | No | CRUD |

Las expresiones exactas de reglas se escribirán junto a las migraciones de PocketBase y se probarán con usuarios de cada rol antes de desplegar datos reales.

# PocketBase hooks · Language School

Los hooks server-side viven en esta carpeta y forman parte del **runtime obligatorio** de Language School. No son herramientas de desarrollo ni extensiones opcionales.

En el repositorio y CI deben cargarse con `--hooksDir` apuntando a `v3/pocketbase/pb_hooks`.

En producción, `install-pocketbase.sh` debe copiar esta carpeta completa a:

```text
/opt/language-school/pocketbase/pb_hooks
```

y `start-pocketbase.sh` debe arrancar PocketBase con `--hooksDir=/opt/language-school/pocketbase/pb_hooks`. Si el directorio no existe, el servicio debe fallar en vez de levantar una aplicación incompleta.

Esto es imprescindible porque aquí viven rutas server-side de negocio, entre ellas Zoom y el sistema de test de nivel/Listening.

## Zoom

La integración Zoom se mantiene completamente en servidor:

- `zoom_status.pb.js`: indica si API, anfitrión y Meeting SDK están configurados, sin devolver valores privados.
- `zoom_connection.pb.js`: verifica Server-to-Server OAuth contra Zoom cuando Administración lo solicita.
- `zoom_meeting_create.pb.js`: crea de forma idempotente una reunión para una clase Online/Híbrida y sincroniza únicamente el `join_url` de participante con `classes.online_join_url`.
- `zoom_meeting_sdk_auth.pb.js`: emite la autorización temporal Meeting SDK únicamente para un alumno con matrícula activa en la clase correspondiente.

Las credenciales y configuración privada se leen exclusivamente desde variables de entorno del servidor:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_HOST_USER_ID`
- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`

`ZOOM_HOST_USER_ID` identifica al usuario Zoom propietario de las reuniones creadas desde Language School. Para Server-to-Server OAuth se usa su ID real al llamar `POST /users/{userId}/meetings`.

Nunca guardar estos valores en React, `site_settings`, registros públicos de PocketBase ni el repositorio.

La colección `zoom_meetings` mantiene la asociación técnica entre una clase de Language School y su reunión Zoom. Puede almacenar ID/UUID de reunión, `join_url`, contraseña y estado, pero **no guarda `start_url` de host** y no es visible directamente para alumnos.

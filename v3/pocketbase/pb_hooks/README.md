# PocketBase hooks · Language School

Los hooks server-side viven en esta carpeta y deben cargarse con `--hooksDir` apuntando a `v3/pocketbase/pb_hooks`.

## Zoom

La integración Zoom se mantiene completamente en servidor:

- `zoom_status.pb.js`: indica si las credenciales están configuradas, sin devolver valores secretos.
- `zoom_connection.pb.js`: verifica Server-to-Server OAuth contra Zoom cuando Administración lo solicita.

Las credenciales privadas se leen exclusivamente desde variables de entorno del servidor:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`

Nunca guardar estos valores en React, `site_settings`, registros públicos de PocketBase ni el repositorio.

La colección `zoom_meetings` mantiene la asociación técnica entre una clase de Language School y su futura reunión Zoom. No contiene `start_url` de host y no es visible directamente para alumnos.

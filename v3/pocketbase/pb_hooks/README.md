# PocketBase hooks · Language School

Los hooks server-side viven en esta carpeta y deben cargarse con `--hooksDir` apuntando a `v3/pocketbase/pb_hooks`.

## Zoom

`zoom_status.pb.js` expone únicamente un estado técnico protegido para Administración.

Las credenciales privadas se leen exclusivamente desde variables de entorno del servidor:

- `ZOOM_ACCOUNT_ID`
- `ZOOM_CLIENT_ID`
- `ZOOM_CLIENT_SECRET`
- `ZOOM_MEETING_SDK_CLIENT_ID`
- `ZOOM_MEETING_SDK_CLIENT_SECRET`

Nunca guardar estos valores en React, `site_settings`, PocketBase público ni el repositorio.

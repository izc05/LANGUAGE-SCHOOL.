# Language School · Variables privadas de producción

Este documento enumera **nombres y propósito**, nunca valores reales.

Los secretos de producción deben existir únicamente en el host, dentro de:

```text
/etc/language-school/production.env
```

El archivo debe permanecer:

- propiedad `root:root`;
- modo `0640`;
- fuera de Git;
- fuera de cualquier variable `VITE_*`;
- fuera de PocketBase/CMS público.

## Zoom · Server-to-Server OAuth

Añadir en el host cuando se vaya a activar la integración real:

- `ZOOM_ACCOUNT_ID` — identificador de la cuenta Zoom.
- `ZOOM_CLIENT_ID` — Client ID de la app Server-to-Server OAuth.
- `ZOOM_CLIENT_SECRET` — Client Secret de la app Server-to-Server OAuth.
- `ZOOM_HOST_USER_ID` — ID real del usuario Zoom que será propietario de las reuniones creadas por Language School.

## Zoom · Meeting SDK

- `ZOOM_MEETING_SDK_CLIENT_ID` — identificador público de la app Meeting SDK usado por el backend para emitir la autorización temporal.
- `ZOOM_MEETING_SDK_CLIENT_SECRET` — secreto Meeting SDK; solo servidor.

## Procedimiento

1. Crear/preparar `/etc/language-school/production.env` con `prepare-production-env.sh`.
2. Editar el archivo como root y añadir las variables privadas necesarias.
3. No usar valores placeholder.
4. Mantener permisos `0640 root:root`.
5. Reiniciar PocketBase para que el proceso reciba el nuevo entorno:

```bash
sudo systemctl restart language-school-pocketbase
```

6. Comprobar:

```bash
sudo systemctl is-active language-school-pocketbase
sudo bash v3/infrastructure/raspberry-pi/health-check.sh
```

7. Desde **Admin → Zoom**, verificar el estado de Server-to-Server OAuth y Meeting SDK. La interfaz debe mostrar únicamente estado/configuración, nunca secretos ni access tokens.

## Rotación

Si una credencial se rota en Zoom Marketplace:

1. reemplazar el valor únicamente en `/etc/language-school/production.env`;
2. reiniciar PocketBase;
3. repetir health check y verificación Admin;
4. revocar la credencial antigua en el proveedor cuando la nueva esté confirmada.

## Prohibiciones

No guardar secretos en:

- `.env.example` versionados;
- React;
- `VITE_*`;
- issues/PRs/logs;
- `site_settings` u otras colecciones públicas;
- scripts shell del repositorio;
- documentación con valores concretos.

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

## Cloudflare Turnstile · Contacto

- `TURNSTILE_SITE_KEY` — sitekey pública del widget asociado al hostname real. El script de despliegue la compila como `VITE_TURNSTILE_SITE_KEY`; no es un secreto.
- `TURNSTILE_SECRET_KEY` — secret key privada para Siteverify; solo servidor.
- `TURNSTILE_EXPECTED_ACTION` — debe ser `contact` en producción.
- `TURNSTILE_ALLOWED_HOSTNAMES` — lista separada por comas de hostnames válidos; debe incluir el hostname de `PUBLIC_ORIGIN`.

`PILOT_MAIL_CAPTURE` no es un secreto, pero solo puede ser `true` con `DEPLOYMENT_MODE=pilot`, SMTP en `127.0.0.1`, TLS desactivado y campos de autenticación vacíos. La captura local se documenta en `PILOT-MAIL-CAPTURE.md` y está prohibida en `production`.

Las claves oficiales de prueba de Cloudflare solo se permiten en E2E o cuando `DEPLOYMENT_MODE=pilot`. `deploy-frontend.sh` y `start-pocketbase.sh` siguen rechazándolas en `production`; el modo ausente se interpreta como `production`.

## Instagram · feed público

La Fase 1 lee las publicaciones de una cuenta profesional de Instagram desde PocketBase. React no recibe nunca el token de Meta y no carga el SDK de Instagram.

- `INSTAGRAM_FEED_ENABLED` — activar con `true` solo después de autorizar y probar la cuenta real. Con `false`, la sección pública permanece oculta.
- `INSTAGRAM_ACCESS_TOKEN` — Instagram User access token de la cuenta Business/Creator; **secreto y exclusivo del servidor**.
- `INSTAGRAM_API_VERSION` — versión de Graph usada por el backend; el valor preparado actualmente es `v26.0` y puede actualizarse sin recompilar React.
- `INSTAGRAM_FEED_LIMIT` — número máximo solicitado a Meta; admite de 1 a 12 y la Home muestra hasta 9.
- `INSTAGRAM_CACHE_SECONDS` — caché en memoria para evitar consultar Meta en cada visita; por defecto 900 segundos.

La app de Meta debe usar Instagram Login para una cuenta Business/Creator y disponer del permiso de lectura básico correspondiente (`instagram_business_basic`). El endpoint público de Language School devuelve únicamente metadatos necesarios para pintar el feed: id, tipo, imagen/miniatura, texto recortado, fecha y permalink. Nunca devuelve el access token.

Si Meta no responde, el backend intenta servir la última copia en memoria durante un periodo de gracia; si no existe copia, la Home oculta la sección y el resto de la web continúa funcionando.

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
2. Editar el archivo como root y sustituir todas las variables Turnstile obligatorias; añadir el token de Instagram únicamente si se va a activar el feed y añadir Zoom cuando se active.
3. No usar valores placeholder ni claves de prueba en producción.
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

7. Probar el formulario público: una solicitud válida debe llegar a Admin → Contactos y una llamada directa anónima a la colección `contact_requests` debe ser rechazada.
8. Si Instagram está activado, consultar `/api/language-school/instagram/feed` y verificar que responde `enabled: true` con publicaciones, sin ningún token o secreto en el JSON.
9. Desde **Admin → Zoom**, cuando Zoom esté configurado, verificar el estado de Server-to-Server OAuth y Meeting SDK. La interfaz debe mostrar únicamente estado/configuración, nunca secretos ni access tokens.

## Rotación

Si una credencial se rota en Turnstile, Instagram o Zoom:

1. reemplazar el valor únicamente en `/etc/language-school/production.env`;
2. reiniciar PocketBase;
3. repetir health check y la prueba funcional correspondiente;
4. revocar la credencial antigua en el proveedor cuando la nueva esté confirmada.

## Prohibiciones

No guardar secretos en:

- `.env.example` versionados con valores reales;
- React;
- `VITE_*`;
- issues/PRs/logs;
- `site_settings` u otras colecciones públicas;
- scripts shell del repositorio;
- documentación con valores concretos de producción.

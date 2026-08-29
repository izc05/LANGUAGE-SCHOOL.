# Language School V3 · Infraestructura de producción

Este directorio contiene el paquete reproducible para desplegar la V3 en Linux amd64 o ARM64 sin exponer PocketBase directamente a Internet. El mismo flujo sirve para el mini PC de preproducción y para la futura Raspberry Pi 4.

Los valores operativos se leen de `/etc/language-school/production.env`. Los puertos documentados aquí corresponden a la plantilla actual: Nginx `8083` y PocketBase `8091`, ambos únicamente en loopback.

## Arquitectura objetivo

```text
Internet
  -> Cloudflare Tunnel
  -> 127.0.0.1:8083 Nginx
       -> /        React/Vite estático
       -> /api/*   127.0.0.1:8091 PocketBase

SSD principal
  /opt/language-school/frontend
  /opt/language-school/pocketbase
    /pb_migrations
    /pb_hooks
  /var/lib/language-school/pb_data

Disco externo
  /mnt/language-school-backup/language-school
```

PocketBase escucha exclusivamente en `127.0.0.1:8091`. Nginx escucha exclusivamente en `127.0.0.1:8083`. El router no necesita publicar puertos entrantes.

## Versiones y decisiones fijadas

- PocketBase: `0.39.9`.
- Hosts: Linux `x86_64`/`amd64` y `aarch64`/`arm64`.
- Assets PocketBase: `linux_amd64` o `linux_arm64`, seleccionados automáticamente con `uname -m`.
- SHA-256 oficial e independiente para cada arquitectura, fijado en `.env.example` e `install-pocketbase.sh`.
- Usuario de servicio: `languageschool`.
- Frontend: `VITE_APP_MODE=connected`.
- `VITE_POCKETBASE_URL` se compila con el mismo `PUBLIC_ORIGIN` HTTPS de la web.
- `pb_migrations` y `pb_hooks` forman parte inseparable del runtime PocketBase de Language School.

## Directorios

```text
infrastructure/
  .env.example
  PRIVATE-VARIABLES.md
  raspberry-pi/
    prepare-production-env.sh
    install-pocketbase.sh
    language-school-pocketbase.service
    migrate.sh
    bootstrap-admin.sh
    deploy-frontend.sh
    health-check.sh
  reverse-proxy/
    language-school.nginx.conf
    install-nginx.sh
  cloudflare/
    README.md
    config.yml.example
  backups/
    backup.sh
    full-backup.sh
    restore.sh
    install-backup.sh
    install-full-backup.sh
    language-school-backup.service
    language-school-backup.timer
    language-school-full-backup.service
    language-school-full-backup.timer
```

## Requisitos del host

Antes del despliegue físico:

- Linux amd64 o ARM64.
- SSD principal correctamente montado/arrancable.
- `curl`, `unzip`, `sha256sum`, `jq`, `rsync` y `systemd`.
- Node.js `20.19+` o `22.12+` y npm para compilar el frontend, o un `dist/` precompilado preparado externamente.
- Nginx se puede instalar con `reverse-proxy/install-nginx.sh`.
- Disco externo montado antes de habilitar backup automático.

## Orden de instalación física

Ejecutar desde una copia actualizada del repositorio.

### 1. Preparar configuración local

```bash
sudo bash v3/infrastructure/raspberry-pi/prepare-production-env.sh
sudo nano /etc/language-school/production.env
```

Ajustar `PUBLIC_ORIGIN` al dominio HTTPS definitivo y `BACKUP_MOUNT` al mountpoint real. Si se activa Zoom, añadir únicamente en el host las variables descritas en `PRIVATE-VARIABLES.md`. El archivo real de producción no se guarda en GitHub.

### 2. Instalar PocketBase para la arquitectura del host

```bash
sudo bash v3/infrastructure/raspberry-pi/install-pocketbase.sh
```

El instalador detecta `x86_64`/`amd64` o `aarch64`/`arm64`, verifica el SHA-256 correspondiente, crea usuario/directorios, copia **migraciones y hooks server-side** y registra el servicio. No inicia todavía PocketBase.

Una instalación que no contenga `/opt/language-school/pocketbase/pb_hooks` es incompleta y el wrapper de arranque debe rechazarla.

### 3. Aplicar migraciones

```bash
sudo bash v3/infrastructure/raspberry-pi/migrate.sh
```

El script detecta tanto códigos de salida como mensajes de error impresos por PocketBase.

### 4. Crear superuser local + primer ADMIN de aplicación

```bash
sudo bash v3/infrastructure/raspberry-pi/bootstrap-admin.sh
```

Las contraseñas se piden de forma interactiva y no se escriben en archivos del repositorio.

### 5. Instalar Nginx local

```bash
sudo bash v3/infrastructure/reverse-proxy/install-nginx.sh
```

Nginx y PocketBase usan `PROXY_URL` y `PB_URL` de `/etc/language-school/production.env`. El instalador solo añade el sitio de Language School, valida la configuración global y recarga Nginx sin reemplazar otros sitios.

Con la plantilla actual:

```text
PROXY_URL=http://127.0.0.1:8083
PB_URL=http://127.0.0.1:8091
```

### 6. Compilar y desplegar frontend

```bash
bash v3/infrastructure/raspberry-pi/deploy-frontend.sh
```

El build fuerza `VITE_APP_MODE=connected`, exige un `PUBLIC_ORIGIN` HTTPS real y rechaza hosts locales o placeholder antes de publicar `dist/` en `/opt/language-school/frontend`.

### 7. Comprobar localmente

```bash
bash v3/infrastructure/raspberry-pi/health-check.sh
```

Debe validar servicio PocketBase, `/api/health` directo, `/api/health` mediante Nginx, frontend y bloqueo de `/_/`.

### 8. Crear Cloudflare Tunnel

Seguir `cloudflare/README.md`. El origen debe ser únicamente el `PROXY_URL` local. Con la plantilla actual:

```text
http://127.0.0.1:8083
```

### 9. Montar disco externo y habilitar backups

Configurar el disco para que `/mnt/language-school-backup` sea un mountpoint real y persistente. Después:

```bash
sudo bash v3/infrastructure/backups/install-backup.sh
sudo systemctl start language-school-backup.service
```

Para añadir una copia integral cifrada de recuperación sin sustituir el backup
diario de PocketBase:

```bash
sudo bash v3/infrastructure/backups/install-full-backup.sh
sudo systemctl start language-school-full-backup.service
```

La copia integral semanal incluye el frontend desplegado, runtime de PocketBase,
hooks y migraciones, código fuente + `git bundle`, configuración del host y un
backup de datos recién creado y validado. Los archivos se cifran con una clave
local `root:root` modo `0600`; debe conservarse una copia offline de esa clave
fuera tanto del mini PC como del disco de backup.

La primera ejecución manual debe completarse correctamente antes de confiar en el timer nocturno.

### 10. Probar restauración

No se considera producción terminada hasta restaurar una copia en una prueba controlada y pasar `health-check.sh`.

## Actualizaciones futuras

Para una versión nueva de la aplicación:

1. actualizar repositorio;
2. realizar backup;
3. ejecutar de nuevo `install-pocketbase.sh` para actualizar binario/runtime cuando corresponda, incluyendo `pb_migrations` y `pb_hooks`;
4. ejecutar `migrate.sh`;
5. reiniciar PocketBase si se han actualizado hooks;
6. ejecutar `deploy-frontend.sh`;
7. ejecutar `health-check.sh`.

No actualizar únicamente `pb_migrations`: los hooks server-side deben viajar con la misma revisión de la aplicación. Nunca sustituir `pb_data` manualmente durante una actualización ordinaria.

## Seguridad

- No publicar `8091` ni `8083` en el router; si los puertos se cambian en `production.env`, mantener igualmente ambos en loopback.
- No publicar PocketBase `/_/` mediante Nginx.
- No guardar superuser, ADMIN, secretos Zoom, token Cloudflare ni JSON de credenciales en GitHub.
- El superuser de PocketBase es para operación local excepcional; la academia se administra con un usuario `ADMIN` de aplicación.
- Los backups abortan si el destino configurado no es un mountpoint real.
- Antes de una migración de producción, realizar una copia válida.

# Language School V3 · Infraestructura de producción

Este directorio contiene el paquete reproducible para desplegar la V3 en una Raspberry Pi 4 ARM64 sin exponer PocketBase directamente a Internet.

## Arquitectura objetivo

```text
Internet
  -> Cloudflare Tunnel
  -> 127.0.0.1:8080 Nginx
       -> /        React/Vite estático
       -> /api/*   127.0.0.1:8090 PocketBase

SSD principal
  /opt/language-school/frontend
  /opt/language-school/pocketbase
  /var/lib/language-school/pb_data

Disco externo
  /mnt/language-school-backup/language-school
```

PocketBase escucha exclusivamente en `127.0.0.1:8090`. Nginx escucha exclusivamente en `127.0.0.1:8080`. El router no necesita publicar puertos entrantes.

## Versiones y decisiones fijadas

- PocketBase: `0.39.9`.
- Raspberry: sistema Linux ARM64.
- Asset PocketBase: `pocketbase_0.39.9_linux_arm64.zip`.
- SHA-256 fijado en `.env.example` e `install-pocketbase.sh`.
- Usuario de servicio: `languageschool`.
- Frontend: `VITE_APP_MODE=connected`.
- `VITE_POCKETBASE_URL` se compila con el mismo `PUBLIC_ORIGIN` HTTPS de la web.

## Directorios

```text
infrastructure/
  .env.example
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
    restore.sh
    install-backup.sh
    language-school-backup.service
    language-school-backup.timer
```

## Requisitos del host

Antes del despliegue físico:

- Linux ARM64.
- SSD principal correctamente montado/arrancable.
- `curl`, `unzip`, `sha256sum`, `jq`, `rsync` y `systemd`.
- Node.js/npm compatible con el frontend para compilar en la Raspberry, o un `dist/` precompilado preparado externamente.
- Nginx se puede instalar con `reverse-proxy/install-nginx.sh`.
- Disco externo montado antes de habilitar backup automático.

## Orden de instalación física

Ejecutar desde una copia actualizada del repositorio.

### 1. Preparar configuración local

```bash
sudo bash v3/infrastructure/raspberry-pi/prepare-production-env.sh
sudo nano /etc/language-school/production.env
```

Ajustar al menos `PUBLIC_ORIGIN`. El archivo real de producción no se guarda en GitHub.

### 2. Instalar PocketBase ARM64

```bash
sudo bash v3/infrastructure/raspberry-pi/install-pocketbase.sh
```

El instalador verifica arquitectura y SHA-256, crea usuario/directorios, copia migraciones y registra el servicio. No inicia todavía PocketBase.

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

Nginx queda en `127.0.0.1:8080` y PocketBase continúa en `127.0.0.1:8090`.

### 6. Compilar y desplegar frontend

```bash
bash v3/infrastructure/raspberry-pi/deploy-frontend.sh
```

El build usa `PUBLIC_ORIGIN` de `/etc/language-school/production.env` y publica `dist/` en `/opt/language-school/frontend`.

### 7. Comprobar localmente

```bash
bash v3/infrastructure/raspberry-pi/health-check.sh
```

Debe validar servicio PocketBase, `/api/health` directo, `/api/health` mediante Nginx y frontend.

### 8. Crear Cloudflare Tunnel

Seguir `cloudflare/README.md`. El origen debe ser únicamente:

```text
http://127.0.0.1:8080
```

### 9. Montar disco externo y habilitar backups

Configurar el disco para que `/mnt/language-school-backup` sea un mountpoint real y persistente. Después:

```bash
sudo bash v3/infrastructure/backups/install-backup.sh
sudo systemctl start language-school-backup.service
```

La primera ejecución manual debe completarse correctamente antes de confiar en el timer nocturno.

### 10. Probar restauración

No se considera producción terminada hasta restaurar una copia en una prueba controlada y pasar `health-check.sh`.

## Actualizaciones futuras

Para una versión nueva de la aplicación:

1. actualizar repositorio;
2. realizar backup;
3. copiar/actualizar migraciones en `/opt/language-school/pocketbase/pb_migrations` si han cambiado;
4. ejecutar `migrate.sh`;
5. ejecutar `deploy-frontend.sh`;
6. ejecutar `health-check.sh`.

Nunca sustituir `pb_data` manualmente durante una actualización ordinaria.

## Seguridad

- No publicar `8090` ni `8080` en el router.
- No publicar PocketBase `/_/` mediante Nginx.
- No guardar superuser, ADMIN, Cloudflare token ni JSON de credenciales en GitHub.
- El superuser de PocketBase es para operación local excepcional; la academia se administra con un usuario `ADMIN` de aplicación.
- Los backups abortan si el destino configurado no es un mountpoint real.
- Antes de una migración de producción, realizar una copia válida.

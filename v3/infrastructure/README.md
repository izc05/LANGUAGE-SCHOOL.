# Infraestructura · Language School V3

Objetivo de producción: Raspberry Pi 4 con SSD principal y segundo disco para copias de seguridad.

## Distribución prevista

```text
Raspberry Pi 4
├── Sistema operativo
├── Frontend Language School V3
├── PocketBase
├── Reverse proxy / HTTPS
├── SSD principal
│   ├── aplicación
│   ├── pb_data
│   └── archivos activos
└── Disco USB de backup
    └── copias versionadas
```

## Carpetas

- `raspberry-pi/`: instalación, servicios y mantenimiento.
- `reverse-proxy/`: configuración del proxy frontal.
- `cloudflare/`: documentación de DNS/túnel/HTTPS, sin secretos.
- `backups/`: scripts y política de backup, nunca los backups reales.

## Backups mínimos

Se respaldarán al menos:

- base de datos PocketBase
- archivos gestionados por PocketBase
- configuración necesaria para reconstruir el servicio

Los backups reales no se subirán a GitHub.

## Despliegue

La infraestructura se definirá cuando llegue el SSD. Primero se construirá y probará la aplicación con datos de demostración.

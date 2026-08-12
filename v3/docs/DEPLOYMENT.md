# Despliegue · Language School V3

## Entornos

### Desarrollo

- Frontend ejecutado en el equipo de desarrollo.
- PocketBase local o de pruebas.
- Datos exclusivamente de demostración.

### Producción

- Raspberry Pi 4.
- SSD principal para sistema, aplicación y datos activos.
- Segundo disco USB para backups.
- HTTPS delante de la aplicación.

## Principio de despliegue

El repositorio contiene el código y la configuración reproducible. Los datos persistentes viven fuera del checkout del repositorio.

```text
GitHub
  │
  └── código V3 + migraciones
            │
            ▼
      Raspberry Pi 4
            │
     ┌──────┴──────┐
     │             │
 frontend       PocketBase
                   │
                   ▼
                pb_data
                   │
                   ▼
                  SSD
```

## Antes de producción

No se abrirá la plataforma a alumnos reales hasta completar:

1. migraciones reproducibles;
2. reglas de acceso probadas por rol;
3. HTTPS;
4. límites y validación de archivos;
5. backup automático;
6. prueba real de restauración;
7. cuentas piloto sin datos sensibles innecesarios.

Los comandos concretos de instalación se añadirán cuando dispongamos del SSD y conozcamos el sistema definitivo de la Raspberry.

# PocketBase · Language School V3

PocketBase será el backend principal de la plataforma.

## Responsabilidades

- autenticación
- roles y reglas de acceso
- colecciones y relaciones
- API
- almacenamiento de archivos
- blog y contenidos editables
- datos académicos

## Estructura

```text
pocketbase/
├── pb_migrations/    # migraciones versionadas
├── pb_hooks/         # hooks versionados si fueran necesarios
└── README.md
```

`pb_data` NO forma parte del repositorio.

## Desarrollo

El esquema no se configurará únicamente de forma manual en producción. Las colecciones, campos, índices y reglas importantes deberán quedar reproducibles mediante migraciones.

## Producción

En Raspberry Pi se mantendrán separados:

- binario/servicio PocketBase
- código y migraciones
- `pb_data` persistente en SSD
- backups en segundo disco
- secretos y configuración local

## Regla de seguridad

La cuenta superuser se reserva para administración del backend y mantenimiento. El frontend público nunca recibirá sus credenciales.

# Language School V3

V3 de la plataforma de Language School, desarrollada dentro del repositorio existente y preparada para desplegarse en una Raspberry Pi 4 con PocketBase.

## Objetivos

- Web pública profesional y editable desde administración.
- Acceso privado para alumnos y profesores.
- Panel de administración completo.
- Blog y biblioteca multimedia gestionables sin tocar GitHub.
- Espacio privado de archivos por alumno.
- PocketBase como autenticación, API, base de datos y almacenamiento de archivos.
- Despliegue final en Raspberry Pi 4 con SSD y copias de seguridad en un segundo disco.

## Estructura

```text
v3/
├── frontend/                 # Aplicación web
│   ├── public/               # Recursos públicos estáticos
│   └── src/
│       ├── app/              # Arranque, providers y configuración global
│       ├── routes/           # Rutas públicas y privadas
│       ├── layouts/          # Layout público, alumno, profesor y admin
│       ├── pages/            # Páginas de cada área
│       ├── components/       # Componentes reutilizables
│       ├── features/         # Módulos funcionales
│       ├── services/         # PocketBase y servicios de aplicación
│       ├── hooks/            # Hooks reutilizables
│       ├── types/            # Tipos de dominio
│       ├── utils/            # Utilidades
│       └── styles/           # Diseño y estilos globales
│
├── pocketbase/               # Backend PocketBase versionado
│   ├── pb_migrations/        # Esquema y migraciones
│   ├── pb_hooks/             # Hooks del servidor si son necesarios
│   └── README.md
│
├── infrastructure/           # Despliegue de Raspberry Pi
│   ├── raspberry-pi/
│   ├── reverse-proxy/
│   ├── cloudflare/
│   └── backups/
│
├── docs/                     # Documentación del proyecto
│   ├── ARCHITECTURE.md
│   ├── DATA-MODEL.md
│   ├── ACCESS-RULES.md
│   ├── ROADMAP.md
│   └── DEPLOYMENT.md
│
├── .env.example
├── .gitignore
└── README.md
```

## Áreas de la plataforma

### Web pública

- Inicio
- Academia
- Cursos
- Precios
- Profesores
- Blog
- Contacto
- Acceso

### Alumno

- Dashboard
- Próximas clases
- Calendario
- Material
- Mis archivos
- Tareas
- Entregas
- Listening / recursos
- Avisos
- Perfil

### Profesor

- Dashboard
- Alumnos asignados
- Clases
- Material
- Tareas
- Correcciones
- Archivos de alumnos autorizados
- Avisos

### Administrador

- Dashboard
- Alumnos
- Profesores
- Cursos
- Clases
- Contenido de la web
- Blog
- Biblioteca multimedia
- Tarifas
- Configuración
- Estado del almacenamiento y copias

## Regla principal

GitHub contiene código, migraciones y documentación. Nunca contendrá datos reales de alumnos, contraseñas, tokens, `pb_data`, copias de seguridad ni archivos privados.

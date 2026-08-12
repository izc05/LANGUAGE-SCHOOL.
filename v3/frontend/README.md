# Language School V3 · Frontend

Aplicación web V3 de Language School. Está separada de la web HTML antigua mientras se desarrolla y valida.

## Estado actual

La fundación ya es una aplicación React + TypeScript + Vite con rutas reales y diseño responsive.

Rutas disponibles:

- `/` · web pública / portada
- `/blog` · blog público
- `/acceso` · acceso a la plataforma
- `/alumno` · dashboard de alumno (demo)
- `/profesor` · dashboard de profesor (demo)
- `/admin` · dashboard de administración (demo)

Las áreas privadas son todavía vistas de desarrollo. No existe autenticación real hasta conectar PocketBase.

## Arranque local

Desde esta carpeta:

```bash
npm install
npm run dev
```

Producción:

```bash
npm run build
npm run preview
```

## Organización

```text
src/
├── app/
│   └── App.tsx
├── components/
│   ├── SiteShell.tsx
│   └── DashboardShell.tsx
├── features/
├── pages/
│   ├── public/
│   ├── auth/
│   ├── student/
│   ├── teacher/
│   └── admin/
├── services/
│   └── pocketbase/
└── styles/
    └── global.css
```

## Principios

1. La web pública y los portales privados comparten una única aplicación y sistema visual.
2. Los datos de demostración se sustituirán por repositorios/servicios PocketBase, no por llamadas directas repartidas por los componentes.
3. Las reglas de privacidad se implementarán en PocketBase, además de ocultar opciones en la interfaz.
4. El administrador podrá gestionar contenido, blog, multimedia, cursos y usuarios sin editar GitHub.
5. Los archivos privados de alumnos nunca se incluirán en el repositorio.

## Próxima fase

- crear componentes reutilizables del CMS;
- construir editor de portada;
- construir biblioteca multimedia;
- construir gestión de artículos del blog;
- preparar cliente PocketBase y contratos TypeScript;
- añadir autenticación real cuando el backend esté disponible.

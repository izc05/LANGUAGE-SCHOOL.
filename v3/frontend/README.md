# Frontend · Language School V3

La V3 se construirá como una única aplicación web moderna con áreas públicas y privadas claramente separadas.

## Estructura prevista

```text
frontend/
├── public/
│   ├── images/
│   ├── icons/
│   └── fonts/
└── src/
    ├── app/
    │   ├── App.tsx
    │   ├── providers/
    │   └── config/
    ├── routes/
    │   ├── public.routes.tsx
    │   ├── student.routes.tsx
    │   ├── teacher.routes.tsx
    │   └── admin.routes.tsx
    ├── layouts/
    │   ├── PublicLayout.tsx
    │   ├── StudentLayout.tsx
    │   ├── TeacherLayout.tsx
    │   └── AdminLayout.tsx
    ├── pages/
    │   ├── public/
    │   ├── student/
    │   ├── teacher/
    │   └── admin/
    ├── features/
    │   ├── auth/
    │   ├── site-content/
    │   ├── blog/
    │   ├── media/
    │   ├── students/
    │   ├── teachers/
    │   ├── courses/
    │   ├── classes/
    │   ├── assignments/
    │   ├── files/
    │   └── notifications/
    ├── components/
    │   ├── ui/
    │   ├── navigation/
    │   ├── forms/
    │   └── feedback/
    ├── services/
    │   └── pocketbase/
    │       ├── client.ts
    │       ├── auth.ts
    │       └── files.ts
    ├── hooks/
    ├── types/
    ├── utils/
    └── styles/
```

## Criterios

- No mezclar lógica de administración con componentes públicos.
- Las páginas coordinan; la lógica de negocio vive en `features`.
- La conexión con PocketBase se centraliza en `services/pocketbase`.
- Los componentes genéricos viven en `components`.
- Los tipos compartidos viven en `types`.
- Las rutas privadas comprobarán sesión y rol, pero esto complementa —no sustituye— las reglas de PocketBase.

## Diseño

La identidad visual de la V3 se definirá después de dejar cerrados estructura, navegación y permisos. Evitaremos acoplar el modelo de datos al diseño visual.

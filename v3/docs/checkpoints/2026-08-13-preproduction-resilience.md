# Checkpoint · FASE 9.1B.10 · Resiliencia

Repositorio: `izc05/LANGUAGE-SCHOOL.`
Rama: `feat/v3-platform-structure`
PR: `#2`

## Estado al abrir la fase
- 9.1B.7 Mi perfil STUDENT/TEACHER: ✅ validada.
- 9.1B.8 accesibilidad estructural: ✅ validada.
- 9.1B.9 Centro de avisos ADMIN: implementación completa; confirmar conclusión E2E final antes de marcar cerrado en el registro principal.

## FASE 9.1B.10.1 · Resiliencia de backend — 🟡 EN CURSO

Archivos creados:
- `frontend/src/services/pocketbase/health.ts`
- `frontend/src/components/AppErrorBoundary.tsx`
- `frontend/src/components/BackendStatusBanner.tsx`
- `e2e/tests/backend-resilience.spec.ts`

### Objetivo
- detectar disponibilidad de PocketBase sin mostrar detalles internos;
- disponer de una barrera global ante errores inesperados de React;
- disponer de un banner accesible para degradación temporal del backend;
- comprobar que la web pública mantiene contenido seguro si `/api/*` deja de responder;
- comprobar que un fallo al enviar contacto genera un mensaje humano y no `ClientResponseError`/errores internos.

### Regla de seguridad de escritura
No se integra todavía `AppErrorBoundary` en `main.tsx` hasta confirmar el SHA actual del archivo. No se fuerza ninguna actualización con SHA incierto.

## Siguiente paso exacto
1. confirmar CI de `backend-resilience.spec.ts`;
2. recuperar SHA actual de `main.tsx`;
3. envolver la aplicación con `AppErrorBoundary`;
4. decidir dónde mostrar `BackendStatusBanner` sin saturar al usuario;
5. E2E de error global + reintento;
6. cerrar 9.1B.10 y consolidar `EXECUTION-LOG.md`.

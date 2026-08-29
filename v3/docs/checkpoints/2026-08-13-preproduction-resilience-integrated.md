# Checkpoint · FASE 9.1B.10 · Resiliencia integrada

Repositorio: `izc05/LANGUAGE-SCHOOL.`
Rama: `feat/v3-platform-structure`
PR: `#2`

## Implementado
- `health.ts` para `/api/health` con timeout.
- `useBackendHealth.ts`.
- `BackendStatusBanner.tsx`.
- `AppErrorBoundary.tsx` integrado en el root.
- `error-states.css`.
- health banner en web pública y portales.
- botón `Reintentar`.
- `/admin/sistema`.
- diagnóstico ADMIN: backend, latencia, modo y origen API sin mostrar credenciales.

## Pruebas añadidas
- `backend-resilience.spec.ts`.
- `backend-health-banner.spec.ts`.
- `route-smoke.spec.ts`.
- `system-status.spec.ts`.

### Cobertura esperada
- web pública no queda en blanco si `/api/*` falla.
- no se muestran `ClientResponseError` ni detalles internos.
- contacto comunica fallo humano si API no responde.
- caída de `/api/health` muestra aviso.
- recuperación + `Reintentar` oculta aviso.
- rutas públicas/ADMIN/TEACHER/STUDENT recorren Chromium sin errores runtime.
- `/admin/sistema` solo ADMIN.

## Estado de cierre
FASE 9.1B.10 queda **IMPLEMENTADA / VALIDACIÓN CI FINAL PENDIENTE DE CONFIRMAR**.
No marcar ✅ hasta ver Frontend + PocketBase + E2E verdes en el commit de integración.

## Nota previa
FASE 9.1B.9 Centro de avisos ADMIN también permanece `IMPLEMENTADA / CONFIRMACIÓN E2E FINAL` hasta leer su conclusión de workflow de forma inequívoca.

## Siguiente paso
1. leer conclusiones CI actuales;
2. corregir cualquier fallo;
3. cerrar 9.1B.9 y 9.1B.10 si están verdes;
4. abrir la siguiente fase de preproducción;
5. mantener Raspberry/SSD para FASE 9.2.

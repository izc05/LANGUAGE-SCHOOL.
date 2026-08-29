# Checkpoint · FASE 9.1B.11 · Preparación de piloto

Repositorio: `izc05/LANGUAGE-SCHOOL.`
Rama: `feat/v3-platform-structure`
PR: `#2`

## Bloque validado

### Identidad de academia
- web, acceso y portales reutilizan la identidad configurada en `site_settings`.
- login y Dashboard usan `useAcademyBrand()`.
- la sesión normal se presenta como acceso privado, sin nombres técnicos del backend.

### Portal Alumno
Estados vacíos/carga/error mejorados en:
- Archivos.
- Material.
- Tareas y entregas.
- Clases.
- Avisos.

Se reutiliza `PortalEmptyState` con explicaciones y acciones útiles.

### Portal Profesor
Mejorado hasta este checkpoint:
- Mis alumnos.
- Material.
- Tareas.
- Correcciones.

Cambios:
- retirada de textos visibles como `PocketBase`, `modo connected` y mensajes técnicos equivalentes;
- estados vacíos útiles;
- formularios bloqueados limpiamente cuando no existen destinos autorizados;
- mensajes de error orientados al usuario;
- estados técnicos traducidos a lenguaje de academia;
- feedback principal con `role=status` / `role=alert` donde aplica.

### Barrera E2E de lenguaje de piloto
`academy-brand.spec.ts` recorre rutas de Alumno y Profesor y falla si la interfaz normal expone:
- `PocketBase`;
- `ClientResponseError`;
- `Bearer `;
- `pb_data`.

## Validación
Sobre el bloque de cierre de esta tanda:
- V3 Frontend CI ✅
- V3 PocketBase CI ✅
- V3 Infrastructure CI ✅
- V3 E2E CI / Chromium ✅

## FASE 9.1B.11
Continúa **EN CURSO**.

## Siguiente microbloque
1. Clases y asistencia del Profesor.
2. revisión de estados/formularios ADMIN orientados a piloto.
3. revisión final de textos de desarrollo.
4. privacidad/legal permanece bloqueador explícito antes de piloto público real.
5. cerrar 9.1B.11 solo después de CI completo verde del HEAD final.

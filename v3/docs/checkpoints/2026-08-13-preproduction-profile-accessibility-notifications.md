# Checkpoint · Language School V3 · 2026-08-13

Rama: `feat/v3-platform-structure`
PR: `#2`

## FASE 9.1B.7 · Mi perfil — ✅ COMPLETADA

Implementado:
- `/alumno/perfil`
- `/profesor/perfil`
- `userProfile.ts`
- `AccountProfilePage.tsx`
- estilos responsive de cuenta
- navegación `Mi perfil` en Student y Teacher

Permisos de autoedición:
- nombre
- apellidos
- teléfono
- avatar

Protegido desde esta pantalla:
- email de solo lectura
- `role` no se envía
- `status` no se envía

Validación E2E:
- alumno cambia teléfono
- PocketBase persiste el cambio
- recarga conserva el dato
- email sigue bloqueado
- alumno sigue sin acceso a `/admin`
- profesor dispone de perfil propio

Frontend CI ✅
PocketBase CI ✅
E2E Chromium ✅

## FASE 9.1B.8 · UX y accesibilidad estructural — ✅ COMPLETADA

Implementado:
- skip-link `Saltar al contenido` en web pública y portales
- destino `#main-content` enfocable
- foco visible uniforme para teclado
- estado de comprobación de rutas privadas con `role=status` + `aria-live`
- soporte `prefers-reduced-motion`
- E2E de teclado y landmarks

Validado:
- Tab enfoca skip-link
- Enter lleva foco al contenido
- web pública y portal Student
- etiquetas del formulario público
- reducción de movimiento

Frontend CI ✅
PocketBase CI ✅
E2E Chromium ✅

## FASE 9.1B.9 · Centro de avisos ADMIN — 🟡 IMPLEMENTADA / VALIDACIÓN FINAL

Implementado:
- `adminNotifications.ts`
- `/admin/avisos`
- entrada `Avisos` en menú ADMIN
- destinatario individual
- envío a todos los alumnos activos
- tipos GENERAL / CLASS / MATERIAL / ASSIGNMENT / SYSTEM
- histórico de avisos
- contador de avisos sin leer en histórico ADMIN
- estilos responsive
- E2E `notification-flow.spec.ts`

Flujo que debe validar E2E:
`ADMIN → Avisos → enviar a E2E Student → logout → Student → Avisos → mensaje visible`

Recuperación de contraseña por email se deja para la fase de dominio/SMTP; no se simula como funcional antes de configurar correo saliente.

## Siguiente paso

1. confirmar validación final E2E de FASE 9.1B.9;
2. actualizar `EXECUTION-LOG.md` consolidando 9.1B.8/9;
3. continuar preproducción sin Raspberry;
4. mantener FASE 9.2 bloqueada hasta disponer de Raspberry + SSD.

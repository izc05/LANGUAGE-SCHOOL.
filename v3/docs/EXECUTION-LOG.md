# Language School V3 · Registro de ejecución

Este archivo es la **fuente de verdad** del desarrollo. Cada bloque se marca por fase, cambios realizados, validación y siguiente destino.

## Estado global
- Repositorio: `izc05/LANGUAGE-SCHOOL.`
- Rama: `feat/v3-platform-structure`
- PR: `#2`
- V3: `v3/`
- Frontend: React + TypeScript + Vite
- Backend: PocketBase `0.39.9`
- Producción prevista: Raspberry Pi 4 + SSD + disco externo de backup
- Frente activo: **desarrollo de piloto sobre el mini PC de preproducción**.
- Hardware: **FASE 9.2A completada en el mini PC**; la Raspberry Pi 4 continúa pendiente.
- HEAD estable de cierre 9.1B.10: `776640df0da5cb07fcc4fb9c0ea565da533f1259`.

### Estados
- ✅ COMPLETADA = implementada y validada.
- 🟡 EN CURSO = desarrollo/validación activa.
- ⏳ PENDIENTE = planificada.
- 🔒 BLOQUEADA = requiere hardware/dominio/decisión externa.

---

## FASE 0 · Arquitectura V3 — ✅ COMPLETADA
- `v3/frontend`, `v3/pocketbase`, `v3/infrastructure`, `v3/docs`.
- Web anterior intacta.
- Secretos, `.env`, `pb_data`, backups y datos privados fuera de GitHub.

## FASE 1 · Frontend público y portales — ✅ COMPLETADA
- Web pública, blog y acceso.
- Portales `/alumno`, `/profesor` y `/admin`.
- Responsive + GitHub Actions.

## FASE 2 · CMS y gestión académica visual — ✅ COMPLETADA
- ADMIN visual para Web, Multimedia, Blog, Alumnos, Profesores, Cursos y Clases.

## FASE 3 · Fundación PocketBase — ✅ COMPLETADA Y REVALIDADA

### Migraciones
1. `1786561920_create_identity_and_courses.js`
2. `1786562400_create_academic_core.js`
3. `1786563000_create_public_cms.js`
4. `1786563300_seed_blog_categories.js`
5. `1786563600_create_student_learning_core.js`
6. `1786563900_expand_teacher_student_scope.js`
7. `1786564200_tighten_teacher_authoring_scope.js`
8. `1786564500_allow_teacher_student_file_read.js`
9. `1786564800_tighten_teacher_attendance_scope.js`
10. `1786565100_expand_public_teacher_profile.js`
11. `1786565400_seed_about_page.js`

### Revalidación de fundación
- La migración 1 personaliza la colección `users` incorporada por PocketBase.
- Colecciones base con timestamps declaran `created` y `updated` como `autodate`.
- CI detecta errores impresos por `migrate up`/rollback aunque el proceso no falle por sí solo.
- PocketBase 0.39.9 real se levanta temporalmente en CI y pasa `/api/health`.
- Fresh database + todas las migraciones ✅
- Rollback ✅

## FASE 4 · CMS real ↔ PocketBase — ✅ COMPLETADA
- Home, editor, multimedia y blog conectados.
- Frontend CI ✅

## FASE 5 · Autenticación — ✅ COMPLETADA
- Login, refresh, cuenta `ACTIVE`, guards, redirección por rol y logout.
- Frontend CI ✅

---

## FASE 6 · Alumno real — ✅ COMPLETADA Y VALIDADA A/B
- `studentPortal.ts`.
- `/alumno`, `/alumno/archivos`, `/alumno/material`, `/alumno/tareas`, `/alumno/clases`, `/alumno/avisos`.
- Archivos privados protegidos.
- Alumno A no puede leer matrícula/usuario/grupo/archivo de Alumno B.
- Descarga protegida por token validada.
- Frontend CI ✅
- PocketBase CI ✅

## FASE 7 · Profesor real — ✅ COMPLETADA Y VALIDADA A/B
- `/profesor`, `/profesor/alumnos`, `/profesor/clases`, `/profesor/material`, `/profesor/tareas`, `/profesor/correcciones`.
- Profesor restringido a grupos/alumnos propios.
- Archivos del alumno: solo lectura/descarga con relación académica activa.
- Asistencia solo de alumnos `ACTIVE` del grupo.
- Profesor A/B y revocación al pausar matrícula validados en PocketBase real temporal.
- Frontend CI ✅
- PocketBase CI ✅

## FASE 8 · Administración académica real — ✅ COMPLETADA Y VALIDADA END-TO-END
- `adminAcademic.ts` centraliza usuarios, perfiles, cursos, grupos, matrículas, clases y asistencia.
- `/admin/alumnos` real.
- `/admin/profesores` real.
- `/admin/cursos` real: cursos, grupos, profesor, capacidad, matrícula y ocupación.
- `/admin/clases` real: calendario semanal, estados y asistencia global.
- `admin-flow-smoke.sh` prueba `ADMIN → profesor → alumno → curso → grupo → matrícula → clase → asistencia`.
- Frontend CI ✅
- PocketBase CI ✅

---

## FASE 9 · Producción y preproducción — 🟡 EN CURSO

### 9.1 Paquete reproducible de producción — ✅ COMPLETADA Y VALIDADA
Arquitectura:
`Internet → Cloudflare Tunnel → 127.0.0.1:8080 Nginx → React + /api/* → 127.0.0.1:8090 PocketBase`.

Preparado:
- PocketBase ARM64 fijado y checksum validado.
- systemd, migraciones, bootstrap ADMIN, frontend y health-check.
- Nginx/PocketBase solo localhost.
- Cloudflare hacia Nginx.
- backup/restore con checksum, mountpoint, retención y rollback.
- timer, runbook, checklist y V3 Infrastructure CI ✅

### 9.1B Preproducción en GitHub — 🟡 EN CURSO

#### 9.1B.1 Auditoría ADMIN — ✅ COMPLETADA
- `/admin/tarifas` real.
- `/admin/configuracion` real.
- logo, datos de contacto, redes y tarifas gestionables desde PocketBase.

#### 9.1B.2 E2E conectado — ✅ COMPLETADA
`V3 E2E CI` levanta PocketBase real temporal + frontend connected + Chromium.
- login y redirección ADMIN/TEACHER/STUDENT.
- navegación y rechazo de rutas por rol.
- logout y responsive.

#### 9.1B.3 Programas / Tarifas / Contacto — ✅ COMPLETADA
- `/programas` desde cursos públicos reales.
- `/tarifas` desde planes activos reales.
- `/contacto` crea `contact_requests` en PocketBase.
- `SiteShell` consume `site_settings` para marca/logo/contacto.
- demo no se mezcla con producción connected.

#### 9.1B.4 Web pública completa y endurecimiento — ✅ COMPLETADA
- `/profesores` con perfiles públicos separados de cuentas privadas.
- `/admin/profesores/publicos`.
- email/teléfono del profesor no salen en la web pública.
- `/sobre-nosotros` y `/admin/web/sobre-nosotros` editables desde `site_pages`.
- SEO básico por ruta.
- 404 público real.
- cabecera responsive a 390 px y 768 px sin desbordamiento.
- PocketBase CI ✅
- Frontend CI ✅
- E2E Chromium ✅

#### 9.1B.5 Solicitudes de contacto ADMIN — ✅ COMPLETADA
- `contactRequests.ts`.
- `/admin/contactos`.
- filtros `ALL / NEW / CONTACTED / CLOSED`.
- transiciones de estado sin borrar histórico.
- contador real de nuevas solicitudes.
- E2E `visitante → formulario → PocketBase → ADMIN → CONTACTED → CLOSED` ✅

#### 9.1B.6 Dashboard ADMIN real — ✅ COMPLETADA
- alumnos activos reales.
- profesores activos reales.
- artículos y borradores reales.
- archivos privados activos reales.
- solicitudes nuevas reales.
- últimos artículos reales.
- eliminadas cifras operativas hardcodeadas en connected.
- Frontend CI ✅
- PocketBase CI ✅
- E2E ✅

#### 9.1B.7 Mi perfil STUDENT / TEACHER — ✅ COMPLETADA
Rutas:
- `/alumno/perfil`
- `/profesor/perfil`

Implementado:
- `userProfile.ts`.
- `AccountProfilePage.tsx` compartida.
- nombre, apellidos, teléfono y avatar editables por el propio usuario.
- email de solo lectura.
- `role` y `status` fuera del payload de autoedición.
- sesión sincronizada tras guardar.

E2E:
- Alumno cambia teléfono, guarda y persiste tras recarga ✅
- email continúa protegido ✅
- acceso a `/admin` sigue rechazado ✅
- Profesor dispone de perfil propio ✅

#### 9.1B.8 UX y accesibilidad estructural — ✅ COMPLETADA
- skip-link `Saltar al contenido` en web y portales.
- `#main-content` enfocable.
- foco visible de teclado.
- landmarks principales.
- etiquetas esenciales de formularios.
- `prefers-reduced-motion`.
- E2E real con Tab + Enter ✅

#### 9.1B.9 Centro de avisos ADMIN — ✅ COMPLETADA
- `adminNotifications.ts`.
- `/admin/avisos`.
- destinatario individual o todos los alumnos activos.
- tipos GENERAL / CLASS / MATERIAL / ASSIGNMENT / SYSTEM.
- histórico y estado leído/sin leer.
- E2E real `ADMIN → enviar aviso → STUDENT → Avisos` ✅

#### 9.1B.10 Resiliencia, errores y diagnóstico — ✅ COMPLETADA
Implementado:
- `health.ts` para `/api/health` con timeout.
- `useBackendHealth.ts`.
- `BackendStatusBanner.tsx`.
- `AppErrorBoundary.tsx` integrado en el root.
- `error-states.css`.
- aviso de caída de PocketBase en web pública y portales.
- botón `Reintentar`.
- `/admin/sistema` con health-check, latencia, modo y origen API sin credenciales.
- menú ADMIN largo con scroll interno para que todos los módulos sean alcanzables.
- smoke runtime de rutas públicas, ADMIN, TEACHER y STUDENT.

Validación de cierre sobre `776640df0da5cb07fcc4fb9c0ea565da533f1259`:
- V3 Frontend CI #270 ✅
- V3 PocketBase CI #235 ✅
- V3 Infrastructure CI #115 ✅
- V3 E2E CI #103 ✅
- Chromium: **26/26 tests** ✅

#### 9.1B.11 Preparación de piloto — 🟡 EN CURSO
Objetivos iniciales obtenidos de auditoría real:
1. unificar identidad de academia en web, login y portales mediante `site_settings`;
2. retirar referencias técnicas visibles a PocketBase/tokens del flujo normal de Alumno/Profesor;
3. mejorar estados vacíos/carga/error con lenguaje y acciones útiles;
4. limpiar textos residuales de desarrollo;
5. revisar formularios y feedback de interacción;
6. registrar privacidad/legal como bloqueador explícito del piloto público hasta completar textos reales y datos del responsable;
7. mantener la validación E2E completa después de cada bloque.

### FASE 9.2A · MINI PC PREPRODUCCIÓN — ✅ COMPLETADA

- Host real: `Isi-Minipc`, Ubuntu 24.04.4 LTS, `x86_64` / `linux_amd64`.
- Checkout: `/home/isi/projects/language-school`, rama `feat/v3-platform-structure`.
- PocketBase 0.39.9: checksum oficial verificado, migraciones PASS y servicio activo en `127.0.0.1:8091`.
- Frontend: TypeScript PASS, Vite PASS, 0 vulnerabilidades y despliegue en `/opt/language-school/frontend`.
- Nginx 1.24.0: activo exclusivamente en `127.0.0.1:8083` para Language School.
- `/api/health`: PASS directo y mediante Nginx.
- `/_/`: bloqueado mediante Nginx con HTTP 404.
- Superusuario y primer ADMIN creados; acceso a `/admin` confirmado por Isi.
- `/admin/web`: acceso autenticado PASS, botones de borrador/publicación presentes, vista previa PASS y sin nombres técnicos visibles.
- Backup físico en `/mnt/pocketbase-backup`: primera copia y checksum PASS; timer nocturno activo.
- Restauración física: pendiente de prueba específica; no se marca como completada.
- Atelier Lumière, Docker, Cloudflare y PocketBase preexistente: activos e intactos.
- Cloudflare público, DNS y HTTPS: no configurados todavía.
- HEAD de código desplegado: `924772e378b0582735edae8942e163997c610552`.
- CI: Frontend, PocketBase e Infrastructure PASS; E2E **30/30 PASS**.
- Redespliegue realizado exclusivamente sobre el frontend; esquema, migraciones, `pb_data`, usuarios, Nginx, puertos, Cloudflare, backup y Atelier Lumière no se modificaron.
- Detalle completo: `v3/docs/MINI-PC-DEPLOYMENT-LOG.md`.

### 9.2 Raspberry + SSD — 🔒 PENDIENTE DE HARDWARE
1. instalar sistema ARM64 en SSD;
2. confirmar boot desde SSD;
3. configurar usuario, SSH, hostname y red;
4. clonar/actualizar repositorio;
5. aplicar paquete 9.1.

### 9.3 HTTPS / acceso exterior — ⏳ PENDIENTE DE 9.2
- Cloudflare Tunnel.
- dominio/subdominio definitivo.
- HTTPS y `/api/health` exterior.
- confirmar que `/_/` no está publicado.
- SMTP/recuperación de contraseña real.

### 9.4 Backup/restore físico — ⏳ PENDIENTE DE 9.2
- disco externo por UUID.
- primera copia manual.
- habilitar timer.
- probar ausencia de disco.
- restauración real.

## FASE 10 · Piloto y endurecimiento — ⏳ PENDIENTE
- 2–3 alumnos.
- pruebas funcionales finales.
- backups/restauración.
- móvil.
- accesibilidad final.
- errores/logs.
- piloto controlado.

---

## Dirección del proyecto
`Estructura → Frontend → CMS → PocketBase → Login → Alumno → Profesor → Admin → Seguridad A/B → Producción preparada → Preproducción/E2E → Raspberry → Piloto`

Cada sesión debe empezar leyendo este archivo y actualizarlo al finalizar cada bloque relevante.

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
- Frente activo: **FASE 9.1B.8 · UX, accesibilidad y estados de interacción**
- Hardware: **FASE 9.2 sigue pendiente**, pero no bloquea la preproducción en GitHub.

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

#### 9.1B.1 Auditoría ADMIN — ✅
- `/admin/tarifas` real.
- `/admin/configuracion` real.
- logo, datos de contacto, redes y tarifas gestionables desde PocketBase.

#### 9.1B.2 E2E conectado — ✅
`V3 E2E CI` levanta PocketBase real temporal + frontend connected + Chromium.
- login y redirección ADMIN/TEACHER/STUDENT.
- navegación y rechazo de rutas por rol.
- logout y responsive.

#### 9.1B.3 Programas / Tarifas / Contacto — ✅
- `/programas` desde cursos públicos reales.
- `/tarifas` desde planes activos reales.
- `/contacto` crea `contact_requests` en PocketBase.
- `SiteShell` consume `site_settings` para marca/logo/contacto.
- demo no se mezcla con producción connected.

#### 9.1B.4 Web pública completa y endurecimiento — ✅
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
Implementado:
- `contactRequests.ts`.
- `/admin/contactos`.
- filtros `ALL / NEW / CONTACTED / CLOSED`.
- nombre, email, teléfono, interés, mensaje y fecha.
- transiciones de estado sin borrar el histórico.
- contador real de nuevas solicitudes.

E2E real:
`visitante → formulario → PocketBase → ADMIN → Contactos → CONTACTED → CLOSED` ✅

#### 9.1B.6 Dashboard ADMIN real — ✅ COMPLETADA
- `adminDashboard.ts`.
- alumnos activos reales.
- profesores activos reales.
- artículos y borradores reales.
- archivos privados activos reales.
- solicitudes nuevas reales.
- últimos artículos reales.
- eliminadas las cifras operativas hardcodeadas en modo connected.
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
- `role` y `status` no forman parte del payload de autoedición.
- sesión sincronizada tras guardar.
- navegación `Mi perfil` en Alumno y Profesor.

E2E real:
- Alumno cambia teléfono y guarda ✅
- recarga y el dato persiste ✅
- email continúa protegido ✅
- acceso a `/admin` sigue rechazado ✅
- Profesor dispone de perfil propio ✅
- Frontend CI ✅
- PocketBase CI ✅
- E2E Chromium ✅

#### 9.1B.8 UX, accesibilidad y estados de interacción — 🟡 EN CURSO
Objetivo:
- salto directo al contenido principal.
- foco de teclado visible.
- navegación por teclado comprobada en web y portales.
- anuncios accesibles para estados/errores principales.
- comprobar etiquetas y landmarks esenciales.
- E2E específico de teclado y accesibilidad estructural.

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

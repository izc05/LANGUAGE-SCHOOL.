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
- Frente activo: **FASE 9.1B.5 · Bandeja ADMIN de solicitudes de contacto**
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

Preparado en `v3/infrastructure/`:
- PocketBase 0.39.9 ARM64 fijado y checksum oficial validado.
- servicio `systemd` endurecido.
- migraciones, bootstrap ADMIN, deploy frontend y health-check.
- Nginx localhost-only.
- Cloudflare Tunnel hacia Nginx, nunca PocketBase directo.
- backup con comprobación de mountpoint, checksum y retención.
- restore con rollback automático si PocketBase no vuelve sano.
- timer nocturno.
- runbook y checklist de producción.
- V3 Infrastructure CI ✅

### 9.1B Preproducción en GitHub — 🟡 EN CURSO

#### 9.1B.1 Auditoría ADMIN — ✅ COMPLETADA
Se detectaron y corrigieron enlaces sin ruta real:
- `/admin/tarifas`
- `/admin/configuracion`

Implementado:
- `siteManagement.ts`.
- `/admin/tarifas`: CRUD de `pricing_plans`, activar/ocultar/destacar/eliminar.
- `/admin/configuracion`: nombre academia, logo, dirección, email, teléfono, WhatsApp y redes.
- modo demo preservado.
- Frontend CI ✅

#### 9.1B.2 E2E de navegador — ✅ COMPLETADA
Se añadió `v3/e2e/` con Playwright y workflow `V3 E2E CI`.

El pipeline ejecuta:
1. PocketBase 0.39.9 temporal desde cero.
2. migraciones reales.
3. usuarios E2E ADMIN / TEACHER / STUDENT.
4. frontend compilado con `VITE_APP_MODE=connected`.
5. Chromium real.
6. login y redirección por rol.
7. navegación ADMIN/TEACHER/STUDENT.
8. rechazo de rutas de otros roles.
9. logout.
10. comprobaciones responsive.

Resultado: V3 E2E CI ✅

#### 9.1B.3 Web pública Programas/Tarifas/Contacto — ✅ COMPLETADA
Rutas:
- `/programas`
- `/tarifas`
- `/contacto`

Implementado:
- `publicAcademy.ts`.
- Programas leen cursos `ACTIVE + public_visible` de PocketBase.
- Tarifas leen solo planes `active` de PocketBase.
- datos demo no aparecen en modo connected si la colección real está vacía.
- Contacto crea `contact_requests` con estado `NEW`.
- `SiteShell` lee `site_settings` para nombre, logo, dirección, email, teléfono e Instagram.
- el logo subido desde ADMIN puede mostrarse automáticamente en header/footer.
- estados vacíos seguros.

Validación E2E:
- curso público desde PocketBase ✅
- tarifa pública desde PocketBase ✅
- formulario de contacto crea solicitud ✅
- roles privados siguen funcionando ✅

#### 9.1B.4 Web pública completa y endurecimiento — ✅ COMPLETADA

##### 9.1B.4.1 Profesores públicos — ✅
Migración 10 `1786565100_expand_public_teacher_profile.js` añade al perfil docente:
- `display_name`
- `headline`
- `sort_order`

Implementado:
- `teacherProfiles.ts`.
- `/profesores`.
- `/admin/profesores/publicos`.
- nombre público, titular, bio, especialidades, orden, foto y visibilidad gestionables por ADMIN.
- la web pública **no expande `users`** para mostrar profesores.
- email/teléfono privados permanecen fuera del payload público.

E2E demuestra:
- profesor público visible ✅
- email privado ausente de `/profesores` ✅
- editor ADMIN accesible ✅

##### 9.1B.4.2 Sobre nosotros — ✅
Migración 11 `1786565400_seed_about_page.js` crea `site_pages/about` editable.

Implementado:
- `/sobre-nosotros`.
- `/admin/web/sobre-nosotros`.
- cabecera, introducción, historia, valores y cierre editables.
- publicar o guardar borrador.
- navegación pública y ADMIN integradas.

Validación:
- PocketBase CI ✅
- Frontend CI ✅
- Chromium E2E ✅

##### 9.1B.4.3 SEO básico + 404 + responsive — ✅
Implementado:
- `NotFoundPage.tsx` y 404 real para URLs públicas desconocidas.
- las rutas privadas desconocidas siguen regresando a su dashboard de rol.
- `title` y `meta description` específicos para Inicio, Programas, Profesores, Sobre nosotros, Tarifas, Blog y Contacto.
- título/description propios para 404.
- cabecera pública adaptada al menú completo.
- en tablet/móvil la navegación pasa a segunda fila desplazable internamente.
- corrección de la regla antigua que ocultaba `.main-nav` bajo 720 px.

E2E demuestra:
- URL desconocida no redirige silenciosamente a Inicio ✅
- SEO por ruta ✅
- navegación pública visible a 390 px y 768 px ✅
- sin scroll horizontal de página ✅
- Frontend CI ✅
- PocketBase CI ✅
- V3 E2E CI ✅

#### 9.1B.5 Solicitudes de contacto ADMIN — 🟡 EN CURSO
Objetivo:
- bandeja `/admin/contactos`.
- filtro por `NEW`, `CONTACTED`, `CLOSED`.
- detalle de nombre, email, teléfono, interés, mensaje y fecha.
- transición de estado sin borrar histórico.
- contador de solicitudes nuevas en Dashboard.
- E2E `visitante envía → ADMIN la ve → marca CONTACTED/CLOSED`.

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
- accesibilidad.
- errores/logs.
- piloto controlado.

---

## Dirección del proyecto
`Estructura → Frontend → CMS → PocketBase → Login → Alumno → Profesor → Admin → Seguridad A/B → Producción preparada → Preproducción web/E2E → Raspberry → Piloto`

Cada sesión debe empezar leyendo este archivo y actualizarlo al finalizar cada bloque relevante.

# Language School · FASE 9.7 · Rendimiento

## Estado

**9.7A ✅ · 9.7B ✅ · 9.7C IMPLEMENTADA / VALIDACIÓN FINAL · 9.7D AUDITORÍA SIN CAMBIOS DE PRODUCTO**

Esta fase optimiza carga sin degradar la dirección visual aprobada. El globo rosa, avión 3D, fotografía, tipografía y composición no se eliminan para perseguir métricas marginales.

## 1. Baseline original

Medición inicial del build conectado:

- JavaScript principal minificado: **1.664.973 bytes (~1,66 MB)**.
- JavaScript principal gzip: **432.646 bytes (~433 kB)**.
- CSS principal: **411.441 bytes (~411 kB)**.
- CSS gzip: **71.248 bytes (~71 kB)**.
- Build descomprimido completo: **~2,2 MB**.
- La aplicación estaba prácticamente concentrada en un único chunk JavaScript.

La causa principal era que `App.tsx` importaba estáticamente páginas públicas, Campus, Profesor y Administración. Además, la entrada premium incorpora Three.js / React Three Fiber, un coste visual legítimo que no debía arrastrar el resto de la plataforma.

## 2. 9.7A · Lazy routes ✅

Cierre técnico: `d14d72108896a9a9263bb81c1e29f6d98760e75e`.

Resultado medido:

- JS común: **~200,5 kB minificado / ~62,6 kB gzip**.
- reducción aproximada frente al baseline: **~88 % minificado / ~85 % gzip**;
- Admin, Profesor, Campus y páginas públicas pasan a chunks independientes;
- rutas y guards no cambian;
- E2E se adapta a carga asíncrona sin sleeps artificiales;
- matriz CI completa verde.

Después de 9.7A el coste 3D quedó visible como deuda independiente: `IntroGatePage` seguía pesando aproximadamente **906,73 kB / 246,32 kB gzip**, porque el gate importaba estáticamente el artwork 3D aunque la sesión ya hubiese completado la intro.

## 3. 9.7B · Entrada premium ✅

Cierre técnico: `b84d5a2f58e1f0dc73f06f30a0eec51848784198`.

### Cambio

`IntroGatePage` deja de importar estáticamente Home y `IntroOrbitArtwork`.

Ahora:

- `HomePage` es lazy e independiente;
- `IntroPage` es lazy e independiente;
- Three.js / React Three Fiber permanecen dentro de `IntroPage`;
- el gate usa un lockup CSS ligero para estado de carga/error;
- la sesión se sigue controlando mediante `sessionStorage`;
- el componente 3D normal no cambia.

### Bundle medido

Antes de 9.7B:

- `IntroGatePage`: **906,73 kB / 246,32 kB gzip**.

Después de 9.7B:

- `IntroGatePage`: **3,55 kB / 1,34 kB gzip**;
- `HomePage`: **20,16 kB / 5,29 kB gzip**;
- `IntroPage` 3D: **885,95 kB / 240,73 kB gzip**;
- JS común: **200,74 kB / 62,56 kB gzip**.

El peso 3D no se ha escondido ni recortado: queda **aislado y se descarga solo cuando la sesión necesita mostrar la entrada**.

### Contrato visual preservado

No se modificaron:

- Tierra/esfera rosa giratoria;
- cartografía detallada y fallback local;
- océano transparente/blanco;
- logo fijo;
- avión 3D orbitando;
- transición de entrada;
- reduced motion del globo/intro.

### Validación E2E

`intro-performance-phase9b.spec.ts` comprueba:

1. primera visita sin flag de sesión;
2. marca visible;
3. canvas real `.intro-orbit-globe-canvas canvas` visible;
4. botón `ENTRAR` visible;
5. transición a Home;
6. `sessionStorage` marcado como completado;
7. recarga de `/` en la misma sesión;
8. Home visible sin canvas de intro;
9. recursos de esa recarga **sin solicitud de `IntroPage-*.js`**.

Matriz sobre `b84d5a2f58e1f0dc73f06f30a0eec51848784198`:

- V3 Frontend CI ✅
- V3 PocketBase CI ✅
- V3 Infrastructure CI ✅
- V3 Observability CI ✅
- V3 Backup Restore CI ✅
- V3 Zoom Classroom CI ✅
- V3 E2E CI ✅

## 4. 9.7C · CSS + fuentes

Candidato técnico de aplicación: `c6302ccfe711a36a1dc72af4e2e5cf81156eaf98`.

### Hallazgo

El CSS global carga `DM Sans` + `Playfair Display`, parte del lenguaje editorial actual.

La intro carga además `Montserrat` + `Playball`. La revisión confirma que **sí son usadas por la entrada premium aprobada**, por lo que no deben eliminarse.

Tras 9.7B el gate ligero aún importaba el CSS completo de la intro. Eso permitía que una sesión que saltaba directamente a Home solicitase recursos tipográficos exclusivos de una intro que no iba a mostrar.

### Implementación

- `IntroGatePage` importa únicamente `intro-gate-light.css`;
- el fallback/loading usa DM Sans + Playfair ya disponibles;
- `premium-intro.css` + `intro-orbit-refresh.css` permanecen dentro del camino lazy de `IntroPage`;
- Montserrat + Playball permanecen exactamente en la intro real;
- globo, avión, cartografía y transición real no se modifican.

### Medición

Antes de 9.7C:

- CSS del gate: **9,97 kB / 2,72 kB gzip**.

Después de 9.7C:

- `IntroGatePage.css`: **4,08 kB / 1,46 kB gzip**;
- `IntroPage.css` completo: **11,04 kB / 2,90 kB gzip**, solo en la ruta lazy de intro;
- gate JS: **3,27 kB / 1,23 kB gzip**;
- Home JS: **20,16 kB / 5,29 kB gzip**;
- Intro 3D JS: **885,91 kB / 240,72 kB gzip**;
- JS común: **200,74 kB / 62,57 kB gzip**.

### E2E

La returning session está verificada para que no solicite:

- `IntroPage-*.js`;
- `IntroPage-*.css`;
- Google Fonts con Montserrat o Playball.

La primera visita sigue conservando el canvas 3D real y el botón `ENTRAR`.

Validaciones que ya han terminado sobre `c6302ccf…`:

- Frontend ✅
- PocketBase ✅
- Observability ✅
- Backup Restore ✅
- E2E ✅

Infrastructure y Zoom Classroom quedaron anormalmente largos dentro de pasos de instalación/validación Nginx del runner. No hay indicio de regresión de producto; se mantiene la regla de no declarar cierre 7/7 hasta disponer de una matriz completa limpia.

## 5. 9.7D · Fotografías y fallbacks — auditoría

La revisión confirma que la V2 ya sigue, en general, el orden visual correcto:

1. **fotografía/portada publicada desde Admin/CMS**;
2. fotografía editorial de respaldo cuando no existe material administrado;
3. SVG local solo como último salvavidas cuando corresponde.

### Programas

`ProgramsPage` prioriza explícitamente:

`coverUrl || adminFallbackUrl || editorialPhoto`

con SVG local como capa final. No debe invertirse este orden: reemplazar fotografía real por ilustración solo para ahorrar peticiones degradaría la dirección visual aprobada.

### Home

Home resuelve imágenes de hero, etapas, método, journal, profesores y sobre nosotros mediante `media_library`/CMS cuando están configuradas. `photography-pass-v2.css` conserva fotografías editoriales remotas como respaldo cuando el CMS no aporta imagen.

### Profesores / Sobre nosotros / Tarifas

Estas páginas consultan `getPublishedHomeVisualUrl(...)`; las imágenes administradas tienen prioridad. En ausencia de foto CMS existe una composición local/ilustrada y/o fotografía editorial de respaldo según la capa visual de cada página.

### Decisión 9.7D

No se justifica un cambio automático de código que sustituya fotografías editoriales por SVG locales. La mejora correcta para producción es **cargar fotografías reales de la academia desde Admin/CMS**; así se reduce la dependencia de fallbacks externos sin perder humanidad ni calidad.

Tampoco se introduce ahora un IntersectionObserver específico para backgrounds CSS: añadir lógica de lazy-loading propia a múltiples heroes y tarjetas tendría más riesgo de regresión visual que beneficio medido en esta etapa.

Por tanto, salvo que una validación real de red detecte una carga problemática concreta, **9.7D debe cerrarse como auditoría sin cambio de producto**.

## 6. Guardias obligatorias

Cada optimización debe mantener:

- Frontend CI ✅;
- PocketBase CI ✅ cuando aplique;
- Infrastructure / Observability / Backup / Zoom CI ✅;
- E2E CI ✅;
- Intro funcional;
- 1440 / 1180 / 820 / 390 sin overflow;
- teclado y foco visible;
- `prefers-reduced-motion`;
- rutas privadas protegidas;
- ningún cambio de datos, CMS, roles o permisos;
- PR #11 Draft y `main` intacta.

## Siguiente acción

Obtener una matriz 7/7 limpia para cerrar 9.7C. Después cerrar formalmente 9.7D como auditoría de fotografías/fallbacks sin degradar el diseño y pasar a **9.8 · despliegue/piloto**, manteniendo como pendientes externos las credenciales reales, Cloudflare real y backup físico.
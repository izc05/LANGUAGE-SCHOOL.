# Language School · FASE 9.7 · Rendimiento

## Estado

**9.7A ✅ · 9.7B ✅ · 9.7C SIGUIENTE**

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

## 4. CSS y fuentes

El CSS global carga `DM Sans` + `Playfair Display`, que forman parte del lenguaje editorial actual.

La intro carga además `Montserrat` + `Playball`. La revisión confirma que **sí son usadas por la entrada premium aprobada**, por lo que no deben eliminarse.

Sin embargo, tras 9.7B el gate ligero todavía importa CSS completo de la intro. Ese CSS contiene la petición de Montserrat/Playball, de modo que una sesión que salta directamente a Home puede solicitar fuentes exclusivas de una intro que no va a mostrar.

Esto define el alcance seguro de 9.7C.

## 5. 9.7C · CSS + fuentes — SIGUIENTE

Alcance aprobado:

- separar el CSS mínimo del gate/fallback del CSS completo de la intro;
- mover `premium-intro.css` + `intro-orbit-refresh.css` al camino lazy de `IntroPage` únicamente;
- mantener Montserrat + Playball exactamente para la intro real;
- impedir que una sesión completada las cargue solo por visitar Home;
- medir de nuevo CSS/chunks;
- añadir guardia E2E para primera visita y returning session.

No hacer todavía:

- refactor masivo de las numerosas hojas históricas;
- eliminación de reglas visuales por nombre;
- cambio de tipografía de la intro;
- cambio del sistema visual del Campus o la web pública.

## 6. 9.7D · Fotografías y fallbacks

Pendiente después de 9.7C:

- inventariar recursos externos/hardcoded restantes;
- preferir CMS/fotografía real cuando exista;
- comprobar lazy loading y tamaños;
- no sustituir fotografía o composición editorial solo para ahorrar unos pocos kB.

## 7. Guardias obligatorias

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

Implementar exclusivamente **9.7C · aislamiento de CSS/fuentes de la intro**, medir el artefacto y volver a exigir 7/7 workflows verdes antes de abrir 9.7D.

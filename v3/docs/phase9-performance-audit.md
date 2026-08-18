# Language School · FASE 9.7 · Auditoría de rendimiento

## Estado

**AUDITORÍA DOCUMENTADA · NO IMPLEMENTAR OPTIMIZACIONES HASTA CERRAR LA PUERTA DE CÓDIGO DE 9.6A**

Medición tomada sobre el build conectado generado por **V3 Frontend CI** para `e2d5632ed05c158b9a0479a50342024a9d18c605`.

Esta auditoría no cambia diseño, contenido, rutas ni comportamiento. Su objetivo es decidir qué optimizaciones tienen impacto real antes de tocar la candidata.

## 1. Baseline del build

Artefacto de CI analizado: `v3-frontend-preview-*`.

- JavaScript principal minificado: **1.664.973 bytes (~1,66 MB)**.
- JavaScript principal comprimido con gzip -9: **432.646 bytes (~433 kB)**.
- CSS principal: **411.441 bytes (~411 kB)**.
- CSS comprimido con gzip -9: **71.248 bytes (~71 kB)**.
- Build descomprimido completo del artefacto: **~2,2 MB**.
- El build actual concentra prácticamente toda la aplicación en un único chunk JavaScript principal.

La advertencia histórica de Vite por chunk >500 kB es por tanto real y no un falso positivo.

## 2. Causa principal

`v3/frontend/src/app/App.tsx` importa estáticamente las páginas públicas, Alumno, Profesor y Administración. Por ello el navegador recibe desde el arranque código de áreas que el visitante todavía no necesita.

Además, la entrada premium usa Three.js / React Three Fiber. Ese coste visual puede ser legítimo para la portada, pero no debe obligar a empaquetar simultáneamente Admin, Campus, Profesor, Test de nivel y el resto de páginas públicas en el mismo chunk inicial.

## 3. CSS

El CSS compilado contiene aproximadamente **4.058 bloques** y **192 media queries**.

No se propone una limpieza agresiva de CSS en la primera pasada porque la V2 ya ha pasado muchas fases responsive y visuales; eliminar reglas sin trazabilidad podría introducir regresiones difíciles de detectar.

Primero debe reducirse JavaScript mediante separación de rutas. Después se medirá de nuevo el CSS antes de decidir si compensa consolidar estilos históricos.

## 4. Recursos externos detectados

El CSS compilado mantiene:

- Google Fonts para `DM Sans` + `Playfair Display`;
- Google Fonts para `Montserrat` + `Playball`;
- varias URLs de Unsplash usadas como recursos/fallbacks visuales.

No se eliminan todavía. Deben revisarse después del code-splitting para distinguir recursos de la dirección visual actual frente a restos/fallbacks históricos.

## 5. Orden de optimización aprobado para 9.7

### 9.7A · Lazy routes — P1

Convertir páginas/rutas a `React.lazy()` + `Suspense` para obtener chunks independientes por experiencia:

1. entrada/Home pública;
2. resto de web pública;
3. Campus Alumno;
4. Profesor;
5. Administración;
6. Test de nivel / herramientas pesadas cuando aporte separación adicional.

Objetivo: que un visitante no descargue código de Admin/Profesor/Campus antes de necesitarlo.

### 9.7B · Entrada premium — P1/P2

Después de medir 9.7A:

- comprobar cuánto pesa específicamente la entrada 3D;
- mantener fallback estático y `prefers-reduced-motion`;
- diferir capas Three.js que no sean necesarias para el primer frame si el ahorro es material;
- no degradar el globo rosa, avión 3D ni transición aprobada por ahorrar unos pocos kB.

### 9.7C · CSS y fuentes — P2

Solo con la candidata visual estable:

- localizar hojas históricas totalmente superseded;
- comprobar si `Montserrat` / `Playball` siguen siendo necesarias;
- valorar preload/preconnect o alojamiento local de fuentes según la política de producción;
- evitar un refactor masivo de CSS sin beneficio medido.

### 9.7D · Fotografías y fallbacks — P2

- inventariar Unsplash hardcoded restantes;
- preferir CMS/fotografía real ya administrable cuando exista;
- evitar descargar imágenes que no estén en viewport;
- preservar `loading=lazy`, tamaños responsivos y encuadre editorial.

## 6. Guardias obligatorias

Cada optimización debe mantener:

- Frontend CI ✅;
- PocketBase CI ✅ cuando aplique;
- E2E CI ✅;
- Intro funcional;
- 1440 / 1180 / 820 / 390 sin overflow;
- teclado y foco visible;
- `prefers-reduced-motion`;
- rutas privadas protegidas;
- ningún cambio de datos, CMS, roles o permisos.

## 7. Criterio de éxito de 9.7A

No se fija un número arbitrario de Lighthouse antes de desplegar en hardware real. Para la primera optimización se exige:

- múltiples chunks en lugar de un único JS de ~1,66 MB;
- caída material del JS descargado por una ruta pública normal;
- Admin/Profesor/Campus fuera del chunk inicial público;
- ausencia de regresiones funcionales y visuales.

## Siguiente acción

Cuando 9.6A Aula Zoom embebida tenga su E2E verde, implementar exclusivamente **9.7A · lazy routes**, volver a medir el artefacto de CI y comparar contra este baseline antes de tocar entrada, CSS, fuentes o imágenes.

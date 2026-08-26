# FASE 10 · Cierre Campus Alumno

Candidato técnico validado: `9b04b07bd66e6379a5eced7ce51c18b6711cc8be`

PR de trabajo: **#11 · Draft · abierto · sin merge**.

`main` permanece fuera de alcance.

## Resultado

FASE 10 transforma el Campus existente sin reconstruir su backend. La base académica y de seguridad se conserva y la experiencia del alumno pasa de una colección de pantallas funcionales a un espacio académico coherente, orientado a la siguiente acción y alineado visualmente con la dirección premium/editorial de Language School.

La entrada pública oficial —Tierra/esfera rosa giratoria, continentes reconocibles, océano transparente/blanco, logo fijo y avión 3D orbitando— no se ha modificado ni degradado durante FASE 10.

## Contrato visual cerrado

El Campus Alumno queda sujeto a estas reglas:

- **editorial humana**, no dashboard administrativo;
- Playfair Display para jerarquía y DM Sans para interfaz;
- blanco cálido como lienzo dominante;
- rosa Language School como acento localizado;
- sombras suaves, bordes delicados y profundidad contenida;
- tarjetas reservadas para entidades o acciones reales;
- próxima acción evidente;
- lenguaje académico cercano y comprensible;
- estados vacíos, carga, error y feedback coherentes;
- responsive y accesibilidad sin degradar el acabado visual.

## Microfases

### 10.0 · Auditoría ✅

Cierre: `4ac0f6d5bc247bd823d3a8267b7f2ba2b946968b`.

Se confirmó que el Campus no necesitaba una reconstrucción. La deuda principal era de jerarquía, continuidad entre áreas y experiencia visual.

### 10.1 · Inicio Alumno ✅

Cierre: `9c471ec65281bfe837ae242a18c54212a7117b62`.

- próxima clase convertida en acción principal;
- acceso online unificado hacia `/alumno/aula/:classId`;
- tarea, material y avisos reorganizados como siguiente recorrido;
- contexto de curso/grupo/nivel del curso más claro;
- sin confundir nivel del curso con nivel evaluado del alumno.

### 10.2 · Mis clases + Aula online ✅

Cierre: `c398a49cfdffef2f6d1df78463eaccbb56d52795`.

- siguiente sesión priorizada;
- agenda posterior e historial separados;
- modalidad presencial/online/híbrida clara;
- entrada siempre por aula interna protegida;
- fallback externo Zoom conservado solo dentro del aula;
- autorización Zoom server-side, `role: 0`, matrícula activa y secretos fuera del navegador intactos.

### 10.3 · Tareas + correcciones ✅

Cierre: `833b66b3f7e314daa0c7a66e69bb5c833f277923`.

- tareas ordenadas por necesidad de acción;
- pendientes/devueltas antes que entregas en revisión y cerradas;
- feedback del profesor reforzado visualmente;
- texto/archivo, 20 MB y bloqueo de doble entrega conservados;
- no se inventa reentrega automática donde el contrato actual no la soporta.

### 10.4 · Material ✅

Cierre: `283d6ded2c95e190fcd793e4b19eb6c4bbbdf2fa`.

- último recurso publicado como punto de entrada;
- biblioteca con búsqueda, ámbito, tipo de archivo y orden real;
- sin inventar unidades/temas que no existen en el modelo;
- descarga protegida y visibilidad curso/grupo/alumno intactas.

### 10.5 · Mi nivel + progreso ✅

Cierre: `442115cce01f06d6fb8ae77eabf51e12904a0f5b`.

- `VALIDATED` como referencia académica principal;
- `AUTOMATIC` presentado como estimación diagnóstica;
- `NONE` mantiene primera evaluación;
- nivel del curso separado expresamente de Mi nivel;
- histórico, competencias, A1–C2, Listening, resume y retake intactos.

### 10.6 · Avisos + Archivos + Perfil ✅

Cierre: `333ced31ca797da416a9ff9114b87c7a90ae2f2e`.

**Avisos**
- `Marcar como leído` explícito y accesible;
- Todos / Sin leer;
- destinos contextuales seguros a Clases, Material o Tareas;
- Nuevo/Leído visualmente diferenciados.

**Mis archivos**
- subida, descarga y archivado intactos;
- límite 20 MB intacto;
- categorías técnicas traducidas a lenguaje de alumno;
- biblioteca privada y dropzone integradas visualmente.

**Mi perfil**
- lógica compartida con Profesor conservada;
- piel premium aplicada solo con `portal=STUDENT`;
- email, rol y estado siguen protegidos.

### 10.7 · Responsive + accesibilidad + coherencia visual ✅

Cierre técnico: `9b04b07bd66e6379a5eced7ce51c18b6711cc8be`.

Se corrigió una deuda real del shell histórico:

- en tablet el sidebar ya no se comprime a un rail de 82 px incompatible con etiquetas de alumno;
- entre 761 y 1050 px el Campus usa sidebar STUDENT de 200 px y conserva textos legibles;
- por debajo de 760 px la navegación ya no desaparece;
- móvil usa cabecera de academia + carril horizontal táctil de secciones;
- estados activos mantienen fondo oscuro y acento rosa;
- Profesor y Admin no reciben estos cambios.

Validación real automatizada:

Rutas:
- `/alumno`;
- `/alumno/nivel`;
- `/alumno/clases`;
- `/alumno/material`;
- `/alumno/tareas`;
- `/alumno/avisos`;
- `/alumno/archivos`;
- `/alumno/perfil`.

Viewports:
- 1440 × 1000;
- 1180 × 900;
- 820 × 900;
- 390 × 844.

Puertas superadas:
- navegación visible en todos los anchos;
- cero overflow horizontal;
- etiquetas de tablet sin clipping;
- navegación móvil horizontal desplazable;
- targets táctiles de al menos 40 px;
- foco de teclado visible;
- navegación real mediante enlace;
- `prefers-reduced-motion` con duración efectiva prácticamente nula.

## 10.8 · Validación transversal ✅

La matriz completa del candidato `9b04b07bd66e6379a5eced7ce51c18b6711cc8be` terminó verde:

- V3 Frontend CI ✅
- V3 PocketBase CI ✅
- V3 Infrastructure CI ✅
- V3 Observability CI ✅
- V3 Backup Restore CI ✅
- V3 Zoom Classroom CI ✅
- V3 E2E CI ✅

La suite E2E cubre además contratos históricos de web pública, CMS, privacidad, roles, contacto, Test de Nivel, Listening y Zoom, por lo que FASE 10 no queda validada de forma aislada: queda validada contra el sistema completo existente.

## Invariantes preservados

- rutas STUDENT siguen protegidas por rol;
- Profesor y Admin permanecen en sus ámbitos;
- Zoom conserva firma temporal server-side y secretos fuera del cliente;
- fallback externo Zoom no sustituye el aula interna;
- PocketBase y colecciones académicas no se reabren innecesariamente;
- ninguna credencial real se añade a Git;
- PR #11 permanece Draft y sin merge;
- `main` no se modifica;
- la entrada premium de esfera rosa + avión 3D se preserva.

## Qué NO cierra FASE 10

Estos puntos siguen perteneciendo a FASE 9 / entorno real y no se deben marcar como completados por este cierre:

- credenciales reales Zoom Server-to-Server OAuth y Meeting SDK;
- verificación real de Zoom desde Admin;
- audios Listening definitivos de producción;
- Turnstile/Cloudflare real, WAF/Bot/AI Crawl Control;
- backup externo físico y restore drill físico;
- despliegue, smoke y piloto real;
- optimización 9.7B de la entrada premium sin degradar globo/avión.

## Siguiente continuidad

FASE 10 queda cerrada en código/CI. El siguiente trabajo debe retomar **FASE 9 · Production Readiness** desde su checkpoint seguro, sin reabrir el Campus salvo que una validación de producción encuentre un defecto concreto.

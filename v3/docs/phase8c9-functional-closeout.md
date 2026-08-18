# FASE 8C.9 · Cierre funcional global

## Estado

FASE 8C queda preparada para cierre cuando el commit que contiene este documento supere en el mismo SHA:

- V3 Frontend CI;
- V3 PocketBase CI;
- V3 E2E CI.

La validación inmediatamente anterior a este documento ejecutó 75 pruebas conectadas y cubrió toda la cadena 8C.1–8C.9.

## Matriz de cobertura

| Puerta | Evidencia automatizada |
| --- | --- |
| Test público A1–C2 | `placement-public-phase8c2.spec.ts`, `placement-conversion-phase8c3.spec.ts` |
| Motor y score server-side | `placement-engine-phase8c1.spec.ts` |
| Token público opaco / answer key oculto | `placement-engine-phase8c1.spec.ts` |
| Recomendaciones y contacto voluntario | `placement-conversion-phase8c3.spec.ts` |
| Campus, reanudación, histórico y retake | `placement-campus-phase8c4.spec.ts` |
| Profesor, Speaking y nivel validado | `placement-teacher-phase8c5.spec.ts` |
| Versionado Admin e inmutabilidad PUBLISHED | `placement-versioning-phase8c6.spec.ts` |
| Banco real de 72 preguntas y diversidad | `placement-zbank-phase8c7.spec.ts` |
| Listening backend, audio protegido y clonación | `zz-placement-listening-backend-phase8c8.spec.ts` |
| Listening UI, sin autoplay y Admin 24/24 | `zzz-placement-listening-ui-phase8c8.spec.ts` |
| Cierre transversal v2, roles, privacidad y responsive | `zzzz-placement-closeout-phase8c9.spec.ts` |
| Responsive público 1440/1180/820/390 | `public-site-shell.spec.ts`, `placement-public-phase8c2.spec.ts`, `zzzz-placement-closeout-phase8c9.spec.ts` |
| Campus 390 / Admin 820 sin overflow | `zzzz-placement-closeout-phase8c9.spec.ts` |
| Teclado, foco visible y reduced motion | `accessibility-flow.spec.ts`, `public-site-shell.spec.ts`, `placement-public-phase8c2.spec.ts`, `zzzz-placement-closeout-phase8c9.spec.ts` |
| Aislamiento Visitante / Alumno / Profesor / Admin | `portal-flows.spec.ts`, `route-smoke.spec.ts`, `placement-engine-phase8c1.spec.ts`, `placement-teacher-phase8c5.spec.ts`, `zzzz-placement-closeout-phase8c9.spec.ts` |
| Privacidad, cookies, legal y WhatsApp | `privacy-whatsapp.spec.ts` |
| CMS, cursos, tarifas, blog e imágenes | `cms-functional-closeout.spec.ts`, `cms-image-flow.spec.ts` |
| Contacto y seguimiento Admin | `contact-flow.spec.ts` |
| Resiliencia ante backend | `backend-health-banner.spec.ts`, `backend-resilience.spec.ts` |
| Zoom y Meeting SDK: permisos y secretos | `zoom-foundation-phase8b1.spec.ts`, `zoom-sdk-auth-phase8d1.spec.ts` |
| Migraciones y rollback | `V3 PocketBase CI` aplica migraciones en base temporal, ejecuta smoke tests y hace `migrate down 1` |

## Contratos finales de nivel

### `cefr-v1`

- Grammar + Vocabulary + Reading.
- PUBLIC 15 preguntas.
- CAMPUS 30 preguntas.
- Histórico reproducible e inmutable por versión publicada.

### `cefr-v2-listening`

- Conserva el cálculo automático de `cefr-v1`.
- Añade 6 preguntas Listening por intento.
- PUBLIC 21 preguntas; CAMPUS 36.
- Listening se guarda en `skill_scores.LISTENING` como `diagnosticOnly`.
- Listening no sube ni baja automáticamente el nivel A1–C2 sin calibración psicométrica real.
- Speaking continúa siendo valoración humana del profesor.

## Seguridad y privacidad

- La puntuación y el nivel se calculan exclusivamente en servidor.
- El navegador no puede suministrar score/level válidos para modificar el resultado.
- PUBLIC usa token opaco y solo almacena su hash.
- CAMPUS queda ligado al usuario STUDENT autenticado.
- Alumno B no puede leer el intento de Alumno A.
- Profesor solo valida alumnos dentro de su ámbito.
- Administración es la única que gestiona versiones/preguntas.
- Una versión PUBLISHED es inmutable.
- Los audios Listening protegidos se sirven únicamente tras autorizar el intento.
- Transcripción, answer key, hashes y secretos de Zoom no se muestran al alumno/visitante.
- Los datos personales son opcionales para obtener el resultado público.

## Límites intencionados que NO son fallos funcionales

1. **Zoom real**: la integración está implementada y probada contra el mock E2E, pero la verificación contra una cuenta real exige credenciales privadas de Zoom Marketplace en el servidor.
2. **Audios Listening de producción**: el sistema Admin permite cargar, sustituir, previsualizar y congelar los 24 audios. Las pruebas usan WAV mínimos como fixtures; la academia debe cargar grabaciones reales antes de publicar una versión Listening en producción.
3. **Speaking automático**: no se implementa deliberadamente. El profesor conserva la validación humana.
4. **IRT / test adaptativo psicométrico**: no se simula sin datos de calibración reales. La diversidad de preguntas mantiene un blueprint auditable.
5. **Bundle frontend**: Vite avisa de un chunk principal grande (~1,63 MB minificado / ~431 KB gzip). Es una deuda de rendimiento, no de corrección ni seguridad, y debe tratarse como optimización separada para no arriesgar el candidato funcional.

## Criterio para considerar FASE 8C cerrada

FASE 8C puede cerrarse cuando el candidato final que contiene esta matriz tenga Frontend, PocketBase y E2E verdes en el mismo SHA y PR #11 continúe Draft, abierto y sin merge.

Después del cierre de 8C, las tareas restantes para una puesta en producción completa deben tratarse como **Production Readiness**, especialmente credenciales Zoom reales, grabaciones Listening reales, configuración de infraestructura/secretos y optimización del bundle.

# FASE 8C.8 · Listening

## Objetivo

Añadir comprensión oral al sistema de test de nivel sin romper la trazabilidad de `cefr-v1`, sin exponer los audios protegidos y sin atribuir al sistema una precisión psicométrica que todavía no ha sido calibrada con datos reales.

## Versionado del algoritmo

- `cefr-v1` permanece inmutable y sigue calculando el nivel automático a partir de Grammar, Vocabulary y Reading.
- La nueva versión se identifica como `cefr-v2-listening`.
- `cefr-v2-listening` conserva exactamente el cálculo A1–C2 de `cefr-v1` sobre las tres competencias nucleares.
- Listening se calcula y almacena como competencia diagnóstica adicional (`diagnosticOnly`).
- Listening no eleva ni reduce por sí sola el nivel automático estimado hasta disponer de una calibración real del banco.
- El profesor puede usar el resultado de Listening junto con Speaking y su observación para validar el nivel académico.

## Blueprint

### Público

- 15 preguntas nucleares heredadas de `cefr-v1`.
- 6 preguntas Listening: una por nivel A1, A2, B1, B2, C1 y C2.
- Total: 21 preguntas.

### Campus

- 30 preguntas nucleares heredadas de `cefr-v1`.
- 6 preguntas Listening: una por nivel A1, A2, B1, B2, C1 y C2.
- Total: 36 preguntas.

El banco de Listening de referencia contiene 24 guiones: cuatro variantes por nivel MCER. La versión no puede publicarse mientras las preguntas Listening necesarias no dispongan de audio válido.

## Audio y privacidad

`placement_questions.audio` ya existe como archivo protegido y acepta audio MPEG, MP4/M4A y WAV hasta 20 MB.

Los clientes nunca reciben una URL permanente del archivo protegido. El audio se obtiene mediante una ruta propia asociada al intento:

`GET /api/language-school/placement/attempts/{attemptId}/questions/{questionId}/audio`

La ruta:

- autoriza primero la propiedad del intento;
- PUBLIC exige `X-Placement-Token`;
- CAMPUS exige sesión STUDENT y que el intento pertenezca al alumno;
- comprueba que la pregunta forma parte del `selection_snapshot` del intento;
- comprueba que la pregunta pertenece al test del intento y es LISTENING;
- nunca devuelve la respuesta correcta ni la transcripción;
- responde con `Cache-Control: private, no-store`;
- sirve el archivo desde el filesystem de PocketBase, preservando soporte HTTP Range.

En frontend se descarga el audio autorizado como `Blob`, se crea una URL temporal con `URL.createObjectURL` y se revoca al cambiar de pregunta o desmontar el componente. No se incluyen tokens en query strings.

## Experiencia de usuario

- Reproductor nativo `<audio controls>`.
- Sin autoplay.
- El alumno decide cuándo iniciar o repetir el audio.
- Estado accesible de carga/error.
- Teclado y controles nativos conservados.
- La transcripción interna nunca aparece durante el intento.
- El resultado muestra Listening como diagnóstico independiente cuando exista.

## Administración

Solo DRAFT puede modificarse, igual que en 8C.6.

Rutas de audio Admin:

- `POST /api/language-school/placement/admin/questions/{id}/audio` — multipart `audio`.
- `GET /api/language-school/placement/admin/questions/{id}/audio` — previsualización autorizada.
- `DELETE /api/language-school/placement/admin/questions/{id}/audio` — retirar audio.

La subida pasa por el servicio Admin; no se reabre CRUD directo sobre `placement_questions`.

Al clonar una versión, los archivos de audio existentes deben clonarse físicamente mediante el filesystem, no copiando solo el nombre almacenado.

## Creación de una versión Listening

Administración puede crear una nueva revisión a partir de una versión `cefr-v1` y marcar “Preparar Listening”. El servidor:

1. clona configuración y preguntas nucleares;
2. cambia el algoritmo a `cefr-v2-listening`;
3. aplica blueprints 21/36;
4. añade 24 preguntas Listening en DRAFT con guion/transcripción interna;
5. exige audio válido antes de permitir publicar.

No se generan ni se publican audios sintéticos de baja calidad como contenido de producción. Los guiones quedan listos para grabación/subida desde Administración.

## Resultado y compatibilidad histórica

- `raw_score`, `max_score`, `score_percent` y `estimated_level` continúan representando la puntuación nuclear Grammar + Vocabulary + Reading.
- `skill_scores` puede incluir `LISTENING` con `diagnosticOnly: true`.
- Intentos antiguos `cefr-v1` permanecen idénticos y reproducibles.
- Recomendaciones de cursos continúan basándose en `estimated_level`, por lo que Listening no altera silenciosamente la conversión comercial.

## Puerta de cierre 8C.8

No se cierra hasta validar en el mismo SHA:

- Frontend CI;
- PocketBase CI;
- E2E completo;
- autorización PUBLIC/CAMPUS del audio;
- rechazo de intento/pregunta ajenos;
- subida/retirada de audio solo por Admin y solo en DRAFT;
- publicación bloqueada si Listening requerido carece de audio;
- transcripción oculta al alumno;
- reproductor sin autoplay y responsive;
- resultado Listening marcado como diagnóstico;
- `cefr-v1` sigue pasando todas sus pruebas históricas.

# LANGUAGE SCHOOL — FASE 8C.0 · Contrato y arquitectura del test de nivel

Estado: **CERRADA**  
Rama: `design/home-premium-v2`  
Alcance: diseño técnico y funcional. **Sin UI y sin migraciones en esta microfase.**

## 1. Objetivo

Language School tendrá un único sistema de evaluación de nivel de inglés con dos experiencias:

- **PUBLIC**: test rápido para visitantes, sin registro obligatorio.
- **CAMPUS**: evaluación más completa para alumnos autenticados.

Ambas experiencias comparten banco de preguntas, selector de preguntas, algoritmo de puntuación, reglas MCER y modelo de histórico.

El resultado automático es siempre **estimado/orientativo**. El nivel académico validado pertenece a la valoración docente y se guarda como un registro histórico separado.

## 2. Hechos de la base actual que condicionan el diseño

- `users.role` distingue `ADMIN`, `TEACHER` y `STUDENT`.
- `student_profiles` no contiene un nivel académico y no debe convertirse en la fuente de verdad mutable del nivel.
- `courses.level` existe como texto descriptivo del curso; no representa el nivel individual de un alumno.
- `enrollments` relaciona alumno y grupo; `groups.teacher` permite limitar el alcance de un profesor a sus alumnos reales.
- El Campus ya aplica aislamiento de datos por usuario y por alcance docente.

## 3. Competencias evaluadas

### MVP 8C.1–8C.7

- `GRAMMAR` — estructuras, tiempos verbales, concordancia y uso funcional de la gramática.
- `VOCABULARY` — rango léxico, colocaciones y uso contextual.
- `READING` — comprensión de información explícita, intención, inferencia y significado en contexto.

### Preparado, pero fuera del MVP inicial

- `LISTENING` — previsto en el modelo para 8C.8.
- `SPEAKING` — no se corrige automáticamente en el MVP. Se registra como valoración docente dentro de `student_level_assessments`.

## 4. Marco de niveles

Se usan las bandas MCER:

`A1 · A2 · B1 · B2 · C1 · C2`

Language School no presentará el resultado como certificado oficial. La interfaz utilizará expresiones como **“Nivel estimado B1”** y explicará que la academia puede validarlo posteriormente.

## 5. Longitud y composición

### Test PUBLIC

- 15 preguntas.
- Objetivo de 5–8 minutos.
- 5 Grammar + 5 Vocabulary + 5 Reading.
- Cobertura de dificultad: A1=2, A2=2, B1=3, B2=3, C1=3, C2=2.
- Sin temporizador obligatorio.

### Test CAMPUS

- 30 preguntas.
- 10 Grammar + 10 Vocabulary + 10 Reading.
- 5 preguntas por cada banda A1–C2.
- Más fiable para histórico académico y seguimiento.

La publicación de una versión queda bloqueada si el banco no permite satisfacer el blueprint mínimo de competencias y niveles.

## 6. Selección de preguntas

El servidor selecciona el conjunto de preguntas al iniciar el intento.

Reglas:

1. Nunca selecciona el cliente.
2. La selección respeta el blueprint del modo PUBLIC o CAMPUS.
3. El orden de preguntas y opciones se aleatoriza en servidor.
4. El intento guarda un snapshot reproducible del conjunto y del orden presentado.
5. Dos intentos pueden recibir variantes distintas cuando el banco disponga de alternativas.
6. Una versión `PUBLISHED` es inmutable. Para modificar preguntas se crea una nueva versión `DRAFT`.

## 7. Puntuación — algoritmo `cefr-v1`

### Puntuación base

- Cada pregunta puntúa 1 punto en `cefr-v1`.
- `score_percent = respuestas_correctas / preguntas_puntuables * 100`.
- El cliente nunca envía una puntuación ni un nivel.

### Banda candidata por porcentaje global

| Porcentaje | Banda candidata |
|---:|---|
| 0–19 | A1 |
| 20–34 | A2 |
| 35–49 | B1 |
| 50–64 | B2 |
| 65–79 | C1 |
| 80–100 | C2 |

### Guardia de evidencia por dificultad

La banda candidata se valida con evidencia real en preguntas de esa dificultad. Si no cumple la guardia, se desciende una banda y se vuelve a comprobar.

Para A2–C1:

- al menos 50 % de aciertos en las preguntas de la banda candidata; y
- al menos 65 % de aciertos acumulados en las preguntas de esa banda y todas las inferiores.

Para C2:

- PUBLIC: 2/2 preguntas C2 correctas;
- CAMPUS: al menos 4/5 preguntas C2 correctas; y
- porcentaje global mínimo de 80 %.

A1 no requiere guardia adicional.

El algoritmo se versiona. Cada intento conserva `algorithm_version`, por lo que una futura calibración no reescribe resultados históricos.

### Puntuación por competencia

Se calcula un porcentaje independiente para Grammar, Vocabulary y Reading. Se muestra como rendimiento por competencia, **no como tres niveles MCER certificados**.

## 8. Diferencia PUBLIC vs CAMPUS

### PUBLIC

- No requiere login.
- No pide nombre, email ni teléfono antes del resultado.
- Devuelve nivel estimado, resumen por competencias y orientación hacia programas.
- No crea automáticamente un usuario.
- El visitante puede optar después por contactar y vincular voluntariamente el resultado a su solicitud.

### CAMPUS

- Requiere `STUDENT` autenticado.
- El intento queda asociado al alumno desde el servidor.
- Guarda histórico.
- Permite aplicar una política de repetición configurable; valor inicial recomendado: 30 días, con override administrativo.
- Sirve de base para revisión docente y validación posterior.

## 9. Modelo PocketBase aprobado para 8C.1

### `placement_tests`

Una fila representa una versión del test.

Campos previstos:

- `name`
- `version`
- `status`: `DRAFT | PUBLISHED | ARCHIVED`
- `algorithm_version`
- `public_question_count`
- `campus_question_count`
- `public_blueprint` JSON
- `campus_blueprint` JSON
- `campus_retake_days`
- `published_at`
- `created_by`
- autodates

Solo puede existir una versión activa `PUBLISHED` para nuevos intentos. Versiones antiguas siguen referenciables por los intentos históricos.

### `placement_questions`

Campos previstos:

- `test` → `placement_tests`
- `code`
- `skill`: `GRAMMAR | VOCABULARY | READING | LISTENING`
- `cefr_level`: `A1 | A2 | B1 | B2 | C1 | C2`
- `prompt`
- `passage` opcional
- `audio` opcional y protegido para 8C.8
- `options` JSON con `{ id, label }`
- `correct_option_id`
- `internal_explanation` opcional
- `weight` (1 en `cefr-v1`)
- `active`
- `admin_order`
- autodates

`correct_option_id` y cualquier explicación interna jamás se entregan al navegador del visitante/alumno.

### `placement_attempts`

Campos previstos:

- `test`
- `mode`: `PUBLIC | CAMPUS`
- `student` opcional; obligatorio en CAMPUS
- `public_token_hash` opcional; solo PUBLIC
- `status`: `IN_PROGRESS | COMPLETED | EXPIRED | ABANDONED`
- `algorithm_version`
- `selection_snapshot` JSON
- `started_at`
- `completed_at`
- `raw_score`
- `max_score`
- `score_percent`
- `estimated_level`
- `skill_scores` JSON
- autodates

Un intento completado es inmutable en sus datos de resultado.

### `placement_answers`

Campos previstos:

- `attempt`
- `question`
- `selected_option_id`
- `is_correct`
- `points_awarded`
- `answered_at`

Índice único: `attempt + question`.

El cliente envía únicamente `questionId` y `optionId`; `is_correct` y `points_awarded` se calculan en servidor.

### `student_level_assessments`

Histórico docente append-only.

Campos previstos:

- `student`
- `source_attempt` opcional
- `automatic_level` snapshot opcional
- `speaking_level` opcional
- `validated_level`: `A1 | A2 | B1 | B2 | C1 | C2`
- `notes`
- `assessed_by`
- `assessed_at`
- `reason`: `INITIAL | REVIEW | PROGRESS | OTHER`
- autodates

Una nueva valoración crea un registro nuevo; no se sobrescribe el histórico anterior.

## 10. Permisos y aislamiento

### Visitante anónimo

- No tiene acceso directo a ninguna colección placement.
- Solo usa endpoints server-side con un token opaco de intento PUBLIC.
- No puede listar intentos, preguntas ni respuestas.

### Alumno

- Puede iniciar/consultar sus intentos CAMPUS mediante endpoints propios.
- Puede ver su histórico agregado.
- No puede leer `placement_questions.correct_option_id` ni `placement_answers.is_correct` directamente.
- Nunca puede consultar intentos de otro alumno.

### Profesor

- No administra el banco de preguntas.
- Solo puede consultar resultados agregados de alumnos que estén dentro de su alcance académico real mediante matrícula/grupo.
- Puede crear una valoración docente para esos alumnos.
- No puede validar alumnos ajenos.

### Admin

- CRUD de versiones y banco en estado DRAFT.
- Publicación/archivo de versiones.
- Consulta de intentos y resultados.
- Validación académica cuando proceda.

## 11. Endpoints server-side

Contrato inicial:

- `POST /api/language-school/placement/start`
- `GET /api/language-school/placement/attempts/{id}/question`
- `POST /api/language-school/placement/attempts/{id}/answer`
- `POST /api/language-school/placement/attempts/{id}/finish`
- `GET /api/language-school/placement/attempts/{id}/result`

### Reglas

- `start` selecciona la versión publicada y crea el snapshot.
- PUBLIC recibe un token aleatorio de alta entropía; solo su hash se guarda en PocketBase.
- CAMPUS se vincula exclusivamente a `e.auth.id` y exige rol STUDENT.
- `answer` valida que la pregunta pertenece al snapshot del intento.
- No se devuelve si la respuesta es correcta durante el test.
- `finish` no acepta `score`, `level` ni resultados calculados por el cliente.
- `finish` es idempotente: un intento ya completado devuelve el mismo resultado.
- Respuestas y resultados usan `Cache-Control: no-store`.

## 12. Prevención de exposición/manipulación

- Colecciones placement cerradas a anónimo.
- Preguntas se entregan mediante DTO saneado server-side.
- `correct_option_id`, `is_correct`, pesos internos y reglas privadas no aparecen en payloads públicos.
- Token PUBLIC aleatorio; se almacena únicamente su hash.
- El servidor decide test, preguntas, orden, puntuación y nivel.
- El servidor rechaza una respuesta a una pregunta que no pertenezca al intento.
- El servidor rechaza intentos de cambiar `student`, `test`, `mode`, score o nivel.
- Cierre de intento y cálculo se ejecutan de forma transaccional.
- Rate limiting del origen/Cloudflare se reutilizará para endpoints públicos.

## 13. Recomendación de cursos

No se reutiliza `student_profiles` ni se interpreta `courses.level` como nivel del alumno.

Para 8C.3 se añadirá una correspondencia normalizada entre curso y MCER. Dirección aprobada:

- conservar `courses.level` como texto de presentación;
- añadir, cuando llegue 8C.3, un campo estructurado `courses.cefr_levels` o una relación equivalente;
- recomendar únicamente cursos activos que declaren explícitamente compatibilidad con el nivel estimado;
- si no existe correspondencia real, mostrar programas/contacto sin inventar una recomendación.

## 14. Privacidad y retención

- PUBLIC no almacena PII antes del resultado.
- No se almacena IP dentro del intento como dato académico.
- La vinculación con una solicitud de contacto requiere acción explícita del visitante.
- Intentos anónimos completados: retención inicial prevista de 90 días, configurable en despliegue/política.
- Intentos CAMPUS y valoraciones docentes forman parte del histórico académico y se gestionan con la política de datos del Campus.

## 15. Accesibilidad y UX obligatoria

- Ruta pública prevista: `/test-de-nivel`.
- Una pregunta por paso en el MVP.
- Opciones implementadas semánticamente como controles de formulario reales.
- Navegación completa por teclado.
- Foco movido de forma predecible al avanzar.
- Progreso anunciado de forma accesible.
- Mensajes de error asociados al control correspondiente.
- `prefers-reduced-motion` respetado.
- Sin temporizador obligatorio en el MVP.
- Resultado orientativo explicado en lenguaje claro.

## 16. Criterios de aceptación de 8C.1

La siguiente microfase solo puede cerrarse cuando exista:

1. migración limpia y reversible de las cinco colecciones;
2. motor server-side compartido PUBLIC/CAMPUS;
3. algoritmo `cefr-v1` cubierto por tests de límites;
4. selección reproducible y estratificada;
5. payloads saneados sin answer key;
6. intento PUBLIC con token opaco hashado;
7. intento CAMPUS ligado al alumno autenticado;
8. prueba de manipulación de score rechazada;
9. prueba Alumno A ≠ Alumno B;
10. Frontend CI, PocketBase CI y E2E CI verdes.

## 17. Decisiones expresamente fuera de 8C.0

- No se escriben todavía preguntas reales de producción.
- No se crea `/test-de-nivel` todavía.
- No se modifica UI de Alumno/Profesor/Admin todavía.
- No se añade Listening todavía.
- No se usa IA para Speaking.
- No se toca `main`.
- No se fusiona PR #11.

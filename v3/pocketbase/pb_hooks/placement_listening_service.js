const placementCore = require(`${__hooks}/placement_core.js`)
const listeningCore = require(`${__hooks}/placement_listening_core.js`)

function noStore(e) { e.response.header().set('Cache-Control', 'no-store') }
function privateNoStore(e) { e.response.header().set('Cache-Control', 'private, no-store') }

function requestBody(e) {
  const raw = toString(e.request.body || '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body')
    return parsed
  } catch {
    throw new BadRequestError('El cuerpo de la solicitud no es JSON válido.')
  }
}

function recordJson(record, field, fallback) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return fallback
  try { const text = toString(raw); if (text) return JSON.parse(text) } catch {}
  try { return JSON.parse(JSON.stringify(raw)) } catch { return fallback }
}

function nowIso() { return new Date().toISOString().replace('T', ' ') }
function asDate(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}
function sortNewest(records, field) {
  return records.slice().sort((a, b) => {
    const left = asDate(a.getString(field)); const right = asDate(b.getString(field))
    return (right ? right.getTime() : 0) - (left ? left.getTime() : 0)
  })
}

function publishedTest(app) {
  const tests = app.findAllRecords('placement_tests').filter((record) => record.getString('status') === 'PUBLISHED')
  if (tests.length !== 1) throw new InternalServerError('El test de nivel no está disponible temporalmente.')
  if (tests[0].getString('algorithm_version') !== listeningCore.ALGORITHM_VERSION) throw new InternalServerError('La versión Listening publicada no coincide con el motor esperado.')
  return tests[0]
}

function requireStudent(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión como alumno para acceder a tu nivel.')
  if (e.auth.getString('role') !== 'STUDENT') throw new ForbiddenError('Esta información solo está disponible para el alumno.')
  return e.auth
}
function campusAttempts(app, studentId) {
  return app.findAllRecords('placement_attempts').filter((attempt) => attempt.getString('mode') === 'CAMPUS' && attempt.getString('student') === studentId)
}
function placementHeader(e) { return String(e.request.header.get('X-Placement-Token') || '').trim() }
function authorizeAttempt(e, attempt) {
  if (attempt.getString('mode') === 'PUBLIC') {
    const token = placementHeader(e)
    if (!token) throw new UnauthorizedError('Falta el token del intento público.')
    const expected = attempt.getString('public_token_hash'); const actual = $security.sha256(token)
    if (!expected || !$security.equal(expected, actual)) throw new ForbiddenError('El intento público no pertenece a esta sesión.')
    return
  }
  const student = requireStudent(e)
  if (attempt.getString('student') !== student.id) throw new ForbiddenError('No puedes acceder a la evaluación de otro alumno.')
}

function snapshot(attempt) {
  const value = recordJson(attempt, 'selection_snapshot', [])
  if (!Array.isArray(value) || !value.length) throw new InternalServerError('El intento no contiene una selección válida.')
  return value
}
function attemptAnswers(app, attemptId) { return app.findAllRecords('placement_answers').filter((answer) => answer.getString('attempt') === attemptId) }
function questionOptions(question) {
  const options = recordJson(question, 'options', [])
  if (!Array.isArray(options) || options.length < 2) throw new InternalServerError('Una pregunta publicada no tiene opciones válidas.')
  const seen = {}
  options.forEach((option) => {
    const id = String(option && option.id || '').trim(); const label = String(option && option.label || '').trim()
    if (!id || !label || seen[id]) throw new InternalServerError('Una pregunta publicada no tiene opciones válidas.')
    seen[id] = true
  })
  if (!seen[question.getString('correct_option_id')]) throw new InternalServerError('Una pregunta publicada no tiene respuesta correcta válida.')
  return options.map((option) => ({ id: String(option.id), label: String(option.label) }))
}

function blueprintFor(test, mode) {
  const field = mode === 'CAMPUS' ? 'campus_blueprint' : 'public_blueprint'
  const expected = mode === 'CAMPUS' ? test.getInt('campus_question_count') : test.getInt('public_question_count')
  const fallback = mode === 'CAMPUS' ? listeningCore.CAMPUS_BLUEPRINT : listeningCore.PUBLIC_BLUEPRINT
  const blueprint = recordJson(test, field, fallback)
  if (!Array.isArray(blueprint) || !blueprint.length) throw new InternalServerError('El test Listening publicado no tiene un blueprint válido.')
  const allowedSkills = [...placementCore.SKILLS, listeningCore.LISTENING_SKILL]
  blueprint.forEach((cell) => {
    const count = Number(cell && cell.count)
    if (!cell || !allowedSkills.includes(String(cell.skill || '')) || !placementCore.LEVELS.includes(String(cell.level || '')) || !Number.isInteger(count) || count < 1) throw new InternalServerError('El test Listening publicado no tiene un blueprint válido.')
  })
  if (listeningCore.blueprintQuestionCount(blueprint) !== expected) throw new InternalServerError('El blueprint Listening no coincide con el número de preguntas publicado.')
  return blueprint
}

function selectSnapshot(app, test, mode, seed) {
  const blueprint = blueprintFor(test, mode)
  const pool = app.findAllRecords('placement_questions').filter((question) => question.getString('test') === test.id && question.getBool('active'))
  const selected = []
  blueprint.forEach((cell) => {
    const candidates = pool.filter((question) => question.getString('skill') === String(cell.skill) && question.getString('cefr_level') === String(cell.level) && (String(cell.skill) !== listeningCore.LISTENING_SKILL || Boolean(question.getString('audio'))))
    if (candidates.length < Number(cell.count)) throw new InternalServerError('El banco Listening publicado no cubre el blueprint del test.')
    candidates.sort((a, b) => {
      const left = $security.sha256(`${seed}:question:${a.id}`); const right = $security.sha256(`${seed}:question:${b.id}`)
      return left < right ? -1 : left > right ? 1 : 0
    })
    candidates.slice(0, Number(cell.count)).forEach((question) => {
      const options = questionOptions(question)
      const optionOrder = options.map((option) => option.id).sort((a, b) => {
        const left = $security.sha256(`${seed}:option:${question.id}:${a}`); const right = $security.sha256(`${seed}:option:${question.id}:${b}`)
        return left < right ? -1 : left > right ? 1 : 0
      })
      selected.push({ questionId: question.id, optionOrder })
    })
  })
  selected.sort((a, b) => {
    const left = $security.sha256(`${seed}:order:${a.questionId}`); const right = $security.sha256(`${seed}:order:${b.questionId}`)
    return left < right ? -1 : left > right ? 1 : 0
  })
  return selected.map((entry, index) => ({ position: index + 1, questionId: entry.questionId, optionOrder: entry.optionOrder }))
}

function campusRetakeState(test, latestCompleted) {
  const days = test.getInt('campus_retake_days')
  if (!latestCompleted || days <= 0) return { allowed: true, nextAvailableAt: '' }
  const completedAt = asDate(latestCompleted.getString('completed_at'))
  if (!completedAt) return { allowed: true, nextAvailableAt: '' }
  const next = new Date(completedAt.getTime() + days * 86400000)
  return { allowed: Date.now() >= next.getTime(), nextAvailableAt: next.toISOString() }
}
function rejectComputedFields(body) {
  const forbidden = ['score','rawScore','raw_score','maxScore','max_score','scorePercent','score_percent','level','estimatedLevel','estimated_level','skillScores','skill_scores','student','test','mode']
  if (forbidden.some((key) => body[key] !== undefined)) throw new BadRequestError('La puntuación, el nivel y la identidad del intento se calculan exclusivamente en el servidor.')
}
function resultDto(attempt) {
  return {
    attemptId: attempt.id, mode: attempt.getString('mode'), status: attempt.getString('status'), algorithmVersion: attempt.getString('algorithm_version'),
    estimatedLevel: attempt.getString('estimated_level'), rawScore: attempt.getInt('raw_score'), maxScore: attempt.getInt('max_score'),
    scorePercent: attempt.getFloat('score_percent'), skillScores: recordJson(attempt, 'skill_scores', {}), completedAt: attempt.getString('completed_at'),
    notice: 'Resultado orientativo MCER. Listening se muestra como diagnóstico complementario y no modifica por sí solo el nivel automático.', listeningDiagnosticOnly: true,
  }
}

function start(e) {
  noStore(e)
  const body = requestBody(e); const mode = String(body.mode || 'PUBLIC').toUpperCase()
  if (mode !== 'PUBLIC' && mode !== 'CAMPUS') throw new BadRequestError('Modo de evaluación no válido.')
  let student = null
  if (mode === 'CAMPUS') {
    student = requireStudent(e)
    const existing = sortNewest(campusAttempts(e.app, student.id).filter((attempt) => attempt.getString('status') === 'IN_PROGRESS'), 'started_at')[0]
    if (existing) return e.json(200, { attemptId: existing.id, mode: 'CAMPUS', totalQuestions: snapshot(existing).length, algorithmVersion: existing.getString('algorithm_version'), resumed: true })
  }
  const test = publishedTest(e.app)
  if (mode === 'CAMPUS') {
    const latest = sortNewest(campusAttempts(e.app, student.id).filter((attempt) => attempt.getString('status') === 'COMPLETED'), 'completed_at')[0]
    const retake = campusRetakeState(test, latest)
    if (!retake.allowed) throw new BadRequestError(`Podrás repetir la evaluación Campus a partir de ${retake.nextAvailableAt ? retake.nextAvailableAt.slice(0, 10) : 'más adelante'}.`)
  }
  const publicToken = mode === 'PUBLIC' ? $security.randomString(48) : ''; const selectionSeed = publicToken || $security.randomString(48)
  const selection = selectSnapshot(e.app, test, mode, selectionSeed)
  const attempt = new Record(e.app.findCollectionByNameOrId('placement_attempts'))
  attempt.set('test', test.id); attempt.set('mode', mode)
  if (mode === 'CAMPUS') attempt.set('student', student.id)
  if (mode === 'PUBLIC') attempt.set('public_token_hash', $security.sha256(publicToken))
  attempt.set('status', 'IN_PROGRESS'); attempt.set('algorithm_version', listeningCore.ALGORITHM_VERSION); attempt.set('selection_snapshot', selection); attempt.set('started_at', nowIso())
  e.app.save(attempt)
  const response = { attemptId: attempt.id, mode, totalQuestions: selection.length, algorithmVersion: listeningCore.ALGORITHM_VERSION, resumed: false }
  if (mode === 'PUBLIC') response.token = publicToken
  return e.json(201, response)
}

function nextQuestion(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || '')); authorizeAttempt(e, attempt)
  if (attempt.getString('algorithm_version') !== listeningCore.ALGORITHM_VERSION) throw new BadRequestError('El intento no pertenece al motor Listening.')
  if (attempt.getString('status') !== 'IN_PROGRESS') return e.json(200, { complete: true, status: attempt.getString('status') })
  const answers = attemptAnswers(e.app, attempt.id); const answered = {}; answers.forEach((answer) => { answered[answer.getString('question')] = true })
  const entries = snapshot(attempt); const entry = entries.find((item) => !answered[String(item.questionId)])
  if (!entry) return e.json(200, { complete: true, status: 'IN_PROGRESS', answered: answers.length, total: entries.length })
  const question = e.app.findRecordById('placement_questions', String(entry.questionId)); const options = questionOptions(question); const byId = {}; options.forEach((option) => { byId[option.id] = option })
  const orderedOptions = []; (Array.isArray(entry.optionOrder) ? entry.optionOrder : []).forEach((id) => { if (byId[String(id)]) orderedOptions.push(byId[String(id)]) })
  if (orderedOptions.length !== options.length) throw new InternalServerError('El snapshot del intento no es reproducible.')
  const isListening = question.getString('skill') === listeningCore.LISTENING_SKILL
  return e.json(200, { complete: false, attemptId: attempt.id, position: Number(entry.position || answers.length + 1), total: entries.length, answered: answers.length,
    question: { id: question.id, skill: question.getString('skill'), prompt: question.getString('prompt'), passage: isListening ? '' : question.getString('passage'), hasAudio: isListening && Boolean(question.getString('audio')), options: orderedOptions } })
}

function finish(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || '')); authorizeAttempt(e, attempt)
  if (attempt.getString('algorithm_version') !== listeningCore.ALGORITHM_VERSION) throw new BadRequestError('El intento no pertenece al motor Listening.')
  rejectComputedFields(requestBody(e))
  if (attempt.getString('status') === 'COMPLETED') return e.json(200, resultDto(attempt))
  if (attempt.getString('status') !== 'IN_PROGRESS') throw new BadRequestError('Este intento no se puede finalizar.')
  const entries = snapshot(attempt); const answers = attemptAnswers(e.app, attempt.id)
  if (answers.length !== entries.length) throw new BadRequestError('Debes responder todas las preguntas antes de finalizar.')
  const byQuestion = {}; answers.forEach((answer) => { byQuestion[answer.getString('question')] = answer })
  const scoredItems = entries.map((entry) => {
    const question = e.app.findRecordById('placement_questions', String(entry.questionId)); const saved = byQuestion[question.id]
    if (!saved) throw new InternalServerError('Falta una respuesta del intento.')
    return { skill: question.getString('skill'), level: question.getString('cefr_level'), correct: saved.getBool('is_correct') }
  })
  const calculated = listeningCore.calculate(scoredItems, attempt.getString('mode'))
  e.app.runInTransaction((txApp) => {
    const current = txApp.findRecordById('placement_attempts', attempt.id); if (current.getString('status') === 'COMPLETED') return
    current.set('raw_score', calculated.rawScore); current.set('max_score', calculated.maxScore); current.set('score_percent', calculated.scorePercent)
    current.set('estimated_level', calculated.estimatedLevel); current.set('skill_scores', calculated.skillScores); current.set('completed_at', nowIso()); current.set('status', 'COMPLETED'); txApp.save(current)
  })
  return e.json(200, resultDto(e.app.findRecordById('placement_attempts', attempt.id)))
}

function result(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || '')); authorizeAttempt(e, attempt)
  if (attempt.getString('algorithm_version') !== listeningCore.ALGORITHM_VERSION) throw new BadRequestError('El intento no pertenece al motor Listening.')
  if (attempt.getString('status') !== 'COMPLETED') throw new BadRequestError('El resultado todavía no está disponible.')
  return e.json(200, resultDto(attempt))
}

function audio(e) {
  privateNoStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || '')); authorizeAttempt(e, attempt)
  const questionId = String(e.request.pathValue('questionId') || '')
  if (!snapshot(attempt).some((entry) => String(entry.questionId) === questionId)) throw new ForbiddenError('El audio no pertenece a este intento.')
  let question = null
  try { question = e.app.findRecordById('placement_questions', questionId) } catch { throw new BadRequestError('La pregunta no existe.') }
  if (question.getString('test') !== attempt.getString('test') || question.getString('skill') !== listeningCore.LISTENING_SKILL) throw new ForbiddenError('El audio no pertenece a este intento.')
  const filename = question.getString('audio'); if (!filename) throw new BadRequestError('Esta pregunta no tiene audio disponible.')
  const fs = e.app.newFilesystem()
  try { fs.serve(e.response, e.request, `${question.baseFilesPath()}/${filename}`, filename) } finally { fs.close() }
}

module.exports = { start, nextQuestion, finish, result, audio }

const placementCore = require(`${__hooks}/placement_core.js`)

function noStore(e) {
  e.response.header().set('Cache-Control', 'no-store')
}

function requestBody(e) {
  const raw = toString(e.request.body || '').trim()
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('invalid body shape')
    }
    return parsed
  } catch {
    throw new BadRequestError('El cuerpo de la solicitud no es JSON válido.')
  }
}

function recordJson(record, field, fallback) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return fallback

  try {
    const text = toString(raw)
    if (text) return JSON.parse(text)
  } catch {
    // JSONRaw may not be represented as a string in every JSVM context.
  }

  try {
    return JSON.parse(JSON.stringify(raw))
  } catch {
    return fallback
  }
}

function placementHeader(e) {
  return String(e.request.header.get('X-Placement-Token') || '').trim()
}

function nowIso() {
  return new Date().toISOString().replace('T', ' ')
}

function publishedTest(app) {
  const tests = app.findAllRecords('placement_tests').filter((record) => record.getString('status') === 'PUBLISHED')
  if (tests.length !== 1) {
    throw new InternalServerError('El test de nivel no está disponible temporalmente.')
  }
  return tests[0]
}

function blueprintFor(test, mode) {
  const field = mode === 'CAMPUS' ? 'campus_blueprint' : 'public_blueprint'
  const fallback = mode === 'CAMPUS' ? placementCore.CAMPUS_BLUEPRINT : placementCore.PUBLIC_BLUEPRINT
  const expected = mode === 'CAMPUS' ? test.getInt('campus_question_count') : test.getInt('public_question_count')
  const blueprint = recordJson(test, field, fallback)

  if (!Array.isArray(blueprint) || !blueprint.length) {
    throw new InternalServerError('El test publicado no tiene un blueprint válido.')
  }

  blueprint.forEach((cell) => {
    const count = Number(cell && cell.count)
    if (
      !cell ||
      placementCore.SKILLS.indexOf(String(cell.skill || '')) === -1 ||
      placementCore.LEVELS.indexOf(String(cell.level || '')) === -1 ||
      Math.floor(count) !== count ||
      count < 1
    ) {
      throw new InternalServerError('El test publicado no tiene un blueprint válido.')
    }
  })

  if (placementCore.blueprintQuestionCount(blueprint) !== expected) {
    throw new InternalServerError('El blueprint no coincide con el número de preguntas publicado.')
  }

  return blueprint
}

function questionOptions(question) {
  const options = recordJson(question, 'options', [])
  if (!Array.isArray(options) || options.length < 2) {
    throw new InternalServerError('Una pregunta publicada no tiene opciones válidas.')
  }

  const seen = {}
  options.forEach((option) => {
    const id = String(option && option.id ? option.id : '').trim()
    const label = String(option && option.label ? option.label : '').trim()
    if (!id || !label || seen[id]) {
      throw new InternalServerError('Una pregunta publicada no tiene opciones válidas.')
    }
    seen[id] = true
  })

  if (!seen[question.getString('correct_option_id')]) {
    throw new InternalServerError('Una pregunta publicada no tiene respuesta correcta válida.')
  }

  return options.map((option) => ({ id: String(option.id), label: String(option.label) }))
}

function selectSnapshot(app, test, mode, seed) {
  const blueprint = blueprintFor(test, mode)
  const pool = app.findAllRecords('placement_questions').filter((question) => (
    question.getString('test') === test.id && question.getBool('active')
  ))
  const selected = []

  blueprint.forEach((cell) => {
    const candidates = pool.filter((question) => (
      question.getString('skill') === cell.skill && question.getString('cefr_level') === cell.level
    ))

    if (candidates.length < Number(cell.count)) {
      throw new InternalServerError('El banco publicado no cubre el blueprint del test.')
    }

    candidates.sort((a, b) => {
      const left = $security.sha256(`${seed}:question:${a.id}`)
      const right = $security.sha256(`${seed}:question:${b.id}`)
      return left < right ? -1 : left > right ? 1 : 0
    })

    candidates.slice(0, Number(cell.count)).forEach((question) => {
      const options = questionOptions(question)
      const optionOrder = options
        .map((option) => option.id)
        .sort((a, b) => {
          const left = $security.sha256(`${seed}:option:${question.id}:${a}`)
          const right = $security.sha256(`${seed}:option:${question.id}:${b}`)
          return left < right ? -1 : left > right ? 1 : 0
        })
      selected.push({ questionId: question.id, optionOrder })
    })
  })

  selected.sort((a, b) => {
    const left = $security.sha256(`${seed}:order:${a.questionId}`)
    const right = $security.sha256(`${seed}:order:${b.questionId}`)
    return left < right ? -1 : left > right ? 1 : 0
  })

  return selected.map((entry, index) => ({
    position: index + 1,
    questionId: entry.questionId,
    optionOrder: entry.optionOrder,
  }))
}

function authorizeAttempt(e, attempt) {
  const mode = attempt.getString('mode')
  if (mode === 'PUBLIC') {
    const token = placementHeader(e)
    if (!token) throw new UnauthorizedError('Falta el token del intento público.')
    const expected = attempt.getString('public_token_hash')
    const actual = $security.sha256(token)
    if (!expected || !$security.equal(expected, actual)) {
      throw new ForbiddenError('El intento público no pertenece a esta sesión.')
    }
    return
  }

  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para acceder a esta evaluación.')
  if (e.auth.getString('role') !== 'STUDENT') {
    throw new ForbiddenError('Solo el alumno puede acceder a su evaluación.')
  }
  if (attempt.getString('student') !== e.auth.id) {
    throw new ForbiddenError('No puedes acceder a la evaluación de otro alumno.')
  }
}

function snapshot(attempt) {
  const value = recordJson(attempt, 'selection_snapshot', [])
  if (!Array.isArray(value) || !value.length) {
    throw new InternalServerError('El intento no contiene una selección válida.')
  }
  return value
}

function attemptAnswers(app, attemptId) {
  return app.findAllRecords('placement_answers').filter((answer) => answer.getString('attempt') === attemptId)
}

function questionDto(app, attempt, entry, answeredCount) {
  const question = app.findRecordById('placement_questions', String(entry.questionId))
  const options = questionOptions(question)
  const byId = {}
  options.forEach((option) => { byId[option.id] = option })
  const orderedOptions = []
  const order = Array.isArray(entry.optionOrder) ? entry.optionOrder : []
  order.forEach((id) => {
    if (byId[String(id)]) orderedOptions.push(byId[String(id)])
  })

  if (orderedOptions.length !== options.length) {
    throw new InternalServerError('El snapshot del intento no es reproducible.')
  }

  const total = snapshot(attempt).length
  return {
    complete: false,
    attemptId: attempt.id,
    position: Number(entry.position || answeredCount + 1),
    total,
    answered: answeredCount,
    question: {
      id: question.id,
      skill: question.getString('skill'),
      prompt: question.getString('prompt'),
      passage: question.getString('passage'),
      options: orderedOptions,
    },
  }
}

function resultDto(attempt) {
  return {
    attemptId: attempt.id,
    mode: attempt.getString('mode'),
    status: attempt.getString('status'),
    algorithmVersion: attempt.getString('algorithm_version'),
    estimatedLevel: attempt.getString('estimated_level'),
    rawScore: attempt.getInt('raw_score'),
    maxScore: attempt.getInt('max_score'),
    scorePercent: attempt.getFloat('score_percent'),
    skillScores: recordJson(attempt, 'skill_scores', {}),
    completedAt: attempt.getString('completed_at'),
    notice: 'Resultado orientativo basado en el MCER; la academia puede validarlo posteriormente.',
  }
}

function rejectComputedFields(body) {
  const forbidden = [
    'score', 'rawScore', 'raw_score', 'maxScore', 'max_score', 'scorePercent', 'score_percent',
    'level', 'estimatedLevel', 'estimated_level', 'skillScores', 'skill_scores', 'student', 'test', 'mode',
  ]
  const attempted = forbidden.some((key) => body[key] !== undefined)
  if (attempted) {
    throw new BadRequestError('La puntuación, el nivel y la identidad del intento se calculan exclusivamente en el servidor.')
  }
}

function start(e) {
  noStore(e)
  const body = requestBody(e)
  const mode = String(body.mode || 'PUBLIC').toUpperCase()
  if (mode !== 'PUBLIC' && mode !== 'CAMPUS') throw new BadRequestError('Modo de evaluación no válido.')

  if (mode === 'CAMPUS') {
    if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para comenzar la evaluación Campus.')
    if (e.auth.getString('role') !== 'STUDENT') throw new ForbiddenError('Solo un alumno puede iniciar la evaluación Campus.')
  }

  const test = publishedTest(e.app)
  const algorithmVersion = test.getString('algorithm_version')
  if (algorithmVersion !== 'cefr-v1') throw new InternalServerError('La versión de cálculo publicada no está soportada.')

  const publicToken = mode === 'PUBLIC' ? $security.randomString(48) : ''
  const selectionSeed = publicToken || $security.randomString(48)
  const selection = selectSnapshot(e.app, test, mode, selectionSeed)
  const collection = e.app.findCollectionByNameOrId('placement_attempts')
  const attempt = new Record(collection)
  attempt.set('test', test.id)
  attempt.set('mode', mode)
  if (mode === 'CAMPUS') attempt.set('student', e.auth.id)
  if (mode === 'PUBLIC') attempt.set('public_token_hash', $security.sha256(publicToken))
  attempt.set('status', 'IN_PROGRESS')
  attempt.set('algorithm_version', algorithmVersion)
  attempt.set('selection_snapshot', selection)
  attempt.set('started_at', nowIso())
  e.app.save(attempt)

  const response = {
    attemptId: attempt.id,
    mode,
    totalQuestions: selection.length,
    algorithmVersion,
  }
  if (mode === 'PUBLIC') response.token = publicToken
  return e.json(201, response)
}

function nextQuestion(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
  authorizeAttempt(e, attempt)
  if (attempt.getString('status') !== 'IN_PROGRESS') {
    return e.json(200, { complete: true, status: attempt.getString('status') })
  }

  const answers = attemptAnswers(e.app, attempt.id)
  const answered = {}
  answers.forEach((answer) => { answered[answer.getString('question')] = true })
  const entries = snapshot(attempt)
  const next = entries.find((entry) => !answered[String(entry.questionId)])
  if (!next) return e.json(200, { complete: true, status: 'IN_PROGRESS', answered: answers.length, total: entries.length })

  return e.json(200, questionDto(e.app, attempt, next, answers.length))
}

function answer(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
  authorizeAttempt(e, attempt)
  if (attempt.getString('status') !== 'IN_PROGRESS') throw new BadRequestError('Este intento ya no admite respuestas.')

  const body = requestBody(e)
  rejectComputedFields(body)
  const questionId = String(body.questionId || '').trim()
  const optionId = String(body.optionId || '').trim()
  if (!questionId || !optionId) throw new BadRequestError('Falta la pregunta o la opción seleccionada.')

  const entries = snapshot(attempt)
  if (!entries.some((entry) => String(entry.questionId) === questionId)) {
    throw new BadRequestError('La pregunta no pertenece a este intento.')
  }

  const existing = attemptAnswers(e.app, attempt.id).find((item) => item.getString('question') === questionId)
  if (existing) throw new BadRequestError('La pregunta ya ha sido respondida.')

  const question = e.app.findRecordById('placement_questions', questionId)
  if (question.getString('test') !== attempt.getString('test')) {
    throw new BadRequestError('La pregunta no pertenece a la versión de este intento.')
  }
  const options = questionOptions(question)
  if (!options.some((option) => option.id === optionId)) throw new BadRequestError('Opción no válida para esta pregunta.')

  const savedAnswer = new Record(e.app.findCollectionByNameOrId('placement_answers'))
  savedAnswer.set('attempt', attempt.id)
  savedAnswer.set('question', question.id)
  savedAnswer.set('selected_option_id', optionId)
  savedAnswer.set('is_correct', optionId === question.getString('correct_option_id'))
  savedAnswer.set('points_awarded', optionId === question.getString('correct_option_id') ? 1 : 0)
  savedAnswer.set('answered_at', nowIso())
  e.app.save(savedAnswer)

  return e.json(200, {
    accepted: true,
    answered: attemptAnswers(e.app, attempt.id).length,
    total: entries.length,
  })
}

function finish(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
  authorizeAttempt(e, attempt)
  const body = requestBody(e)
  rejectComputedFields(body)

  if (attempt.getString('status') === 'COMPLETED') return e.json(200, resultDto(attempt))
  if (attempt.getString('status') !== 'IN_PROGRESS') throw new BadRequestError('Este intento no se puede finalizar.')

  const entries = snapshot(attempt)
  const answers = attemptAnswers(e.app, attempt.id)
  if (answers.length !== entries.length) throw new BadRequestError('Debes responder todas las preguntas antes de finalizar.')

  const byQuestion = {}
  answers.forEach((item) => { byQuestion[item.getString('question')] = item })
  const scoredItems = entries.map((entry) => {
    const question = e.app.findRecordById('placement_questions', String(entry.questionId))
    const savedAnswer = byQuestion[question.id]
    if (!savedAnswer) throw new InternalServerError('Falta una respuesta del intento.')
    return {
      skill: question.getString('skill'),
      level: question.getString('cefr_level'),
      correct: savedAnswer.getBool('is_correct'),
    }
  })

  const result = placementCore.calculateCefrV1(scoredItems, attempt.getString('mode'))
  e.app.runInTransaction((txApp) => {
    const txAttempt = txApp.findRecordById('placement_attempts', attempt.id)
    if (txAttempt.getString('status') === 'COMPLETED') return
    txAttempt.set('raw_score', result.rawScore)
    txAttempt.set('max_score', result.maxScore)
    txAttempt.set('score_percent', result.scorePercent)
    txAttempt.set('estimated_level', result.estimatedLevel)
    txAttempt.set('skill_scores', result.skillScores)
    txAttempt.set('completed_at', nowIso())
    txAttempt.set('status', 'COMPLETED')
    txApp.save(txAttempt)
  })

  return e.json(200, resultDto(e.app.findRecordById('placement_attempts', attempt.id)))
}

function result(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
  authorizeAttempt(e, attempt)
  if (attempt.getString('status') !== 'COMPLETED') throw new BadRequestError('El resultado todavía no está disponible.')
  return e.json(200, resultDto(attempt))
}

module.exports = {
  start,
  nextQuestion,
  answer,
  finish,
  result,
}

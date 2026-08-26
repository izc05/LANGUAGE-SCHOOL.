const placement = require(`${__hooks}/placement_service.js`)
const placementCore = require(`${__hooks}/placement_core.js`)
const progressiveCore = require(`${__hooks}/placement_progressive_core.js`)

function noStore(e) {
  e.response.header().set('Cache-Control', 'no-store')
}

function requestBody(e) {
  const raw = toString(e.request.body || '').trim()
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid body shape')
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
  } catch {}
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

function asDate(value) {
  const text = String(value || '').trim()
  if (!text) return null
  const date = new Date(text.includes('T') ? text : text.replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? null : date
}

function publishedTest(app) {
  const tests = app.findAllRecords('placement_tests').filter((record) => record.getString('status') === 'PUBLISHED')
  if (tests.length !== 1) throw new InternalServerError('El test de nivel no está disponible temporalmente.')
  return tests[0]
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
    if (!id || !label || seen[id]) throw new InternalServerError('Una pregunta publicada no tiene opciones válidas.')
    seen[id] = true
  })

  if (!seen[question.getString('correct_option_id')]) {
    throw new InternalServerError('Una pregunta publicada no tiene respuesta correcta válida.')
  }

  return options.map((option) => ({ id: String(option.id), label: String(option.label) }))
}

function requireStudent(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión como alumno para acceder a tu nivel.')
  if (e.auth.getString('role') !== 'STUDENT') throw new ForbiddenError('Esta información solo está disponible para el alumno.')
  return e.auth
}

function authorizePublicAttempt(e, attempt) {
  const token = placementHeader(e)
  if (!token) throw new UnauthorizedError('Falta el token del intento público.')
  const expected = attempt.getString('public_token_hash')
  const actual = $security.sha256(token)
  if (!expected || !$security.equal(expected, actual)) {
    throw new ForbiddenError('El intento público no pertenece a esta sesión.')
  }
}

function attemptAnswers(app, attemptId) {
  return app.findAllRecords('placement_answers').filter((answer) => answer.getString('attempt') === attemptId)
}

function campusAttempts(app, studentId) {
  return app.findAllRecords('placement_attempts').filter((attempt) => (
    attempt.getString('mode') === 'CAMPUS' && attempt.getString('student') === studentId
  ))
}

function sortNewest(records, field) {
  return records.slice().sort((a, b) => {
    const left = asDate(a.getString(field))
    const right = asDate(b.getString(field))
    return (right ? right.getTime() : 0) - (left ? left.getTime() : 0)
  })
}

function campusRetakeState(test, latestCompleted) {
  const days = test.getInt('campus_retake_days')
  if (!latestCompleted || days <= 0) return { allowed: true, days, nextAvailableAt: '' }

  const completedAt = asDate(latestCompleted.getString('completed_at'))
  if (!completedAt) return { allowed: true, days, nextAvailableAt: '' }
  const next = new Date(completedAt.getTime() + days * 86400000)
  const allowed = Date.now() >= next.getTime()
  return { allowed, days, nextAvailableAt: allowed ? '' : next.toISOString() }
}

function testPool(app, testId) {
  return app.findAllRecords('placement_questions').filter((question) => (
    question.getString('test') === testId && question.getBool('active')
  ))
}

function groupedCells(cells) {
  const groups = []
  const byKey = {}
  cells.forEach((cell) => {
    const key = `${cell.skill}:${cell.level}`
    if (!byKey[key]) {
      byKey[key] = { skill: cell.skill, level: cell.level, count: 0 }
      groups.push(byKey[key])
    }
    byKey[key].count += Number(cell.count || 0)
  })
  return groups
}

function selectEntries(app, test, cells, seed, namespace, excludedIds, startPosition) {
  const pool = testPool(app, test.id)
  const excluded = {}
  ;(excludedIds || []).forEach((id) => { excluded[String(id)] = true })
  const chosen = []

  groupedCells(cells).forEach((cell) => {
    const candidates = pool.filter((question) => (
      !excluded[question.id] &&
      question.getString('skill') === cell.skill &&
      question.getString('cefr_level') === cell.level
    ))

    if (candidates.length < cell.count) {
      throw new InternalServerError(`El banco publicado no cubre ${cell.skill} ${cell.level} para la ruta progresiva.`)
    }

    candidates.sort((a, b) => {
      const left = $security.sha256(`${seed}:${namespace}:question:${a.id}`)
      const right = $security.sha256(`${seed}:${namespace}:question:${b.id}`)
      return left < right ? -1 : left > right ? 1 : 0
    })

    candidates.slice(0, cell.count).forEach((question) => {
      excluded[question.id] = true
      const options = questionOptions(question)
      const optionOrder = options.map((option) => option.id).sort((a, b) => {
        const left = $security.sha256(`${seed}:${namespace}:option:${question.id}:${a}`)
        const right = $security.sha256(`${seed}:${namespace}:option:${question.id}:${b}`)
        return left < right ? -1 : left > right ? 1 : 0
      })
      chosen.push({ questionId: question.id, optionOrder })
    })
  })

  chosen.sort((a, b) => {
    const left = $security.sha256(`${seed}:${namespace}:order:${a.questionId}`)
    const right = $security.sha256(`${seed}:${namespace}:order:${b.questionId}`)
    return left < right ? -1 : left > right ? 1 : 0
  })

  return chosen.map((entry, index) => ({
    position: Number(startPosition || 1) + index,
    questionId: entry.questionId,
    optionOrder: entry.optionOrder,
  }))
}

function campusBlueprint(test) {
  const value = recordJson(test, 'campus_blueprint', placementCore.CAMPUS_BLUEPRINT)
  if (!Array.isArray(value) || !value.length) throw new InternalServerError('El blueprint Campus no es válido.')
  let total = 0
  value.forEach((cell) => {
    const count = Number(cell && cell.count)
    if (
      !cell ||
      !placementCore.SKILLS.includes(String(cell.skill || '')) ||
      !placementCore.LEVELS.includes(String(cell.level || '')) ||
      !Number.isInteger(count) ||
      count < 1
    ) throw new InternalServerError('El blueprint Campus no es válido.')
    total += count
  })
  if (total !== test.getInt('campus_question_count')) throw new InternalServerError('El blueprint Campus no coincide con su número de preguntas.')
  return value
}

function createAttempt(app, test, mode, student, publicToken, selection) {
  const attempt = new Record(app.findCollectionByNameOrId('placement_attempts'))
  attempt.set('test', test.id)
  attempt.set('mode', mode)
  if (mode === 'CAMPUS') attempt.set('student', student.id)
  if (mode === 'PUBLIC') attempt.set('public_token_hash', $security.sha256(publicToken))
  attempt.set('status', 'IN_PROGRESS')
  attempt.set('algorithm_version', progressiveCore.ALGORITHM_VERSION)
  attempt.set('selection_snapshot', selection)
  attempt.set('started_at', nowIso())
  app.save(attempt)
  return attempt
}

function startCampus(e, test) {
  const student = requireStudent(e)
  const existing = sortNewest(
    campusAttempts(e.app, student.id).filter((attempt) => attempt.getString('status') === 'IN_PROGRESS'),
    'started_at',
  )[0]

  if (existing) {
    const existingSnapshot = recordJson(existing, 'selection_snapshot', [])
    const total = Array.isArray(existingSnapshot) ? existingSnapshot.length : Number(existingSnapshot.total || 0)
    return e.json(200, {
      attemptId: existing.id,
      mode: 'CAMPUS',
      totalQuestions: total,
      algorithmVersion: existing.getString('algorithm_version'),
      resumed: true,
    })
  }

  const completed = sortNewest(
    campusAttempts(e.app, student.id).filter((attempt) => attempt.getString('status') === 'COMPLETED'),
    'completed_at',
  )[0]
  const retake = campusRetakeState(test, completed)
  if (!retake.allowed) {
    const readable = retake.nextAvailableAt ? retake.nextAvailableAt.slice(0, 10) : 'más adelante'
    throw new BadRequestError(`Podrás repetir la evaluación Campus a partir de ${readable}.`)
  }

  const seed = $security.sha256(`campus:${student.id}:${$security.randomString(48)}`)
  const entries = selectEntries(e.app, test, campusBlueprint(test), seed, 'campus', [], 1)
  const attempt = createAttempt(e.app, test, 'CAMPUS', student, '', entries)
  return e.json(201, {
    attemptId: attempt.id,
    mode: 'CAMPUS',
    totalQuestions: entries.length,
    algorithmVersion: progressiveCore.ALGORITHM_VERSION,
    resumed: false,
  })
}

function startPublic(e, test) {
  const publicToken = $security.randomString(48)
  const seed = $security.sha256(`public:${publicToken}:${$security.randomString(48)}`)
  const calibration = selectEntries(
    e.app,
    test,
    progressiveCore.CALIBRATION_BLUEPRINT,
    seed,
    'calibration',
    [],
    1,
  )
  const selection = {
    kind: progressiveCore.SNAPSHOT_KIND,
    total: progressiveCore.PUBLIC_QUESTION_COUNT,
    seed,
    route: '',
    entries: calibration,
  }
  const attempt = createAttempt(e.app, test, 'PUBLIC', null, publicToken, selection)
  return e.json(201, {
    attemptId: attempt.id,
    mode: 'PUBLIC',
    totalQuestions: progressiveCore.PUBLIC_QUESTION_COUNT,
    algorithmVersion: progressiveCore.ALGORITHM_VERSION,
    resumed: false,
    token: publicToken,
  })
}

function start(e) {
  noStore(e)
  const body = requestBody(e)
  const mode = String(body.mode || 'PUBLIC').toUpperCase()
  if (mode !== 'PUBLIC' && mode !== 'CAMPUS') throw new BadRequestError('Modo de evaluación no válido.')
  const test = publishedTest(e.app)
  if (test.getString('algorithm_version') !== progressiveCore.ALGORITHM_VERSION) {
    throw new InternalServerError('La versión progresiva publicada no está disponible.')
  }
  return mode === 'CAMPUS' ? startCampus(e, test) : startPublic(e, test)
}

function publicSnapshot(attempt) {
  const value = recordJson(attempt, 'selection_snapshot', null)
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.kind !== progressiveCore.SNAPSHOT_KIND ||
    Number(value.total) !== progressiveCore.PUBLIC_QUESTION_COUNT ||
    !String(value.seed || '') ||
    !Array.isArray(value.entries)
  ) {
    throw new InternalServerError('El intento progresivo no contiene un snapshot válido.')
  }
  return value
}

function ensureExpanded(app, attempt, answers) {
  const selection = publicSnapshot(attempt)
  if (selection.route) return selection
  if (answers.length < progressiveCore.CALIBRATION_BLUEPRINT.length) return selection

  const calibrationEntries = selection.entries.slice(0, progressiveCore.CALIBRATION_BLUEPRINT.length)
  const byQuestion = {}
  answers.forEach((answer) => { byQuestion[answer.getString('question')] = answer })
  if (!calibrationEntries.every((entry) => byQuestion[String(entry.questionId)])) return selection

  const correct = calibrationEntries.filter((entry) => byQuestion[String(entry.questionId)].getBool('is_correct')).length
  const route = progressiveCore.routeForCalibration(correct)
  const branch = selectEntries(
    app,
    app.findRecordById('placement_tests', attempt.getString('test')),
    progressiveCore.branchBlueprint(route),
    String(selection.seed),
    `route:${route}`,
    calibrationEntries.map((entry) => String(entry.questionId)),
    calibrationEntries.length + 1,
  )
  const expanded = {
    ...selection,
    route,
    calibrationCorrect: correct,
    entries: [...calibrationEntries, ...branch],
  }
  attempt.set('selection_snapshot', expanded)
  app.save(attempt)
  return expanded
}

function orderedOptions(question, entry) {
  const options = questionOptions(question)
  const byId = {}
  options.forEach((option) => { byId[option.id] = option })
  const ordered = []
  ;(Array.isArray(entry.optionOrder) ? entry.optionOrder : []).forEach((id) => {
    if (byId[String(id)]) ordered.push(byId[String(id)])
  })
  if (ordered.length !== options.length) throw new InternalServerError('El snapshot del intento no es reproducible.')
  return ordered
}

function questionDto(app, attempt, entry, answeredCount) {
  const question = app.findRecordById('placement_questions', String(entry.questionId))
  return {
    complete: false,
    attemptId: attempt.id,
    position: Number(entry.position || answeredCount + 1),
    total: progressiveCore.PUBLIC_QUESTION_COUNT,
    answered: answeredCount,
    question: {
      id: question.id,
      skill: question.getString('skill'),
      prompt: question.getString('prompt'),
      passage: question.getString('passage'),
      options: orderedOptions(question, entry),
    },
  }
}

function nextQuestion(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
  if (attempt.getString('mode') === 'CAMPUS') return placement.nextQuestion(e)
  authorizePublicAttempt(e, attempt)
  if (attempt.getString('algorithm_version') !== progressiveCore.ALGORITHM_VERSION) {
    throw new BadRequestError('El intento no usa el motor progresivo.')
  }
  if (attempt.getString('status') !== 'IN_PROGRESS') {
    return e.json(200, { complete: true, status: attempt.getString('status') })
  }

  const answers = attemptAnswers(e.app, attempt.id)
  const selection = ensureExpanded(e.app, attempt, answers)
  const answered = {}
  answers.forEach((answer) => { answered[answer.getString('question')] = true })
  const next = selection.entries.find((entry) => !answered[String(entry.questionId)])
  if (!next) {
    return e.json(200, {
      complete: true,
      status: 'IN_PROGRESS',
      answered: answers.length,
      total: progressiveCore.PUBLIC_QUESTION_COUNT,
    })
  }
  return e.json(200, questionDto(e.app, attempt, next, answers.length))
}

function rejectComputedFields(body) {
  const forbidden = [
    'score', 'rawScore', 'raw_score', 'maxScore', 'max_score', 'scorePercent', 'score_percent',
    'level', 'estimatedLevel', 'estimated_level', 'skillScores', 'skill_scores', 'student', 'test', 'mode',
  ]
  if (forbidden.some((key) => body[key] !== undefined)) {
    throw new BadRequestError('La puntuación, el nivel y la identidad del intento se calculan exclusivamente en el servidor.')
  }
}

function answer(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
  if (attempt.getString('mode') === 'CAMPUS') return placement.answer(e)
  authorizePublicAttempt(e, attempt)
  if (attempt.getString('algorithm_version') !== progressiveCore.ALGORITHM_VERSION) {
    throw new BadRequestError('El intento no usa el motor progresivo.')
  }
  if (attempt.getString('status') !== 'IN_PROGRESS') throw new BadRequestError('Este intento ya no admite respuestas.')

  const body = requestBody(e)
  rejectComputedFields(body)
  const questionId = String(body.questionId || '').trim()
  const optionId = String(body.optionId || '').trim()
  if (!questionId || !optionId) throw new BadRequestError('Falta la pregunta o la opción seleccionada.')

  const answers = attemptAnswers(e.app, attempt.id)
  const selection = ensureExpanded(e.app, attempt, answers)
  const answered = {}
  answers.forEach((item) => { answered[item.getString('question')] = true })
  const next = selection.entries.find((entry) => !answered[String(entry.questionId)])
  if (!next || String(next.questionId) !== questionId) {
    throw new BadRequestError('La pregunta no corresponde al siguiente paso de este intento.')
  }

  const question = e.app.findRecordById('placement_questions', questionId)
  if (question.getString('test') !== attempt.getString('test')) throw new BadRequestError('La pregunta no pertenece a la versión de este intento.')
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
    answered: answers.length + 1,
    total: progressiveCore.PUBLIC_QUESTION_COUNT,
  })
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
    notice: 'Resultado orientativo basado en una ruta progresiva MCER; la academia puede validarlo posteriormente.',
  }
}

function finish(e) {
  noStore(e)
  const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
  if (attempt.getString('mode') === 'CAMPUS') return placement.finish(e)
  authorizePublicAttempt(e, attempt)
  const body = requestBody(e)
  rejectComputedFields(body)

  if (attempt.getString('status') === 'COMPLETED') return e.json(200, resultDto(attempt))
  if (attempt.getString('status') !== 'IN_PROGRESS') throw new BadRequestError('Este intento no se puede finalizar.')

  const answers = attemptAnswers(e.app, attempt.id)
  const selection = ensureExpanded(e.app, attempt, answers)
  if (!selection.route || selection.entries.length !== progressiveCore.PUBLIC_QUESTION_COUNT) {
    throw new BadRequestError('El recorrido progresivo todavía no está completo.')
  }
  if (answers.length !== progressiveCore.PUBLIC_QUESTION_COUNT) {
    throw new BadRequestError('Debes responder todas las preguntas antes de finalizar.')
  }

  const byQuestion = {}
  answers.forEach((item) => { byQuestion[item.getString('question')] = item })
  const scoredItems = selection.entries.map((entry) => {
    const question = e.app.findRecordById('placement_questions', String(entry.questionId))
    const savedAnswer = byQuestion[question.id]
    if (!savedAnswer) throw new InternalServerError('Falta una respuesta del intento.')
    return {
      skill: question.getString('skill'),
      level: question.getString('cefr_level'),
      correct: savedAnswer.getBool('is_correct'),
    }
  })

  const result = progressiveCore.calculate(scoredItems, String(selection.route))
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
  if (attempt.getString('mode') === 'CAMPUS') return placement.result(e)
  authorizePublicAttempt(e, attempt)
  if (attempt.getString('status') !== 'COMPLETED') throw new BadRequestError('El resultado todavía no está disponible.')
  return e.json(200, resultDto(attempt))
}

module.exports = { start, nextQuestion, answer, finish, result }

const placementCore = require(`${__hooks}/placement_core.js`)

const LEVELS = placementCore.LEVELS
const SKILLS = placementCore.SKILLS
const DEFAULT_PUBLIC_BLUEPRINT = placementCore.PUBLIC_BLUEPRINT
const DEFAULT_CAMPUS_BLUEPRINT = placementCore.CAMPUS_BLUEPRINT

function noStore(e) { e.response.header().set('Cache-Control', 'no-store') }

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

function requireAdmin(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para administrar el test de nivel.')
  if (e.auth.getString('role') !== 'ADMIN') throw new ForbiddenError('Solo Administración puede gestionar el test de nivel.')
  return e.auth
}

function cleanText(value, max) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) throw new BadRequestError('El texto supera la longitud permitida.')
  return text
}

function jsonField(record, field, fallback) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return fallback
  try {
    const text = toString(raw)
    if (text) return JSON.parse(text)
  } catch { /* JSONRaw can already be an object */ }
  try { return JSON.parse(JSON.stringify(raw)) } catch { return fallback }
}

function questionOptions(record) {
  const value = jsonField(record, 'options', [])
  return Array.isArray(value) ? value : []
}

function sortByOrder(records) {
  return records.slice().sort((a, b) => {
    const left = Number(a.get('admin_order') || 0)
    const right = Number(b.get('admin_order') || 0)
    if (left !== right) return left - right
    return a.getString('code').localeCompare(b.getString('code'))
  })
}

function testQuestions(app, testId) {
  return sortByOrder(app.findAllRecords('placement_questions').filter((record) => record.getString('test') === testId))
}

function questionDto(record) {
  return {
    id: record.id,
    testId: record.getString('test'),
    code: record.getString('code'),
    skill: record.getString('skill'),
    cefrLevel: record.getString('cefr_level'),
    prompt: record.getString('prompt'),
    passage: record.getString('passage'),
    options: questionOptions(record),
    correctOptionId: record.getString('correct_option_id'),
    internalExplanation: record.getString('internal_explanation'),
    weight: Number(record.get('weight') || 1),
    active: record.getBool('active'),
    adminOrder: Number(record.get('admin_order') || 0),
  }
}

function blueprintCells(record, field) {
  const value = jsonField(record, field, [])
  if (!Array.isArray(value)) return []
  return value.map((cell) => ({
    skill: String(cell && cell.skill || ''),
    level: String(cell && cell.level || ''),
    count: Number(cell && cell.count || 0),
  }))
}

function validateBlueprint(cells, expectedCount, label) {
  const errors = []
  if (!cells.length) errors.push(`${label}: blueprint vacío.`)
  let total = 0
  cells.forEach((cell) => {
    if (!SKILLS.includes(cell.skill)) errors.push(`${label}: competencia ${cell.skill || 'vacía'} no soportada.`)
    if (!LEVELS.includes(cell.level)) errors.push(`${label}: nivel ${cell.level || 'vacío'} no válido.`)
    if (!Number.isInteger(cell.count) || cell.count < 1) errors.push(`${label}: cada bloque debe pedir al menos una pregunta.`)
    total += Number.isFinite(cell.count) ? cell.count : 0
  })
  if (total !== expectedCount) errors.push(`${label}: el blueprint suma ${total} preguntas y la versión declara ${expectedCount}.`)
  return errors
}

function validationReport(app, test) {
  const publicBlueprint = blueprintCells(test, 'public_blueprint')
  const campusBlueprint = blueprintCells(test, 'campus_blueprint')
  const publicCount = test.getInt('public_question_count')
  const campusCount = test.getInt('campus_question_count')
  const questions = testQuestions(app, test.id)
  const active = questions.filter((question) => question.getBool('active'))
  const errors = [
    ...validateBlueprint(publicBlueprint, publicCount, 'Público'),
    ...validateBlueprint(campusBlueprint, campusCount, 'Campus'),
  ]

  if (test.getString('algorithm_version') !== 'cefr-v1') errors.push('La versión usa un algoritmo no soportado por el motor actual.')

  const requiredByKey = {}
  ;[...publicBlueprint, ...campusBlueprint].forEach((cell) => {
    const key = `${cell.skill}:${cell.level}`
    requiredByKey[key] = Math.max(Number(requiredByKey[key] || 0), Number(cell.count || 0))
  })

  const availableByKey = {}
  active.forEach((question) => {
    const key = `${question.getString('skill')}:${question.getString('cefr_level')}`
    availableByKey[key] = Number(availableByKey[key] || 0) + 1
    const options = questionOptions(question)
    const ids = options.map((option) => String(option && option.id || ''))
    if (options.length < 2) errors.push(`${question.getString('code')}: debe tener al menos dos opciones.`)
    if (new Set(ids).size !== ids.length) errors.push(`${question.getString('code')}: contiene identificadores de opción duplicados.`)
    if (!ids.includes(question.getString('correct_option_id'))) errors.push(`${question.getString('code')}: la respuesta correcta no existe entre las opciones.`)
    if (!cleanText(question.getString('prompt'), 12000)) errors.push(`${question.getString('code')}: falta el enunciado.`)
  })

  const requirements = Object.keys(requiredByKey).sort().map((key) => {
    const parts = key.split(':')
    const skill = parts[0]
    const level = parts[1]
    const required = Number(requiredByKey[key] || 0)
    const available = Number(availableByKey[key] || 0)
    if (available < required) errors.push(`${skill} ${level}: faltan ${required - available} pregunta(s) activa(s).`)
    return { skill, level, required, available, ready: available >= required }
  })

  return {
    ready: errors.length === 0,
    errors: [...new Set(errors)],
    requirements,
    questionCount: questions.length,
    activeQuestionCount: active.length,
  }
}

function testDto(app, record) {
  return {
    id: record.id,
    name: record.getString('name'),
    version: record.getString('version'),
    status: record.getString('status'),
    algorithmVersion: record.getString('algorithm_version'),
    publicQuestionCount: record.getInt('public_question_count'),
    campusQuestionCount: record.getInt('campus_question_count'),
    campusRetakeDays: record.getInt('campus_retake_days'),
    publishedAt: record.getString('published_at'),
    createdAt: record.getString('created'),
    canEdit: record.getString('status') === 'DRAFT',
    validation: validationReport(app, record),
  }
}

function requireTest(app, id) {
  if (!id) throw new BadRequestError('Falta la versión del test.')
  try { return app.findRecordById('placement_tests', id) } catch { throw new BadRequestError('La versión del test no existe.') }
}

function requireDraft(app, id) {
  const test = requireTest(app, id)
  if (test.getString('status') !== 'DRAFT') throw new BadRequestError('Solo una versión DRAFT puede modificarse. Las versiones publicadas o archivadas son inmutables.')
  return test
}

function validateVersion(value) {
  const version = cleanText(value, 40)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(version)) throw new BadRequestError('La versión debe tener entre 2 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.')
  return version
}

function ensureUniqueVersion(app, version, exceptId) {
  const duplicate = app.findAllRecords('placement_tests').find((record) => record.getString('version') === version && record.id !== exceptId)
  if (duplicate) throw new BadRequestError('Ya existe una versión con ese identificador.')
}

function setTestConfigFromSource(record, source) {
  if (source) {
    record.set('algorithm_version', source.getString('algorithm_version'))
    record.set('public_question_count', source.getInt('public_question_count'))
    record.set('campus_question_count', source.getInt('campus_question_count'))
    record.set('public_blueprint', jsonField(source, 'public_blueprint', DEFAULT_PUBLIC_BLUEPRINT))
    record.set('campus_blueprint', jsonField(source, 'campus_blueprint', DEFAULT_CAMPUS_BLUEPRINT))
    record.set('campus_retake_days', source.getInt('campus_retake_days'))
    return
  }
  record.set('algorithm_version', 'cefr-v1')
  record.set('public_question_count', placementCore.blueprintQuestionCount(DEFAULT_PUBLIC_BLUEPRINT))
  record.set('campus_question_count', placementCore.blueprintQuestionCount(DEFAULT_CAMPUS_BLUEPRINT))
  record.set('public_blueprint', DEFAULT_PUBLIC_BLUEPRINT)
  record.set('campus_blueprint', DEFAULT_CAMPUS_BLUEPRINT)
  record.set('campus_retake_days', 30)
}

function cloneQuestion(txApp, sourceQuestion, targetTestId) {
  const collection = txApp.findCollectionByNameOrId('placement_questions')
  const record = new Record(collection)
  record.set('test', targetTestId)
  record.set('code', sourceQuestion.getString('code'))
  record.set('skill', sourceQuestion.getString('skill'))
  record.set('cefr_level', sourceQuestion.getString('cefr_level'))
  record.set('prompt', sourceQuestion.getString('prompt'))
  record.set('passage', sourceQuestion.getString('passage'))
  record.set('options', questionOptions(sourceQuestion))
  record.set('correct_option_id', sourceQuestion.getString('correct_option_id'))
  record.set('internal_explanation', sourceQuestion.getString('internal_explanation'))
  record.set('weight', Number(sourceQuestion.get('weight') || 1))
  record.set('active', sourceQuestion.getBool('active'))
  record.set('admin_order', Number(sourceQuestion.get('admin_order') || 0))
  txApp.save(record)
}

function listTests(e) {
  noStore(e)
  requireAdmin(e)
  const tests = e.app.findAllRecords('placement_tests').slice().sort((a, b) => String(b.getString('created')).localeCompare(String(a.getString('created'))))
  return e.json(200, { tests: tests.map((record) => testDto(e.app, record)) })
}

function createDraft(e) {
  noStore(e)
  const admin = requireAdmin(e)
  const body = requestBody(e)
  const name = cleanText(body.name, 180)
  const version = validateVersion(body.version)
  const sourceId = cleanText(body.sourceTestId, 40)
  if (!name) throw new BadRequestError('El nombre de la versión es obligatorio.')
  ensureUniqueVersion(e.app, version, '')
  let source = null
  if (sourceId) source = requireTest(e.app, sourceId)
  let createdId = ''

  e.app.runInTransaction((txApp) => {
    const collection = txApp.findCollectionByNameOrId('placement_tests')
    const record = new Record(collection)
    record.set('name', name)
    record.set('version', version)
    record.set('status', 'DRAFT')
    setTestConfigFromSource(record, source ? txApp.findRecordById('placement_tests', source.id) : null)
    record.set('published_at', '')
    record.set('created_by', admin.id)
    txApp.save(record)
    createdId = record.id
    if (source) testQuestions(txApp, source.id).forEach((question) => cloneQuestion(txApp, question, record.id))
  })

  const created = e.app.findRecordById('placement_tests', createdId)
  return e.json(201, { test: testDto(e.app, created) })
}

function updateDraft(e) {
  noStore(e)
  requireAdmin(e)
  const test = requireDraft(e.app, String(e.request.pathValue('id') || ''))
  const body = requestBody(e)
  if (body.name !== undefined) {
    const name = cleanText(body.name, 180)
    if (!name) throw new BadRequestError('El nombre no puede quedar vacío.')
    test.set('name', name)
  }
  if (body.version !== undefined) {
    const version = validateVersion(body.version)
    ensureUniqueVersion(e.app, version, test.id)
    test.set('version', version)
  }
  if (body.campusRetakeDays !== undefined) {
    const days = Number(body.campusRetakeDays)
    if (!Number.isInteger(days) || days < 0 || days > 3650) throw new BadRequestError('El intervalo de repetición debe estar entre 0 y 3650 días.')
    test.set('campus_retake_days', days)
  }
  e.app.save(test)
  return e.json(200, { test: testDto(e.app, test) })
}

function deleteDraft(e) {
  noStore(e)
  requireAdmin(e)
  const test = requireDraft(e.app, String(e.request.pathValue('id') || ''))
  const hasAttempts = e.app.findAllRecords('placement_attempts').some((attempt) => attempt.getString('test') === test.id)
  if (hasAttempts) throw new BadRequestError('No se puede eliminar una versión que ya tenga intentos asociados.')
  e.app.delete(test)
  return e.json(200, { deleted: true })
}

function listQuestions(e) {
  noStore(e)
  requireAdmin(e)
  const test = requireTest(e.app, String(e.request.pathValue('id') || ''))
  return e.json(200, { test: testDto(e.app, test), questions: testQuestions(e.app, test.id).map(questionDto) })
}

function normalizedQuestion(body, current) {
  const code = body.code !== undefined ? cleanText(body.code, 100) : current ? current.getString('code') : ''
  const skill = body.skill !== undefined ? cleanText(body.skill, 30).toUpperCase() : current ? current.getString('skill') : ''
  const cefrLevel = body.cefrLevel !== undefined ? cleanText(body.cefrLevel, 2).toUpperCase() : current ? current.getString('cefr_level') : ''
  const prompt = body.prompt !== undefined ? cleanText(body.prompt, 12000) : current ? current.getString('prompt') : ''
  const passage = body.passage !== undefined ? cleanText(body.passage, 30000) : current ? current.getString('passage') : ''
  const explanation = body.internalExplanation !== undefined ? cleanText(body.internalExplanation, 20000) : current ? current.getString('internal_explanation') : ''
  const weight = body.weight !== undefined ? Number(body.weight) : current ? Number(current.get('weight') || 1) : 1
  const active = body.active !== undefined ? Boolean(body.active) : current ? current.getBool('active') : true
  const adminOrder = body.adminOrder !== undefined ? Number(body.adminOrder) : current ? Number(current.get('admin_order') || 0) : 0

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(code)) throw new BadRequestError('El código de pregunta solo admite letras, números, punto, guion y guion bajo.')
  if (!SKILLS.includes(skill)) throw new BadRequestError('Competencia de pregunta no válida para la fase actual.')
  if (!LEVELS.includes(cefrLevel)) throw new BadRequestError('Nivel MCER no válido.')
  if (!prompt) throw new BadRequestError('El enunciado es obligatorio.')
  if (!Number.isFinite(weight) || weight <= 0 || weight > 100) throw new BadRequestError('El peso debe estar entre 0 y 100.')
  if (!Number.isInteger(adminOrder) || adminOrder < 0 || adminOrder > 1000000) throw new BadRequestError('El orden debe ser un entero positivo.')

  let options = body.options !== undefined ? body.options : current ? questionOptions(current) : []
  if (!Array.isArray(options) || options.length < 2 || options.length > 6) throw new BadRequestError('Cada pregunta debe tener entre 2 y 6 opciones.')
  const seen = {}
  options = options.map((option) => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) throw new BadRequestError('Formato de opción no válido.')
    const id = cleanText(option.id, 20)
    const label = cleanText(option.label, 500)
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(id)) throw new BadRequestError('Cada opción necesita un identificador simple.')
    if (!label) throw new BadRequestError('El texto de cada opción es obligatorio.')
    if (seen[id]) throw new BadRequestError('No puede haber opciones duplicadas.')
    seen[id] = true
    return { id, label }
  })

  const correctOptionId = body.correctOptionId !== undefined ? cleanText(body.correctOptionId, 20) : current ? current.getString('correct_option_id') : ''
  if (!seen[correctOptionId]) throw new BadRequestError('La respuesta correcta debe coincidir con una de las opciones.')
  return { code, skill, cefrLevel, prompt, passage, options, correctOptionId, explanation, weight, active, adminOrder }
}

function ensureUniqueCode(app, testId, code, exceptId) {
  const duplicate = app.findAllRecords('placement_questions').find((record) => record.getString('test') === testId && record.getString('code') === code && record.id !== exceptId)
  if (duplicate) throw new BadRequestError('Ya existe una pregunta con ese código en esta versión.')
}

function applyQuestion(record, input) {
  record.set('code', input.code)
  record.set('skill', input.skill)
  record.set('cefr_level', input.cefrLevel)
  record.set('prompt', input.prompt)
  record.set('passage', input.passage)
  record.set('options', input.options)
  record.set('correct_option_id', input.correctOptionId)
  record.set('internal_explanation', input.explanation)
  record.set('weight', input.weight)
  record.set('active', input.active)
  record.set('admin_order', input.adminOrder)
}

function createQuestion(e) {
  noStore(e)
  requireAdmin(e)
  const test = requireDraft(e.app, String(e.request.pathValue('id') || ''))
  const input = normalizedQuestion(requestBody(e), null)
  ensureUniqueCode(e.app, test.id, input.code, '')
  const collection = e.app.findCollectionByNameOrId('placement_questions')
  const record = new Record(collection)
  record.set('test', test.id)
  applyQuestion(record, input)
  e.app.save(record)
  return e.json(201, { question: questionDto(record), validation: validationReport(e.app, test) })
}

function requireQuestion(app, id) {
  if (!id) throw new BadRequestError('Falta la pregunta.')
  try { return app.findRecordById('placement_questions', id) } catch { throw new BadRequestError('La pregunta no existe.') }
}

function updateQuestion(e) {
  noStore(e)
  requireAdmin(e)
  const question = requireQuestion(e.app, String(e.request.pathValue('id') || ''))
  const test = requireDraft(e.app, question.getString('test'))
  const input = normalizedQuestion(requestBody(e), question)
  ensureUniqueCode(e.app, test.id, input.code, question.id)
  applyQuestion(question, input)
  e.app.save(question)
  return e.json(200, { question: questionDto(question), validation: validationReport(e.app, test) })
}

function deleteQuestion(e) {
  noStore(e)
  requireAdmin(e)
  const question = requireQuestion(e.app, String(e.request.pathValue('id') || ''))
  const test = requireDraft(e.app, question.getString('test'))
  e.app.delete(question)
  return e.json(200, { deleted: true, validation: validationReport(e.app, test) })
}

function publish(e) {
  noStore(e)
  requireAdmin(e)
  const id = String(e.request.pathValue('id') || '')
  const draft = requireDraft(e.app, id)
  const initialReport = validationReport(e.app, draft)
  if (!initialReport.ready) throw new BadRequestError(`La versión no puede publicarse todavía: ${initialReport.errors.slice(0, 3).join(' ')}`)

  e.app.runInTransaction((txApp) => {
    const txDraft = requireDraft(txApp, id)
    const report = validationReport(txApp, txDraft)
    if (!report.ready) throw new BadRequestError('El banco ha cambiado y ya no cumple los requisitos de publicación.')
    txApp.findAllRecords('placement_tests').filter((record) => record.id !== txDraft.id && record.getString('status') === 'PUBLISHED').forEach((record) => {
      record.set('status', 'ARCHIVED')
      txApp.save(record)
    })
    txDraft.set('status', 'PUBLISHED')
    txDraft.set('published_at', new Date().toISOString())
    txApp.save(txDraft)
  })

  const published = e.app.findRecordById('placement_tests', id)
  return e.json(200, { test: testDto(e.app, published) })
}

module.exports = { listTests, createDraft, updateDraft, deleteDraft, listQuestions, createQuestion, updateQuestion, deleteQuestion, publish }

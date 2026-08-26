const placementCore = require(`${__hooks}/placement_core.js`)
const listeningCore = require(`${__hooks}/placement_listening_core.js`)
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

function requireAdmin(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para preparar el test progresivo.')
  if (e.auth.getString('role') !== 'ADMIN') throw new ForbiddenError('Solo Administración puede preparar el test progresivo.')
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
  } catch {}
  try {
    return JSON.parse(JSON.stringify(raw))
  } catch {
    return fallback
  }
}

function questionOptions(record) {
  const value = jsonField(record, 'options', [])
  return Array.isArray(value) ? value : []
}

function testQuestions(app, testId) {
  return app.findAllRecords('placement_questions')
    .filter((record) => record.getString('test') === testId)
    .sort((a, b) => Number(a.get('admin_order') || 0) - Number(b.get('admin_order') || 0) || a.getString('code').localeCompare(b.getString('code')))
}

function requireTest(app, id) {
  if (!id) throw new BadRequestError('Falta la versión del test.')
  try {
    return app.findRecordById('placement_tests', id)
  } catch {
    throw new BadRequestError('La versión del test no existe.')
  }
}

function requireProgressiveDraft(app, id) {
  const test = requireTest(app, id)
  if (test.getString('algorithm_version') !== progressiveCore.ALGORITHM_VERSION) {
    throw new BadRequestError('La versión no usa el motor progresivo.')
  }
  if (test.getString('status') !== 'DRAFT') {
    throw new BadRequestError('Solo una versión progresiva DRAFT puede publicarse.')
  }
  return test
}

function validateVersion(value) {
  const version = cleanText(value, 40)
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,39}$/.test(version)) {
    throw new BadRequestError('La versión debe tener entre 2 y 40 caracteres y usar solo letras, números, punto, guion o guion bajo.')
  }
  return version
}

function ensureUniqueVersion(app, version) {
  if (app.findAllRecords('placement_tests').some((record) => record.getString('version') === version)) {
    throw new BadRequestError('Ya existe una versión con ese identificador.')
  }
}

function cloneCoreQuestion(txApp, source, targetTestId, order) {
  const record = new Record(txApp.findCollectionByNameOrId('placement_questions'))
  record.set('test', targetTestId)
  record.set('code', source.getString('code'))
  record.set('skill', source.getString('skill'))
  record.set('cefr_level', source.getString('cefr_level'))
  record.set('prompt', source.getString('prompt'))
  record.set('passage', source.getString('passage'))
  record.set('options', questionOptions(source))
  record.set('correct_option_id', source.getString('correct_option_id'))
  record.set('internal_explanation', source.getString('internal_explanation'))
  record.set('weight', Number(source.get('weight') || 1))
  record.set('active', source.getBool('active'))
  record.set('admin_order', order)
  txApp.save(record)
}

function combinedRequirements() {
  const required = {}
  ;[...progressiveCore.publicCoverageRequirements(), ...placementCore.CAMPUS_BLUEPRINT].forEach((cell) => {
    const key = `${cell.skill}:${cell.level}`
    required[key] = Math.max(Number(required[key] || 0), Number(cell.count || 0))
  })
  return Object.keys(required).sort().map((key) => {
    const [skill, level] = key.split(':')
    return { skill, level, count: Number(required[key] || 0) }
  })
}

function validateProgressive(app, test) {
  const errors = []
  const questions = testQuestions(app, test.id)
  const active = questions.filter((question) => question.getBool('active'))
  const expectedCampus = placementCore.blueprintQuestionCount(placementCore.CAMPUS_BLUEPRINT)
  const publicDescriptor = jsonField(test, 'public_blueprint', {})

  if (test.getString('algorithm_version') !== progressiveCore.ALGORITHM_VERSION) {
    errors.push(`La versión debe usar ${progressiveCore.ALGORITHM_VERSION}.`)
  }
  if (test.getInt('public_question_count') !== progressiveCore.PUBLIC_QUESTION_COUNT) {
    errors.push(`El test público progresivo debe declarar ${progressiveCore.PUBLIC_QUESTION_COUNT} preguntas.`)
  }
  if (
    !publicDescriptor ||
    typeof publicDescriptor !== 'object' ||
    Array.isArray(publicDescriptor) ||
    publicDescriptor.type !== progressiveCore.SNAPSHOT_KIND ||
    Number(publicDescriptor.questionCount) !== progressiveCore.PUBLIC_QUESTION_COUNT
  ) {
    errors.push('La descripción del recorrido progresivo no es válida.')
  }
  if (test.getInt('campus_question_count') !== expectedCampus) {
    errors.push(`Campus debe conservar ${expectedCampus} preguntas core.`)
  }

  const campusBlueprint = jsonField(test, 'campus_blueprint', [])
  if (!Array.isArray(campusBlueprint) || placementCore.blueprintQuestionCount(campusBlueprint) !== expectedCampus) {
    errors.push('El blueprint Campus no coincide con el contrato completo.')
  }

  const available = {}
  active.forEach((question) => {
    const skill = question.getString('skill')
    const level = question.getString('cefr_level')
    if (!placementCore.SKILLS.includes(skill) || !placementCore.LEVELS.includes(level)) return

    const options = questionOptions(question)
    const ids = options.map((option) => String(option && option.id || ''))
    if (options.length < 2 || new Set(ids).size !== ids.length || !ids.includes(question.getString('correct_option_id'))) {
      errors.push(`${question.getString('code')}: opciones o respuesta correcta no válidas.`)
    }
    if (!question.getString('prompt').trim()) errors.push(`${question.getString('code')}: falta el enunciado.`)
    const key = `${skill}:${level}`
    available[key] = Number(available[key] || 0) + 1
  })

  const requirements = combinedRequirements().map((cell) => {
    const key = `${cell.skill}:${cell.level}`
    const count = Number(available[key] || 0)
    if (count < cell.count) errors.push(`${cell.skill} ${cell.level}: faltan ${cell.count - count} pregunta(s) activa(s).`)
    return { skill: cell.skill, level: cell.level, required: cell.count, available: count, ready: count >= cell.count }
  })

  return {
    ready: errors.length === 0,
    errors: [...new Set(errors)],
    requirements,
    questionCount: questions.length,
    activeQuestionCount: active.length,
    publicQuestionCount: progressiveCore.PUBLIC_QUESTION_COUNT,
    campusQuestionCount: expectedCampus,
  }
}

function createVersion(e) {
  noStore(e)
  const admin = requireAdmin(e)
  const body = requestBody(e)
  const sourceId = cleanText(body.sourceTestId, 40)
  const name = cleanText(body.name, 180)
  const version = validateVersion(body.version)
  if (!sourceId || !name) throw new BadRequestError('Selecciona una versión de origen e indica nombre y versión.')
  ensureUniqueVersion(e.app, version)

  const source = requireTest(e.app, sourceId)
  const sourceAlgorithm = source.getString('algorithm_version')
  const supportedSources = ['cefr-v1', listeningCore.ALGORITHM_VERSION, progressiveCore.ALGORITHM_VERSION]
  if (!supportedSources.includes(sourceAlgorithm)) {
    throw new BadRequestError('La versión de origen no es compatible con el motor progresivo.')
  }

  const sourceCoreQuestions = testQuestions(e.app, source.id).filter((question) => placementCore.SKILLS.includes(question.getString('skill')))
  if (!sourceCoreQuestions.length) throw new BadRequestError('La versión de origen no contiene preguntas core.')

  let createdId = ''
  e.app.runInTransaction((txApp) => {
    const record = new Record(txApp.findCollectionByNameOrId('placement_tests'))
    record.set('name', name)
    record.set('version', version)
    record.set('status', 'DRAFT')
    record.set('algorithm_version', progressiveCore.ALGORITHM_VERSION)
    record.set('public_question_count', progressiveCore.PUBLIC_QUESTION_COUNT)
    record.set('campus_question_count', placementCore.blueprintQuestionCount(placementCore.CAMPUS_BLUEPRINT))
    record.set('public_blueprint', progressiveCore.publicBlueprintDescriptor())
    record.set('campus_blueprint', placementCore.CAMPUS_BLUEPRINT)
    record.set('campus_retake_days', source.getInt('campus_retake_days'))
    record.set('published_at', '')
    record.set('created_by', admin.id)
    txApp.save(record)
    createdId = record.id

    sourceCoreQuestions.forEach((question, index) => {
      cloneCoreQuestion(txApp, txApp.findRecordById('placement_questions', question.id), record.id, index + 1)
    })
  })

  const created = e.app.findRecordById('placement_tests', createdId)
  return e.json(201, {
    testId: created.id,
    algorithmVersion: created.getString('algorithm_version'),
    validation: validateProgressive(e.app, created),
  })
}

function status(e) {
  noStore(e)
  requireAdmin(e)
  const test = requireTest(e.app, String(e.request.pathValue('id') || ''))
  if (test.getString('algorithm_version') !== progressiveCore.ALGORITHM_VERSION) {
    throw new BadRequestError('La versión no usa el motor progresivo.')
  }
  return e.json(200, {
    testId: test.id,
    status: test.getString('status'),
    algorithmVersion: test.getString('algorithm_version'),
    validation: validateProgressive(e.app, test),
  })
}

function publish(e) {
  noStore(e)
  requireAdmin(e)
  const test = requireProgressiveDraft(e.app, String(e.request.pathValue('id') || ''))
  const validation = validateProgressive(e.app, test)
  if (!validation.ready) {
    throw new BadRequestError(`La versión progresiva no está lista: ${validation.errors.slice(0, 4).join(' · ')}`)
  }

  e.app.runInTransaction((txApp) => {
    txApp.findAllRecords('placement_tests')
      .filter((record) => record.getString('status') === 'PUBLISHED' && record.id !== test.id)
      .forEach((record) => {
        record.set('status', 'ARCHIVED')
        txApp.save(record)
      })

    const target = txApp.findRecordById('placement_tests', test.id)
    if (target.getString('status') !== 'DRAFT') throw new BadRequestError('La versión ha dejado de ser DRAFT.')
    target.set('status', 'PUBLISHED')
    target.set('published_at', new Date().toISOString().replace('T', ' '))
    txApp.save(target)
  })

  const published = e.app.findRecordById('placement_tests', test.id)
  return e.json(200, {
    testId: published.id,
    status: published.getString('status'),
    algorithmVersion: published.getString('algorithm_version'),
    validation: validateProgressive(e.app, published),
  })
}

module.exports = { createVersion, status, publish, validateProgressive }

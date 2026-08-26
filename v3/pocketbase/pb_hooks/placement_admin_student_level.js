const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const REASONS = ['INITIAL', 'REVIEW', 'PROGRESS', 'OTHER']

function noStore(e) {
  e.response.header().set('Cache-Control', 'no-store')
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function requestBody(e) {
  const body = e.requestInfo().body || {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
  return body
}

function requireAdmin(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para gestionar el nivel del alumno.')
  if (e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') {
    throw new ForbiddenError('Solo Administración puede gestionar el nivel del alumno.')
  }
  return e.auth
}

function requireStudent(app, studentId) {
  const id = text(studentId)
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError('Alumno no válido.')
  let student
  try { student = app.findRecordById('users', id) } catch { throw new BadRequestError('Alumno no encontrado.') }
  if (student.getString('role') !== 'STUDENT') throw new BadRequestError('El usuario seleccionado no es un alumno.')
  return student
}

function safeUser(app, id) {
  if (!id) return null
  try { return app.findRecordById('users', id) } catch { return null }
}

function userName(record) {
  if (!record) return ''
  const name = [record.getString('name'), record.getString('surname')].filter(Boolean).join(' ').trim()
  return name || record.getString('email') || 'Usuario'
}

function timestamp(value) {
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) ? time : 0
}

function newest(records, field) {
  return records.slice().sort((a, b) => timestamp(b.getString(field) || b.getString('created')) - timestamp(a.getString(field) || a.getString('created')))
}

function jsonField(record, field) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return {}
  try {
    const rawText = toString(raw)
    if (rawText) return JSON.parse(rawText)
  } catch { /* JSONRaw can already be an object */ }
  try { return JSON.parse(JSON.stringify(raw)) } catch { return {} }
}

function attemptDto(record) {
  if (!record) return null
  return {
    id: record.id,
    estimatedLevel: record.getString('estimated_level'),
    scorePercent: Number(record.get('score_percent') || 0),
    skillScores: jsonField(record, 'skill_scores'),
    completedAt: record.getString('completed_at'),
    algorithmVersion: record.getString('algorithm_version'),
  }
}

function assessmentDto(app, record) {
  if (!record) return null
  const assessor = safeUser(app, record.getString('assessed_by'))
  return {
    id: record.id,
    sourceAttemptId: record.getString('source_attempt'),
    automaticLevel: record.getString('automatic_level'),
    speakingLevel: record.getString('speaking_level'),
    validatedLevel: record.getString('validated_level'),
    notes: record.getString('notes'),
    assessedBy: record.getString('assessed_by'),
    assessedByName: userName(assessor),
    assessedAt: record.getString('assessed_at'),
    reason: record.getString('reason'),
  }
}

function activeGroup(app, studentId) {
  const enrollment = app.findAllRecords('enrollments').find((record) =>
    record.getString('student') === studentId && record.getString('status') === 'ACTIVE'
  )
  if (!enrollment) return null
  let group
  try { group = app.findRecordById('groups', enrollment.getString('group')) } catch { return null }
  return {
    id: group.id,
    name: group.getString('name'),
    targetLevel: group.getString('target_level').toUpperCase(),
  }
}

function studentState(app, student) {
  const attempts = newest(
    app.findAllRecords('placement_attempts').filter((record) =>
      record.getString('student') === student.id
      && record.getString('mode') === 'CAMPUS'
      && record.getString('status') === 'COMPLETED'
      && record.getString('estimated_level')
    ),
    'completed_at',
  )
  const assessments = newest(
    app.findAllRecords('student_level_assessments').filter((record) => record.getString('student') === student.id),
    'assessed_at',
  )
  const latestAttempt = attempts[0] || null
  const latestAssessment = assessments[0] || null
  const validated = latestAssessment ? latestAssessment.getString('validated_level') : ''
  const automatic = latestAttempt ? latestAttempt.getString('estimated_level') : ''
  return {
    student: {
      id: student.id,
      name: student.getString('name'),
      surname: student.getString('surname'),
      email: student.getString('email'),
      status: student.getString('status'),
    },
    currentLevel: validated || automatic,
    currentLevelSource: validated ? 'VALIDATED' : automatic ? 'AUTOMATIC' : 'NONE',
    latestAttempt: attemptDto(latestAttempt),
    latestAssessment: assessmentDto(app, latestAssessment),
    assessmentHistory: assessments.map((record) => assessmentDto(app, record)),
  }
}

function cleanText(value, max) {
  const cleaned = text(value)
  if (cleaned.length > max) throw new BadRequestError('El texto supera la longitud permitida.')
  return cleaned
}

function summary(e) {
  noStore(e)
  requireAdmin(e)
  const student = requireStudent(e.app, e.request.pathValue('studentId'))
  return e.json(200, studentState(e.app, student))
}

function createAssessment(e) {
  noStore(e)
  const admin = requireAdmin(e)
  const student = requireStudent(e.app, e.request.pathValue('studentId'))
  const body = requestBody(e)
  const validatedLevel = cleanText(body.validatedLevel, 2).toUpperCase()
  const speakingLevel = cleanText(body.speakingLevel, 2).toUpperCase()
  const reason = cleanText(body.reason, 20).toUpperCase()
  const notes = cleanText(body.notes, 30000)

  if (!LEVELS.includes(validatedLevel)) throw new BadRequestError('Nivel validado no válido.')
  if (speakingLevel && !LEVELS.includes(speakingLevel)) throw new BadRequestError('Nivel de speaking no válido.')
  if (!REASONS.includes(reason)) throw new BadRequestError('Motivo de valoración no válido.')

  const existing = e.app.findAllRecords('student_level_assessments').filter((record) => record.getString('student') === student.id)
  let sourceAttempt = null
  const sourceAttemptId = cleanText(body.sourceAttemptId, 64)
  if (sourceAttemptId) {
    try { sourceAttempt = e.app.findRecordById('placement_attempts', sourceAttemptId) } catch { throw new BadRequestError('La evaluación automática indicada no existe.') }
    if (
      sourceAttempt.getString('student') !== student.id
      || sourceAttempt.getString('mode') !== 'CAMPUS'
      || sourceAttempt.getString('status') !== 'COMPLETED'
      || !sourceAttempt.getString('estimated_level')
    ) {
      throw new ForbiddenError('La evaluación automática no pertenece a este alumno o no está completada.')
    }
  }

  if (reason === 'INITIAL' && existing.length > 0) {
    throw new BadRequestError('El alumno ya tiene histórico de nivel. Registra una revisión o progreso en lugar de otra valoración inicial.')
  }
  if (reason === 'INITIAL' && sourceAttempt) {
    throw new BadRequestError('La valoración INITIAL es una valoración inicial de academia y no puede sobrescribir ni adoptar un test automático.')
  }
  if (existing.length === 0 && !sourceAttempt && reason !== 'INITIAL') {
    throw new BadRequestError('La primera valoración manual sin test debe registrarse como INITIAL.')
  }

  const group = activeGroup(e.app, student.id)
  const mismatch = Boolean(group && group.targetLevel && group.targetLevel !== 'MIXED' && group.targetLevel !== validatedLevel)
  if (mismatch && body.acknowledgeLevelMismatch !== true) {
    throw new BadRequestError(`El nivel ${validatedLevel} no coincide con el objetivo ${group.targetLevel} del grupo ${group.name}. Confirma explícitamente el desajuste.`)
  }
  if (mismatch && !notes) {
    throw new BadRequestError('Justifica en observaciones por qué el nivel validado no coincide con el grupo actual.')
  }

  const record = new Record(e.app.findCollectionByNameOrId('student_level_assessments'))
  record.set('student', student.id)
  record.set('source_attempt', sourceAttempt ? sourceAttempt.id : '')
  record.set('automatic_level', sourceAttempt ? sourceAttempt.getString('estimated_level') : '')
  record.set('speaking_level', speakingLevel)
  record.set('validated_level', validatedLevel)
  record.set('notes', notes)
  record.set('assessed_by', admin.id)
  record.set('assessed_at', new Date().toISOString())
  record.set('reason', reason)
  e.app.save(record)

  return e.json(201, {
    assessment: assessmentDto(e.app, record),
    summary: studentState(e.app, student),
  })
}

module.exports = { summary, createAssessment }
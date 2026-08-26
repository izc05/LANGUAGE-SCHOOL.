const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const REASONS = ['INITIAL', 'REVIEW', 'PROGRESS', 'OTHER']

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

function requireTeacher(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para acceder a la valoración de nivel.')
  if (e.auth.getString('role') !== 'TEACHER') throw new ForbiddenError('Solo un profesor puede usar esta función.')
  return e.auth
}

function teacherOwnsStudent(app, teacherId, studentId) {
  return app.findAllRecords('enrollments').some((enrollment) => {
    if (enrollment.getString('student') !== studentId || enrollment.getString('status') !== 'ACTIVE') return false
    try {
      const group = app.findRecordById('groups', enrollment.getString('group'))
      return group.getString('teacher') === teacherId && group.getString('status') === 'ACTIVE'
    } catch {
      return false
    }
  })
}

function requireOwnedStudent(e) {
  const teacher = requireTeacher(e)
  const studentId = e.request.pathValue('studentId')
  if (!studentId) throw new BadRequestError('Falta el alumno.')
  let student
  try {
    student = e.app.findRecordById('users', studentId)
  } catch {
    throw new BadRequestError('Alumno no encontrado.')
  }
  if (student.getString('role') !== 'STUDENT') throw new BadRequestError('El usuario seleccionado no es un alumno.')
  if (!teacherOwnsStudent(e.app, teacher.id, student.id)) throw new ForbiddenError('Este alumno no pertenece a uno de tus grupos activos.')
  return { teacher, student }
}

function newest(records, field) {
  return [...records].sort((a, b) => String(b.getString(field) || b.getString('created')).localeCompare(String(a.getString(field) || a.getString('created'))))
}

function jsonField(record, field) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return {}
  try {
    const text = toString(raw)
    if (text) return JSON.parse(text)
  } catch { /* JSONRaw can already be an object */ }
  try { return JSON.parse(JSON.stringify(raw)) } catch { return {} }
}

function attemptDto(attempt) {
  if (!attempt) return null
  return {
    attemptId: attempt.id,
    estimatedLevel: attempt.getString('estimated_level'),
    scorePercent: Number(attempt.get('score_percent') || 0),
    skillScores: jsonField(attempt, 'skill_scores'),
    completedAt: attempt.getString('completed_at'),
    algorithmVersion: attempt.getString('algorithm_version'),
  }
}

function assessmentDto(record) {
  if (!record) return null
  return {
    assessmentId: record.id,
    sourceAttemptId: record.getString('source_attempt'),
    automaticLevel: record.getString('automatic_level'),
    speakingLevel: record.getString('speaking_level'),
    validatedLevel: record.getString('validated_level'),
    notes: record.getString('notes'),
    assessedBy: record.getString('assessed_by'),
    assessedAt: record.getString('assessed_at'),
    reason: record.getString('reason'),
  }
}

function summary(e) {
  noStore(e)
  const { student } = requireOwnedStudent(e)
  const attempts = newest(
    e.app.findAllRecords('placement_attempts').filter((record) =>
      record.getString('student') === student.id && record.getString('mode') === 'CAMPUS' && record.getString('status') === 'COMPLETED'
    ),
    'completed_at',
  )
  const assessments = newest(
    e.app.findAllRecords('student_level_assessments').filter((record) => record.getString('student') === student.id),
    'assessed_at',
  )
  const latestAttempt = attempts[0] || null
  const latestAssessment = assessments[0] || null
  return e.json(200, {
    student: {
      id: student.id,
      name: student.getString('name'),
      surname: student.getString('surname'),
      email: student.getString('email'),
    },
    currentLevel: latestAssessment ? latestAssessment.getString('validated_level') : latestAttempt ? latestAttempt.getString('estimated_level') : '',
    currentLevelSource: latestAssessment ? 'VALIDATED' : latestAttempt ? 'AUTOMATIC' : 'NONE',
    latestAttempt: attemptDto(latestAttempt),
    latestAssessment: assessmentDto(latestAssessment),
    assessmentHistory: assessments.map(assessmentDto),
  })
}

function cleanText(value, max) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) throw new BadRequestError('El texto supera la longitud permitida.')
  return text
}

function validate(e) {
  noStore(e)
  const { teacher, student } = requireOwnedStudent(e)
  const body = requestBody(e)

  const validatedLevel = cleanText(body.validatedLevel, 2)
  const speakingLevel = cleanText(body.speakingLevel, 2)
  const reason = cleanText(body.reason, 20) || 'REVIEW'
  const notes = cleanText(body.notes, 30000)
  if (!LEVELS.includes(validatedLevel)) throw new BadRequestError('Nivel validado no válido.')
  if (speakingLevel && !LEVELS.includes(speakingLevel)) throw new BadRequestError('Nivel de speaking no válido.')
  if (!REASONS.includes(reason)) throw new BadRequestError('Motivo de valoración no válido.')

  let sourceAttempt = null
  const sourceAttemptId = cleanText(body.sourceAttemptId, 40)
  if (sourceAttemptId) {
    try {
      sourceAttempt = e.app.findRecordById('placement_attempts', sourceAttemptId)
    } catch {
      throw new BadRequestError('La evaluación automática indicada no existe.')
    }
    if (sourceAttempt.getString('student') !== student.id || sourceAttempt.getString('mode') !== 'CAMPUS' || sourceAttempt.getString('status') !== 'COMPLETED') {
      throw new ForbiddenError('La evaluación automática no pertenece a este alumno.')
    }
  }

  const collection = e.app.findCollectionByNameOrId('student_level_assessments')
  const record = new Record(collection)
  record.set('student', student.id)
  if (sourceAttempt) record.set('source_attempt', sourceAttempt.id)
  record.set('automatic_level', sourceAttempt ? sourceAttempt.getString('estimated_level') : '')
  record.set('speaking_level', speakingLevel)
  record.set('validated_level', validatedLevel)
  record.set('notes', notes)
  record.set('assessed_by', teacher.id)
  record.set('assessed_at', new Date().toISOString())
  record.set('reason', reason)
  e.app.save(record)

  return e.json(201, { assessment: assessmentDto(record) })
}

module.exports = { summary, validate }

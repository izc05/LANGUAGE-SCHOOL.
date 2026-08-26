function noStore(e) {
  e.response.header().set('Cache-Control', 'no-store')
}

function requireAdmin(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión para consultar los resultados de nivel.')
  if (e.auth.getString('role') !== 'ADMIN') throw new ForbiddenError('Solo Administración puede consultar los resultados de nivel.')
}

function jsonField(record, field, fallback) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return fallback
  try {
    const text = toString(raw)
    if (text) return JSON.parse(text)
  } catch {
    // JSONRaw can already be an object in the JSVM runtime.
  }
  try { return JSON.parse(JSON.stringify(raw)) } catch { return fallback }
}

function userName(record) {
  if (!record) return ''
  const name = [record.getString('name'), record.getString('surname')].filter(Boolean).join(' ').trim()
  return name || record.getString('email') || 'Alumno'
}

function safeUser(app, id) {
  if (!id) return null
  try { return app.findRecordById('users', id) } catch { return null }
}

function safeTest(app, id) {
  if (!id) return null
  try { return app.findRecordById('placement_tests', id) } catch { return null }
}

function assessmentDto(app, record) {
  if (!record) return null
  const assessor = safeUser(app, record.getString('assessed_by'))
  return {
    id: record.id,
    automaticLevel: record.getString('automatic_level'),
    speakingLevel: record.getString('speaking_level'),
    validatedLevel: record.getString('validated_level'),
    reason: record.getString('reason'),
    notes: record.getString('notes'),
    assessedAt: record.getString('assessed_at'),
    assessedBy: record.getString('assessed_by'),
    assessedByName: userName(assessor),
    sourceAttemptId: record.getString('source_attempt'),
  }
}

function attemptDto(app, record) {
  const studentId = record.getString('student')
  const student = safeUser(app, studentId)
  const test = safeTest(app, record.getString('test'))
  return {
    id: record.id,
    mode: record.getString('mode'),
    status: record.getString('status'),
    studentId,
    studentName: studentId ? userName(student) : 'Visitante anónimo',
    testId: record.getString('test'),
    testVersion: test ? test.getString('version') : '',
    estimatedLevel: record.getString('estimated_level'),
    rawScore: Number(record.get('raw_score') || 0),
    maxScore: Number(record.get('max_score') || 0),
    scorePercent: Number(record.get('score_percent') || 0),
    skillScores: jsonField(record, 'skill_scores', {}),
    startedAt: record.getString('started_at'),
    completedAt: record.getString('completed_at'),
    createdAt: record.getString('created'),
  }
}

function timestamp(value) {
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) ? time : 0
}

function newest(records, field) {
  return records.slice().sort((a, b) => timestamp(b.getString(field) || b.getString('created')) - timestamp(a.getString(field) || a.getString('created')))[0] || null
}

function overview(e) {
  noStore(e)
  requireAdmin(e)

  const attempts = e.app.findAllRecords('placement_attempts')
  const assessments = e.app.findAllRecords('student_level_assessments')
  const students = e.app.findAllRecords('users')
    .filter((record) => record.getString('role') === 'STUDENT')
    .sort((a, b) => userName(a).localeCompare(userName(b), 'es'))

  const studentLevels = students.map((student) => {
    const studentAttempts = attempts.filter((attempt) => (
      attempt.getString('mode') === 'CAMPUS'
      && attempt.getString('student') === student.id
      && attempt.getString('status') === 'COMPLETED'
      && attempt.getString('estimated_level')
    ))
    const studentAssessments = assessments.filter((assessment) => assessment.getString('student') === student.id)
    const latestAttempt = newest(studentAttempts, 'completed_at')
    const latestAssessment = newest(studentAssessments, 'assessed_at')
    const validated = latestAssessment ? latestAssessment.getString('validated_level') : ''
    const automatic = latestAttempt ? latestAttempt.getString('estimated_level') : ''
    return {
      studentId: student.id,
      studentName: userName(student),
      email: student.getString('email'),
      status: student.getString('status'),
      currentLevel: validated || automatic,
      currentLevelSource: validated ? 'VALIDATED' : automatic ? 'AUTOMATIC' : 'NONE',
      latestAttempt: latestAttempt ? attemptDto(e.app, latestAttempt) : null,
      latestAssessment: assessmentDto(e.app, latestAssessment),
      attemptCount: studentAttempts.length,
      assessmentCount: studentAssessments.length,
    }
  })

  const recentAttempts = attempts.slice()
    .sort((a, b) => {
      const bTime = timestamp(b.getString('completed_at') || b.getString('started_at') || b.getString('created'))
      const aTime = timestamp(a.getString('completed_at') || a.getString('started_at') || a.getString('created'))
      return bTime - aTime
    })
    .slice(0, 100)
    .map((record) => attemptDto(e.app, record))

  return e.json(200, {
    metrics: {
      totalAttempts: attempts.length,
      completedAttempts: attempts.filter((record) => record.getString('status') === 'COMPLETED').length,
      publicAttempts: attempts.filter((record) => record.getString('mode') === 'PUBLIC').length,
      campusAttempts: attempts.filter((record) => record.getString('mode') === 'CAMPUS').length,
      studentsWithLevel: studentLevels.filter((student) => student.currentLevel).length,
      validatedStudents: studentLevels.filter((student) => student.currentLevelSource === 'VALIDATED').length,
    },
    studentLevels,
    recentAttempts,
  })
}

module.exports = { overview }

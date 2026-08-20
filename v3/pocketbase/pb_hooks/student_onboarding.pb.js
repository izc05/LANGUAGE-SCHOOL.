/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/language-school/admin/academic/enrollments/onboard', (e) => {
  function text(value) { return typeof value === 'string' ? value.trim() : '' }
  function body() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    return parsed
  }
  function requireAdmin() {
    if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') {
      throw new ForbiddenError('Solo Administración puede completar el alta académica.')
    }
  }
  function readId(value, label) {
    const id = text(value)
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
    return id
  }
  function newest(records, field) {
    return [...records].sort((a, b) => String(b.getString(field) || b.getString('created')).localeCompare(String(a.getString(field) || a.getString('created'))))
  }
  function currentLevel(app, studentId) {
    const assessments = newest(
      app.findAllRecords('student_level_assessments').filter((record) => record.getString('student') === studentId),
      'assessed_at',
    )
    if (assessments[0]) return assessments[0].getString('validated_level')

    const attempts = newest(
      app.findAllRecords('placement_attempts').filter((record) =>
        record.getString('student') === studentId &&
        record.getString('mode') === 'CAMPUS' &&
        record.getString('status') === 'COMPLETED'
      ),
      'completed_at',
    )
    return attempts[0] ? attempts[0].getString('estimated_level') : ''
  }
  function onboardingStudent(app, studentId) {
    let student
    try { student = app.findRecordById('users', studentId) } catch { throw new BadRequestError('El alumno no existe.') }
    if (student.getString('role') !== 'STUDENT') throw new BadRequestError('La cuenta seleccionada no pertenece a un alumno.')
    const status = student.getString('status')
    if (status !== 'INVITED' && status !== 'ACTIVE') {
      throw new BadRequestError('El alumno debe estar invitado o activo para preparar su matrícula.')
    }
    return student
  }
  function activeGroup(app, groupId, expectedCourseId) {
    let group
    try { group = app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo no existe.') }
    if (group.getString('status') !== 'ACTIVE') throw new BadRequestError('El grupo debe estar activo.')
    if (group.getString('course') !== expectedCourseId) throw new BadRequestError('El grupo ya no pertenece al curso seleccionado. Revisa el alta antes de continuar.')

    let course
    try { course = app.findRecordById('courses', group.getString('course')) } catch { throw new BadRequestError('El curso del grupo no existe.') }
    if (course.getString('status') !== 'ACTIVE') throw new BadRequestError('El curso del grupo debe estar activo.')

    let teacher
    try { teacher = app.findRecordById('users', group.getString('teacher')) } catch { throw new BadRequestError('El profesor del grupo no existe.') }
    if (teacher.getString('role') !== 'TEACHER' || teacher.getString('status') !== 'ACTIVE') {
      throw new BadRequestError('El profesor responsable del grupo debe estar activo.')
    }
    return { group, course, teacher }
  }

  requireAdmin()
  const data = body()
  const studentId = readId(data.studentId, 'Alumno')
  const targetGroupId = readId(data.targetGroupId, 'Grupo')
  const expectedCourseId = readId(data.expectedCourseId, 'Curso')
  const acknowledgeLevelMismatch = data.acknowledgeLevelMismatch === true
  let response = null

  e.app.runInTransaction((txApp) => {
    const student = onboardingStudent(txApp, studentId)
    const resolved = activeGroup(txApp, targetGroupId, expectedCourseId)
    const current = txApp.findAllRecords(
      'enrollments',
      $dbx.hashExp({ student: studentId, status: 'ACTIVE' }),
    )
    if (current.length > 1) throw new BadRequestError('El alumno tiene más de una matrícula activa. Corrige la incoherencia antes de continuar.')
    if (current[0] && current[0].getString('group') === targetGroupId) {
      const level = currentLevel(txApp, studentId)
      const targetLevel = resolved.group.getString('target_level')
      const mismatch = Boolean(level && targetLevel && targetLevel !== 'MIXED' && level !== targetLevel)
      response = {
        currentId: current[0].id,
        unchanged: true,
        studentStatus: student.getString('status'),
        currentLevel: level,
        targetLevel,
        levelMismatch: mismatch,
        courseId: resolved.course.id,
        teacherId: resolved.teacher.id,
      }
      return
    }
    if (current[0]) {
      throw new BadRequestError('El alumno ya tiene una matrícula activa. Utiliza su ficha para cambiarlo de grupo y conservar el histórico.')
    }

    const level = currentLevel(txApp, studentId)
    const targetLevel = resolved.group.getString('target_level')
    const mismatch = Boolean(level && targetLevel && targetLevel !== 'MIXED' && level !== targetLevel)
    if (mismatch && !acknowledgeLevelMismatch) {
      throw new BadRequestError(`El nivel actual del alumno (${level}) no coincide con el nivel objetivo del grupo (${targetLevel}). Confirma expresamente la asignación para continuar.`)
    }

    const occupied = txApp.countRecords(
      'enrollments',
      $dbx.hashExp({ group: targetGroupId, status: 'ACTIVE' }),
    )
    if (occupied >= resolved.group.getInt('capacity')) throw new BadRequestError('El grupo ya ha alcanzado su capacidad.')

    const enrollment = new Record(txApp.findCollectionByNameOrId('enrollments'))
    enrollment.set('student', studentId)
    enrollment.set('group', targetGroupId)
    enrollment.set('status', 'ACTIVE')
    enrollment.set('joined_at', new Date().toISOString())
    enrollment.set('ended_at', '')
    txApp.save(enrollment)

    response = {
      currentId: enrollment.id,
      unchanged: false,
      studentStatus: student.getString('status'),
      currentLevel: level,
      targetLevel,
      levelMismatch: mismatch,
      courseId: resolved.course.id,
      teacherId: resolved.teacher.id,
    }
  })

  return e.json(200, response)
}, $apis.requireAuth('users'))

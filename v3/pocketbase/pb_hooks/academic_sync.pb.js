/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  function requestBody() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    }
    return parsed
  }

  function hasOwn(body, key) {
    return Object.prototype.hasOwnProperty.call(body, key)
  }

  const body = requestBody()
  if (!hasOwn(body, 'status')) return e.next()

  let current
  try { current = e.app.findRecordById('users', e.record.id) } catch { throw new BadRequestError('La cuenta no existe.') }
  const currentRole = current.getString('role')
  const currentStatus = current.getString('status')
  const nextStatus = e.record.getString('status')

  if (currentStatus === 'ACTIVE' && nextStatus !== 'ACTIVE') {
    if (currentRole === 'TEACHER') {
      const activeGroups = e.app.findRecordsByFilter('groups', `teacher = "${e.record.id}" && status = "ACTIVE"`, '', 1, 0)
      if (activeGroups.length > 0) {
        throw new BadRequestError('No puedes desactivar este profesor mientras tenga grupos activos. Reasigna o pausa primero sus grupos.')
      }
    }

    if (currentRole === 'STUDENT') {
      const activeEnrollments = e.app.findAllRecords(
        'enrollments',
        $dbx.hashExp({ student: e.record.id, status: 'ACTIVE' }),
      )
      if (activeEnrollments.length > 0) {
        throw new BadRequestError('No puedes desactivar este alumno mientras tenga una matrícula activa. Finaliza o pausa primero su matrícula.')
      }
    }
  }

  e.next()
}, 'users')

onRecordAfterUpdateSuccess((e) => {
  const role = e.record.getString('role')
  const collectionName = role === 'STUDENT' ? 'student_profiles' : role === 'TEACHER' ? 'teacher_profiles' : ''
  if (!collectionName) return e.next()

  const profiles = e.app.findAllRecords(
    collectionName,
    $dbx.hashExp({ user: e.record.id }),
  )
  if (!profiles.length) return e.next()

  const profile = profiles[0]
  const shouldBeActive = e.record.getString('status') === 'ACTIVE'
  if (profile.getBool('active') !== shouldBeActive) {
    profile.set('active', shouldBeActive)
    e.app.save(profile)
  }

  e.next()
}, 'users')

onRecordUpdateRequest((e) => {
  function requestBody() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    }
    return parsed
  }

  function hasOwn(body, key) {
    return Object.prototype.hasOwnProperty.call(body, key)
  }

  function readId(value, label) {
    const id = typeof value === 'string' ? value.trim() : ''
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
    return id
  }

  const body = requestBody()
  if (!hasOwn(body, 'teacher')) return e.next()

  const teacherId = readId(e.record.getString('teacher'), 'Profesor')
  let teacher
  try { teacher = e.app.findRecordById('users', teacherId) } catch { throw new BadRequestError('El profesor no existe.') }
  if (teacher.getString('role') !== 'TEACHER') throw new BadRequestError('El profesor no tiene el rol esperado.')
  if (teacher.getString('status') !== 'ACTIVE') throw new BadRequestError('El profesor debe tener la cuenta activa.')

  e.next()
}, 'groups')

onRecordAfterUpdateSuccess((e) => {
  const newTeacher = e.record.getString('teacher')
  if (!newTeacher) return e.next()

  const now = Date.now()
  const scheduled = e.app.findAllRecords(
    'classes',
    $dbx.hashExp({ group: e.record.id, status: 'SCHEDULED' }),
  )
  scheduled.forEach((classRecord) => {
    const startsAt = new Date(classRecord.getString('starts_at')).getTime()
    if (!Number.isFinite(startsAt) || startsAt < now || classRecord.getString('teacher') === newTeacher) return
    classRecord.set('teacher', newTeacher)
    e.app.save(classRecord)
  })

  e.next()
}, 'groups')

onRecordCreateRequest((e) => {
  function readId(value, label) {
    const id = typeof value === 'string' ? value.trim() : ''
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
    return id
  }

  const groupId = readId(e.record.getString('group'), 'Grupo')
  let group
  try { group = e.app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo de la clase no existe.') }
  if (group.getString('status') !== 'ACTIVE') {
    throw new BadRequestError('No se pueden programar clases nuevas en un grupo no activo.')
  }

  const teacherId = readId(group.getString('teacher'), 'Profesor')
  let teacher
  try { teacher = e.app.findRecordById('users', teacherId) } catch { throw new BadRequestError('El profesor del grupo no existe.') }
  if (teacher.getString('role') !== 'TEACHER') throw new BadRequestError('El responsable del grupo no tiene rol de profesor.')
  if (teacher.getString('status') !== 'ACTIVE') throw new BadRequestError('El profesor del grupo debe tener la cuenta activa.')

  e.record.set('teacher', teacherId)
  e.next()
}, 'classes')

onRecordUpdateRequest((e) => {
  function requestBody() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    }
    return parsed
  }

  function hasOwn(body, key) {
    return Object.prototype.hasOwnProperty.call(body, key)
  }

  function readId(value, label) {
    const id = typeof value === 'string' ? value.trim() : ''
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
    return id
  }

  const body = requestBody()
  const assignmentChanged = hasOwn(body, 'group') || hasOwn(body, 'teacher')
  const scheduledRequested = hasOwn(body, 'status') && e.record.getString('status') === 'SCHEDULED'
  if (!assignmentChanged && !scheduledRequested) return e.next()

  const groupId = readId(e.record.getString('group'), 'Grupo')
  let group
  try { group = e.app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo de la clase no existe.') }

  const teacherId = readId(group.getString('teacher'), 'Profesor')
  let teacher
  try { teacher = e.app.findRecordById('users', teacherId) } catch { throw new BadRequestError('El profesor del grupo no existe.') }
  if (teacher.getString('role') !== 'TEACHER') throw new BadRequestError('El responsable del grupo no tiene rol de profesor.')
  if (teacher.getString('status') !== 'ACTIVE') throw new BadRequestError('El profesor del grupo debe tener la cuenta activa.')

  if (e.record.getString('status') === 'SCHEDULED' && group.getString('status') !== 'ACTIVE') {
    throw new BadRequestError('No se pueden programar clases nuevas en un grupo no activo.')
  }

  e.record.set('teacher', teacherId)
  e.next()
}, 'classes')

routerAdd('POST', '/api/language-school/admin/academic/enrollments/move', (e) => {
  if (!e.auth || e.auth.get('role') !== 'ADMIN') {
    throw new ForbiddenError('Solo Administración puede realizar esta operación.')
  }

  function readText(value) {
    return typeof value === 'string' ? value.trim() : ''
  }

  function readBody() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    }
    return parsed
  }

  function readId(value, label) {
    const id = readText(value)
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
    return id
  }

  function activeUser(app, userId, role, label) {
    let user
    try { user = app.findRecordById('users', userId) } catch { throw new BadRequestError(`${label} no existe.`) }
    if (user.getString('role') !== role) throw new BadRequestError(`${label} no tiene el rol esperado.`)
    if (user.getString('status') !== 'ACTIVE') throw new BadRequestError(`${label} debe tener la cuenta activa.`)
    return user
  }

  function activeGroup(app, groupId) {
    let group
    try { group = app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo no existe.') }
    if (group.getString('status') !== 'ACTIVE') throw new BadRequestError('El grupo debe estar activo.')

    let course
    try { course = app.findRecordById('courses', group.getString('course')) } catch { throw new BadRequestError('El curso del grupo no existe.') }
    if (course.getString('status') !== 'ACTIVE') throw new BadRequestError('El curso del grupo debe estar activo.')
    activeUser(app, group.getString('teacher'), 'TEACHER', 'El profesor del grupo')
    return group
  }

  function activeEnrollments(app, studentId) {
    return app.findAllRecords(
      'enrollments',
      $dbx.hashExp({ student: studentId, status: 'ACTIVE' }),
    )
  }

  function groupActiveCount(app, groupId) {
    return app.countRecords(
      'enrollments',
      $dbx.hashExp({ group: groupId, status: 'ACTIVE' }),
    )
  }

  const body = readBody()
  const studentId = readId(body.studentId, 'Alumno')
  const targetGroupId = readId(body.targetGroupId, 'Grupo')
  let previousId = ''
  let currentId = ''
  let unchanged = false
  const now = new Date().toISOString()

  e.app.runInTransaction((txApp) => {
    activeUser(txApp, studentId, 'STUDENT', 'El alumno')
    const targetGroup = activeGroup(txApp, targetGroupId)
    const current = activeEnrollments(txApp, studentId)
    if (current.length > 1) throw new BadRequestError('El alumno tiene más de una matrícula activa. Corrige la incoherencia antes de moverlo.')

    if (current[0] && current[0].getString('group') === targetGroupId) {
      currentId = current[0].id
      unchanged = true
      return
    }

    const occupied = groupActiveCount(txApp, targetGroupId)
    if (occupied >= targetGroup.getInt('capacity')) {
      throw new BadRequestError('El grupo de destino ya ha alcanzado su capacidad.')
    }

    if (current[0]) {
      current[0].set('status', 'FINISHED')
      current[0].set('ended_at', now)
      txApp.save(current[0])
      previousId = current[0].id
    }

    const collection = txApp.findCollectionByNameOrId('enrollments')
    const next = new Record(collection)
    next.set('student', studentId)
    next.set('group', targetGroupId)
    next.set('status', 'ACTIVE')
    next.set('joined_at', now)
    next.set('ended_at', '')
    txApp.save(next)
    currentId = next.id
  })

  return e.json(200, { previousId: previousId || null, currentId, unchanged })
}, $apis.requireAuth('users'))

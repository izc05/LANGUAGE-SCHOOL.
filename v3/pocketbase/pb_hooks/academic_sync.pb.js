/// <reference path="../pb_data/types.d.ts" />

function syncReadText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function syncRequestBody(e) {
  const parsed = e.requestInfo().body || {}
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestError('El cuerpo de la solicitud no es válido.')
  }
  return parsed
}

function syncHasOwn(body, key) {
  return Object.prototype.hasOwnProperty.call(body, key)
}

function syncId(value, label) {
  const id = syncReadText(value)
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
  return id
}

function syncActiveUser(app, userId, role, label) {
  let user
  try { user = app.findRecordById('users', userId) } catch { throw new BadRequestError(`${label} no existe.`) }
  if (user.getString('role') !== role) throw new BadRequestError(`${label} no tiene el rol esperado.`)
  if (user.getString('status') !== 'ACTIVE') throw new BadRequestError(`${label} debe tener la cuenta activa.`)
  return user
}

function syncActiveEnrollments(app, studentId, excludeId) {
  const records = app.findRecordsByFilter('enrollments', `student = "${studentId}" && status = "ACTIVE"`, '-joined_at', 10, 0)
  return excludeId ? records.filter((record) => record.id !== excludeId) : records
}

function syncProfileToAccount(app, user) {
  const role = user.getString('role')
  const collectionName = role === 'STUDENT' ? 'student_profiles' : role === 'TEACHER' ? 'teacher_profiles' : ''
  if (!collectionName) return
  const profiles = app.findRecordsByFilter(collectionName, `user = "${user.id}"`, '', 1, 0)
  if (!profiles.length) return
  const profile = profiles[0]
  const shouldBeActive = user.getString('status') === 'ACTIVE'
  if (profile.getBool('active') === shouldBeActive) return
  profile.set('active', shouldBeActive)
  app.save(profile)
}

onRecordUpdateRequest((e) => {
  const body = syncRequestBody(e)
  if (!syncHasOwn(body, 'status')) return e.next()

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
      const activeEnrollments = syncActiveEnrollments(e.app, e.record.id, '')
      if (activeEnrollments.length > 0) {
        throw new BadRequestError('No puedes desactivar este alumno mientras tenga una matrícula activa. Finaliza o pausa primero su matrícula.')
      }
    }
  }
  e.next()
}, 'users')

onRecordAfterUpdateSuccess((e) => {
  syncProfileToAccount(e.app, e.record)
  e.next()
}, 'users')

onRecordUpdateRequest((e) => {
  const body = syncRequestBody(e)
  if (syncHasOwn(body, 'teacher')) {
    syncActiveUser(e.app, syncId(e.record.getString('teacher'), 'Profesor'), 'TEACHER', 'El profesor')
  }
  e.next()
}, 'groups')

onRecordAfterUpdateSuccess((e) => {
  const newTeacher = e.record.getString('teacher')
  if (!newTeacher) return e.next()

  const now = Date.now()
  const scheduled = e.app.findAllRecords('classes', $dbx.hashExp({ group: e.record.id, status: 'SCHEDULED' }))
  scheduled.forEach((classRecord) => {
    const startsAt = new Date(classRecord.getString('starts_at')).getTime()
    if (!Number.isFinite(startsAt) || startsAt < now || classRecord.getString('teacher') === newTeacher) return
    classRecord.set('teacher', newTeacher)
    e.app.save(classRecord)
  })
  e.next()
}, 'groups')

function syncValidateClassUpdate(e) {
  const body = syncRequestBody(e)
  const assignmentChanged = syncHasOwn(body, 'group') || syncHasOwn(body, 'teacher')
  const scheduledRequested = syncHasOwn(body, 'status') && e.record.getString('status') === 'SCHEDULED'
  if (!assignmentChanged && !scheduledRequested) return e.next()

  const groupId = syncId(e.record.getString('group'), 'Grupo')
  const teacherId = syncId(e.record.getString('teacher'), 'Profesor')
  let group
  try { group = e.app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo de la clase no existe.') }
  syncActiveUser(e.app, teacherId, 'TEACHER', 'El profesor')

  if (group.getString('teacher') !== teacherId) {
    throw new BadRequestError('El profesor de la clase debe coincidir con el profesor responsable del grupo.')
  }
  if (e.record.getString('status') === 'SCHEDULED' && group.getString('status') !== 'ACTIVE') {
    throw new BadRequestError('No se pueden programar clases nuevas en un grupo no activo.')
  }
  e.next()
}

onRecordUpdateRequest((e) => syncValidateClassUpdate(e), 'classes')

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

  activeUser(e.app, studentId, 'STUDENT', 'El alumno')
  const targetGroup = activeGroup(e.app, targetGroupId)
  const currentBefore = activeEnrollments(e.app, studentId)
  if (currentBefore.length > 1) throw new BadRequestError('El alumno tiene más de una matrícula activa. Corrige la incoherencia antes de moverlo.')
  if (currentBefore[0] && currentBefore[0].getString('group') === targetGroupId) {
    return e.json(200, { previousId: null, currentId: currentBefore[0].id, unchanged: true })
  }

  const occupied = groupActiveCount(e.app, targetGroupId)
  if (occupied >= targetGroup.getInt('capacity')) throw new BadRequestError('El grupo de destino ya ha alcanzado su capacidad.')

  let previousId = ''
  let currentId = ''
  const now = new Date().toISOString()

  e.app.runInTransaction((txApp) => {
    const current = activeEnrollments(txApp, studentId)
    if (current.length > 1) throw new BadRequestError('El alumno tiene más de una matrícula activa.')

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

  return e.json(200, { previousId: previousId || null, currentId, unchanged: false })
}, $apis.requireAuth('users'))

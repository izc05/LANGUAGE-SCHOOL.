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

function syncRequireAdmin(e) {
  if (!e.auth) throw new UnauthorizedError('Debes iniciar sesión.')
  if (e.auth.getString('role') !== 'ADMIN') throw new ForbiddenError('Solo Administración puede realizar esta operación.')
  return e.auth
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

function syncActiveGroup(app, groupId) {
  let group
  try { group = app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo no existe.') }
  if (group.getString('status') !== 'ACTIVE') throw new BadRequestError('El grupo debe estar activo.')

  let course
  try { course = app.findRecordById('courses', group.getString('course')) } catch { throw new BadRequestError('El curso del grupo no existe.') }
  if (course.getString('status') !== 'ACTIVE') throw new BadRequestError('El curso del grupo debe estar activo.')
  syncActiveUser(app, group.getString('teacher'), 'TEACHER', 'El profesor del grupo')
  return group
}

function syncActiveEnrollments(app, studentId, excludeId) {
  const records = app.findRecordsByFilter('enrollments', `student = "${studentId}" && status = "ACTIVE"`, '-joined_at', 10, 0)
  return excludeId ? records.filter((record) => record.id !== excludeId) : records
}

function syncGroupActiveCount(app, groupId, excludeEnrollmentId) {
  const records = app.findRecordsByFilter('enrollments', `group = "${groupId}" && status = "ACTIVE"`, '', 0, 0)
  return excludeEnrollmentId ? records.filter((record) => record.id !== excludeEnrollmentId).length : records.length
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
  const oldRole = e.record.original().getString('role')
  const newRole = e.record.getString('role')
  if (oldRole !== newRole) {
    throw new BadRequestError('El rol de una cuenta existente no puede cambiarse. Crea una cuenta nueva con el rol correcto.')
  }

  const oldStatus = e.record.original().getString('status')
  const newStatus = e.record.getString('status')
  if (oldStatus === 'ACTIVE' && newStatus !== 'ACTIVE') {
    if (oldRole === 'TEACHER') {
      const activeGroups = e.app.findRecordsByFilter('groups', `teacher = "${e.record.id}" && status = "ACTIVE"`, '', 1, 0)
      if (activeGroups.length > 0) {
        throw new BadRequestError('No puedes desactivar este profesor mientras tenga grupos activos. Reasigna o pausa primero sus grupos.')
      }
    }
    if (oldRole === 'STUDENT') {
      const activeEnrollments = syncActiveEnrollments(e.app, e.record.id, '')
      if (activeEnrollments.length > 0) {
        throw new BadRequestError('No puedes desactivar este alumno mientras tenga una matrícula activa. Finaliza o pausa primero su matrícula.')
      }
    }
  }
  e.next()
}, 'users')

onRecordUpdate((e) => {
  const originalStatus = e.record.original().getString('status')
  e.next()
  if (originalStatus !== e.record.getString('status')) syncProfileToAccount(e.app, e.record)
}, 'users')

onRecordUpdateRequest((e) => {
  const oldTeacher = e.record.original().getString('teacher')
  const newTeacher = e.record.getString('teacher')
  if (oldTeacher !== newTeacher) syncActiveUser(e.app, syncId(newTeacher, 'Profesor'), 'TEACHER', 'El profesor')
  e.next()
}, 'groups')

onRecordUpdate((e) => {
  const oldTeacher = e.record.original().getString('teacher')
  const newTeacher = e.record.getString('teacher')
  e.next()
  if (!newTeacher || oldTeacher === newTeacher) return

  const now = Date.now()
  const scheduled = e.app.findRecordsByFilter('classes', `group = "${e.record.id}" && status = "SCHEDULED"`, 'starts_at', 0, 0)
  scheduled.forEach((classRecord) => {
    const startsAt = new Date(classRecord.getString('starts_at')).getTime()
    if (!Number.isFinite(startsAt) || startsAt < now || classRecord.getString('teacher') === newTeacher) return
    classRecord.set('teacher', newTeacher)
    e.app.save(classRecord)
  })
}, 'groups')

function syncValidateClass(e, isUpdate) {
  const groupId = syncId(e.record.getString('group'), 'Grupo')
  const teacherId = syncId(e.record.getString('teacher'), 'Profesor')
  let group
  try { group = e.app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo de la clase no existe.') }
  syncActiveUser(e.app, teacherId, 'TEACHER', 'El profesor')

  const scheduled = e.record.getString('status') === 'SCHEDULED'
  const assignmentChanged = isUpdate && (
    e.record.original().getString('group') !== groupId ||
    e.record.original().getString('teacher') !== teacherId
  )
  if ((scheduled || assignmentChanged) && group.getString('teacher') !== teacherId) {
    throw new BadRequestError('El profesor de la clase debe coincidir con el profesor responsable del grupo.')
  }
  if (scheduled && group.getString('status') !== 'ACTIVE') throw new BadRequestError('No se pueden programar clases nuevas en un grupo no activo.')
  e.next()
}

onRecordUpdateRequest((e) => syncValidateClass(e, true), 'classes')

routerAdd('POST', '/api/language-school/admin/academic/enrollments/move', (e) => {
  syncRequireAdmin(e)
  const body = syncRequestBody(e)
  const studentId = syncId(body.studentId, 'Alumno')
  const targetGroupId = syncId(body.targetGroupId, 'Grupo')

  syncActiveUser(e.app, studentId, 'STUDENT', 'El alumno')
  const targetGroup = syncActiveGroup(e.app, targetGroupId)
  const currentBefore = syncActiveEnrollments(e.app, studentId, '')
  if (currentBefore.length > 1) throw new BadRequestError('El alumno tiene más de una matrícula activa. Corrige la incoherencia antes de moverlo.')
  if (currentBefore[0] && currentBefore[0].getString('group') === targetGroupId) {
    return e.json(200, { previousId: null, currentId: currentBefore[0].id, unchanged: true })
  }

  const occupied = syncGroupActiveCount(e.app, targetGroupId, '')
  if (occupied >= targetGroup.getInt('capacity')) throw new BadRequestError('El grupo de destino ya ha alcanzado su capacidad.')

  let previousId = ''
  let currentId = ''
  let moveStage = 'abrir la transacción'
  const now = new Date().toISOString()
  try {
    e.app.runInTransaction((txApp) => {
      moveStage = 'leer la matrícula activa dentro de la transacción'
      const current = syncActiveEnrollments(txApp, studentId, '')
      if (current.length > 1) throw new BadRequestError('El alumno tiene más de una matrícula activa.')
      if (current[0]) {
        moveStage = 'cerrar la matrícula anterior'
        current[0].set('status', 'FINISHED')
        current[0].set('ended_at', now)
        txApp.save(current[0])
        previousId = current[0].id
      }

      moveStage = 'crear la nueva matrícula activa'
      const collection = txApp.findCollectionByNameOrId('enrollments')
      const next = new Record(collection)
      next.set('student', studentId)
      next.set('group', targetGroupId)
      next.set('status', 'ACTIVE')
      next.set('joined_at', now)
      next.set('ended_at', '')
      txApp.save(next)
      currentId = next.id
      moveStage = 'confirmar la transacción'
    })
  } catch {
    throw new BadRequestError(`No se ha podido mover al alumno al ${moveStage}. No se ha aplicado ningún cambio.`)
  }

  return e.json(200, { previousId: previousId || null, currentId, unchanged: false })
})

/// <reference path="../pb_data/types.d.ts" />

const GROUP_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'MIXED']
const GROUP_MODES = ['IN_PERSON', 'ONLINE', 'HYBRID']
const GROUP_STATUSES = ['ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED']

function requestBody(e) {
  const parsed = e.requestInfo().body || {}
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestError('El cuerpo de la solicitud no es válido.')
  }
  return parsed
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function readText(value, label, max, required) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) throw new BadRequestError(`${label} es obligatorio.`)
  if (text.length > max) throw new BadRequestError(`${label} supera la longitud permitida.`)
  return text
}

function readId(value, label) {
  const id = readText(value, label, 64, true)
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
  return id
}

function findCourse(app, courseId) {
  try { return app.findRecordById('courses', courseId) } catch { throw new BadRequestError('El curso no existe.') }
}

function findTeacher(app, teacherId) {
  let teacher
  try { teacher = app.findRecordById('users', teacherId) } catch { throw new BadRequestError('El profesor no existe.') }
  if (teacher.getString('role') !== 'TEACHER') throw new BadRequestError('El responsable del grupo debe tener rol de profesor.')
  return teacher
}

routerAdd('POST', '/api/language-school/admin/academic/groups/{groupId}/update', (e) => {
  if (!e.auth || e.auth.get('role') !== 'ADMIN') {
    throw new ForbiddenError('Solo Administración puede actualizar grupos y aulas.')
  }

  const groupId = readId(e.request.pathValue('groupId'), 'Grupo')
  const body = requestBody(e)
  const patch = body.patch
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new BadRequestError('Faltan los cambios del grupo.')
  }

  let teacherChanged = false
  let reassignedFutureScheduledClasses = 0
  let resultingTeacherId = ''
  let resultingCourseId = ''

  e.app.runInTransaction((txApp) => {
    let group
    try { group = txApp.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo no existe.') }

    const previousTeacherId = group.getString('teacher')
    const previousCourseId = group.getString('course')

    const nextName = own(patch, 'name') ? readText(patch.name, 'El nombre del grupo', 180, true) : group.getString('name')
    const nextCourseId = own(patch, 'course') ? readId(patch.course, 'Curso') : previousCourseId
    const nextTeacherId = own(patch, 'teacher') ? readId(patch.teacher, 'Profesor') : previousTeacherId
    const nextAcademicYear = own(patch, 'academic_year') ? readText(patch.academic_year, 'El curso académico', 80, true) : group.getString('academic_year')
    const nextSchedule = own(patch, 'schedule_text') ? readText(patch.schedule_text, 'El horario', 500, false) : group.getString('schedule_text')

    let nextCapacity = group.getInt('capacity')
    if (own(patch, 'capacity')) {
      const numeric = Number(patch.capacity)
      if (!Number.isInteger(numeric) || numeric < 1 || numeric > 500) throw new BadRequestError('La capacidad del grupo no es válida.')
      nextCapacity = numeric
    }

    const nextTargetLevel = own(patch, 'target_level') ? readText(patch.target_level, 'El nivel objetivo', 10, true).toUpperCase() : group.getString('target_level')
    if (GROUP_LEVELS.indexOf(nextTargetLevel) === -1) throw new BadRequestError('El nivel objetivo no es válido.')

    const nextMode = own(patch, 'default_delivery_mode') ? readText(patch.default_delivery_mode, 'La modalidad por defecto', 20, true).toUpperCase() : group.getString('default_delivery_mode')
    if (GROUP_MODES.indexOf(nextMode) === -1) throw new BadRequestError('La modalidad por defecto no es válida.')

    const nextStatus = own(patch, 'status') ? readText(patch.status, 'El estado del grupo', 20, true).toUpperCase() : group.getString('status')
    if (GROUP_STATUSES.indexOf(nextStatus) === -1) throw new BadRequestError('El estado del grupo no es válido.')

    const activeEnrollments = txApp.countRecords('enrollments', $dbx.hashExp({ group: groupId, status: 'ACTIVE' }))
    if (nextCapacity < activeEnrollments) {
      throw new BadRequestError(`La capacidad no puede ser inferior a las ${activeEnrollments} matrículas activas del grupo.`)
    }

    const courseChanged = nextCourseId !== previousCourseId
    teacherChanged = nextTeacherId !== previousTeacherId

    if (courseChanged) {
      const enrollmentHistory = txApp.countRecords('enrollments', $dbx.hashExp({ group: groupId }))
      const classHistory = txApp.countRecords('classes', $dbx.hashExp({ group: groupId }))
      if (enrollmentHistory > 0 || classHistory > 0) {
        throw new BadRequestError('No puedes cambiar el curso de un grupo que ya tiene matrículas o clases registradas. Crea un grupo nuevo para conservar el histórico.')
      }
    }

    const course = findCourse(txApp, nextCourseId)
    if ((courseChanged || nextStatus === 'ACTIVE') && course.getString('status') !== 'ACTIVE') {
      throw new BadRequestError('El curso del grupo debe estar activo.')
    }

    const teacher = findTeacher(txApp, nextTeacherId)
    if ((teacherChanged || nextStatus === 'ACTIVE') && teacher.getString('status') !== 'ACTIVE') {
      throw new BadRequestError('El profesor del grupo debe tener la cuenta activa.')
    }

    if (teacherChanged && typeof body.reassignFutureScheduledClasses !== 'boolean') {
      throw new BadRequestError('Indica si las clases futuras programadas deben reasignarse al nuevo profesor.')
    }

    group.set('name', nextName)
    group.set('course', nextCourseId)
    group.set('teacher', nextTeacherId)
    group.set('academic_year', nextAcademicYear)
    group.set('schedule_text', nextSchedule)
    group.set('capacity', nextCapacity)
    group.set('target_level', nextTargetLevel)
    group.set('default_delivery_mode', nextMode)
    group.set('status', nextStatus)
    txApp.save(group)

    if (teacherChanged && body.reassignFutureScheduledClasses === true) {
      const now = Date.now()
      const scheduled = txApp.findAllRecords('classes', $dbx.hashExp({ group: groupId, status: 'SCHEDULED' }))
      scheduled.forEach((classRecord) => {
        const startsAt = new Date(classRecord.getString('starts_at')).getTime()
        if (!Number.isFinite(startsAt) || startsAt < now || classRecord.getString('teacher') === nextTeacherId) return
        classRecord.set('teacher', nextTeacherId)
        txApp.save(classRecord)
        reassignedFutureScheduledClasses += 1
      })
    }

    resultingTeacherId = nextTeacherId
    resultingCourseId = nextCourseId
  })

  return e.json(200, {
    groupId,
    teacherChanged,
    teacherId: resultingTeacherId,
    courseId: resultingCourseId,
    reassignedFutureScheduledClasses,
  })
}, $apis.requireAuth('users'))

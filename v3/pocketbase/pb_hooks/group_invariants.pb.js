/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  const activeEnrollments = e.app.countRecords(
    'enrollments',
    $dbx.hashExp({ group: e.record.id, status: 'ACTIVE' }),
  )

  if (e.record.getInt('capacity') < activeEnrollments) {
    throw new BadRequestError(`La capacidad no puede ser inferior a las ${activeEnrollments} matrículas activas del grupo.`)
  }

  if (e.record.getString('status') === 'ACTIVE') {
    let course
    try { course = e.app.findRecordById('courses', e.record.getString('course')) } catch {
      throw new BadRequestError('El curso del grupo no existe.')
    }
    if (course.getString('status') !== 'ACTIVE') {
      throw new BadRequestError('Un grupo activo necesita un curso activo.')
    }

    let teacher
    try { teacher = e.app.findRecordById('users', e.record.getString('teacher')) } catch {
      throw new BadRequestError('El profesor del grupo no existe.')
    }
    if (teacher.getString('role') !== 'TEACHER') {
      throw new BadRequestError('El responsable del grupo debe tener rol de profesor.')
    }
    if (teacher.getString('status') !== 'ACTIVE') {
      throw new BadRequestError('Un grupo activo necesita un profesor activo.')
    }
  }

  e.next()
}, 'groups')

onRecordUpdateRequest((e) => {
  let current
  try { current = e.app.findRecordById('courses', e.record.id) } catch {
    throw new BadRequestError('El curso no existe.')
  }

  if (current.getString('status') === 'ACTIVE' && e.record.getString('status') !== 'ACTIVE') {
    const activeGroups = e.app.countRecords(
      'groups',
      $dbx.hashExp({ course: e.record.id, status: 'ACTIVE' }),
    )
    if (activeGroups > 0) {
      throw new BadRequestError(`No puedes archivar o pausar este curso mientras tenga ${activeGroups} grupos activos.`)
    }
  }

  e.next()
}, 'courses')

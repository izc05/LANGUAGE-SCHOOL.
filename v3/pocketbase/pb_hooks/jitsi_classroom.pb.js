/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/language-school/jitsi/classes/{classId}/room', (e) => {
  function canManage(auth, record) {
    if (!auth) return false
    const role = auth.getString('role')
    return role === 'ADMIN' || (role === 'TEACHER' && record.getString('teacher') === auth.id)
  }
  function assertAvailable(record) {
    if (record.getString('status') !== 'SCHEDULED') throw new BadRequestError('Solo se pueden abrir aulas de clases programadas.')
    const mode = record.getString('delivery_mode') || 'IN_PERSON'
    if (mode !== 'ONLINE' && mode !== 'HYBRID') throw new BadRequestError('Esta clase no tiene aula online.')
  }

  const classId = String(e.request.pathValue('classId') || '').trim()
  if (!classId) throw new BadRequestError('Falta la clase para preparar Jitsi.')
  const classRecord = e.app.findRecordById('classes', classId)
  if (!canManage(e.auth, classRecord)) throw new ForbiddenError('Solo Administración o el profesor de la clase pueden preparar Jitsi.')
  assertAvailable(classRecord)

  const currentRoom = classRecord.getString('meeting_room')
  if (classRecord.getString('video_provider') === 'JITSI' && /^[A-Za-z0-9_-]{24,180}$/.test(currentRoom)) {
    return e.json(200, { provider: 'jitsi', existing: true, roomName: currentRoom, joinUrl: 'https://meet.jit.si/' + encodeURIComponent(currentRoom) })
  }
  const token = $security.randomString(40).replace(/[^A-Za-z0-9]/g, '')
  if (token.length < 24) throw new InternalServerError('No se ha podido generar una sala segura.')
  const roomName = 'ls-' + classId + '-' + token
  const joinUrl = 'https://meet.jit.si/' + encodeURIComponent(roomName)
  classRecord.set('video_provider', 'JITSI')
  classRecord.set('meeting_room', roomName)
  classRecord.set('online_join_url', joinUrl)
  e.app.save(classRecord)
  return e.json(201, { provider: 'jitsi', existing: false, roomName, joinUrl })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/jitsi/classes/{classId}/join', (e) => {
  function canManage(auth, record) {
    if (!auth) return false
    const role = auth.getString('role')
    return role === 'ADMIN' || (role === 'TEACHER' && record.getString('teacher') === auth.id)
  }
  function assertAvailable(record) {
    if (record.getString('status') !== 'SCHEDULED') throw new BadRequestError('Solo se pueden abrir aulas de clases programadas.')
    const mode = record.getString('delivery_mode') || 'IN_PERSON'
    if (mode !== 'ONLINE' && mode !== 'HYBRID') throw new BadRequestError('Esta clase no tiene aula online.')
  }
  function hasActiveEnrollment(app, studentId, groupId) {
    try {
      app.findFirstRecordByFilter(
        'enrollments',
        'student = {:student} && group = {:group} && status = "ACTIVE"',
        { student: studentId, group: groupId },
      )
      return true
    } catch (_) {
      return false
    }
  }
  function displayName(user, fallback) {
    return [user.getString('name'), user.getString('surname')].filter(Boolean).join(' ').trim() || fallback
  }

  const classId = String(e.request.pathValue('classId') || '').trim()
  if (!classId) throw new BadRequestError('Falta la clase que se quiere abrir.')
  const classRecord = e.app.findRecordById('classes', classId)
  assertAvailable(classRecord)
  if (classRecord.getString('video_provider') !== 'JITSI') throw new BadRequestError('Esta clase no utiliza Jitsi.')

  const role = e.auth ? e.auth.getString('role') : ''
  if (role === 'STUDENT') {
    if (!hasActiveEnrollment(e.app, e.auth.id, classRecord.getString('group'))) throw new ForbiddenError('No tienes una matrícula activa para esta clase.')
  } else if (!canManage(e.auth, classRecord)) {
    throw new ForbiddenError('No tienes acceso a esta aula Jitsi.')
  }
  const roomName = classRecord.getString('meeting_room')
  if (!/^[A-Za-z0-9_-]{24,180}$/.test(roomName)) return e.json(409, { provider: 'jitsi', authorized: false, reason: 'room_not_ready', message: 'El aula Jitsi todavía no está preparada.' })
  return e.json(200, { provider: 'jitsi', authorized: true, domain: 'meet.jit.si', roomName, displayName: displayName(e.auth, role === 'TEACHER' ? 'Profesor Language School' : 'Alumno Language School'), userRole: role.toLowerCase() })
}, $apis.requireAuth('users'))

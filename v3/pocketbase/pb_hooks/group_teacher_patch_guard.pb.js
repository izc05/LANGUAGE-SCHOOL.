/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('El cuerpo de la solicitud no es válido.')
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'teacher')) return e.next()

  let current
  try { current = e.app.findRecordById('groups', e.record.id) } catch {
    throw new BadRequestError('El grupo no existe.')
  }

  if (current.getString('teacher') !== e.record.getString('teacher')) {
    throw new BadRequestError('Para cambiar el profesor usa la gestión de Grupo/Aula y confirma qué hacer con las clases futuras.')
  }

  e.next()
}, 'groups')

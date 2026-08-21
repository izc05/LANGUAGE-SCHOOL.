/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth || auth.collection().name !== 'users' || auth.getString('role') !== 'ADMIN') return e.next()

  let current
  try { current = e.app.findRecordById('users', e.record.id) } catch { throw new BadRequestError('La cuenta no existe.') }
  const role = current.getString('role')
  if (role !== 'STUDENT' && role !== 'TEACHER') return e.next()

  const body = e.requestInfo().body || {}
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(body, key)

  if (hasOwn('password') || hasOwn('passwordConfirm') || hasOwn('oldPassword') || hasOwn('verified')) {
    throw new BadRequestError('Administración no puede establecer ni sustituir credenciales de alumnos o profesores.')
  }

  if (current.getString('status') === 'INVITED' && hasOwn('status') && e.record.getString('status') !== 'INVITED') {
    throw new BadRequestError('La cuenta invitada debe activarse desde su enlace seguro para que el titular elija la contraseña.')
  }

  e.next()
}, 'users')

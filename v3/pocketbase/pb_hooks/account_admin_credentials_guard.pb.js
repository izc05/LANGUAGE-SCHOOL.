/// <reference path="../pb_data/types.d.ts" />

onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (!auth || auth.collection().name !== 'users' || auth.getString('role') !== 'ADMIN') return e.next()

  let current
  try { current = e.app.findRecordById('users', e.record.id) } catch { throw new BadRequestError('La cuenta no existe.') }

  const role = current.getString('role')
  const body = e.requestInfo().body || {}
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(body, key)
  const touchesCredentials = hasOwn('password') || hasOwn('passwordConfirm') || hasOwn('oldPassword') || hasOwn('verified')

  if ((role === 'STUDENT' || role === 'TEACHER') && touchesCredentials) {
    throw new BadRequestError('Administración no puede establecer ni sustituir credenciales de alumnos o profesores.')
  }

  if (role === 'ADMIN') {
    if (current.id !== auth.id) {
      throw new ForbiddenError('Un administrador no puede modificar otra cuenta de administrador desde la API general.')
    }

    const touchesOwnAdminSecurity = touchesCredentials || hasOwn('email') || hasOwn('status')
    if (touchesOwnAdminSecurity) {
      throw new BadRequestError('Las credenciales, el email y el estado de tu cuenta ADMIN deben gestionarse mediante los flujos de seguridad dedicados.')
    }
  }

  if (current.getString('status') === 'INVITED' && hasOwn('status') && e.record.getString('status') !== 'INVITED') {
    throw new BadRequestError('La cuenta invitada debe activarse desde su enlace seguro para que el titular elija la contraseña.')
  }

  e.next()
}, 'users')

onRecordDeleteRequest((e) => {
  const auth = e.auth
  if (!auth || auth.collection().name !== 'users' || auth.getString('role') !== 'ADMIN') return e.next()
  if (e.record.getString('role') === 'ADMIN') {
    throw new ForbiddenError('Las cuentas de administrador no se eliminan desde la API general. Usa un flujo administrativo seguro y auditable.')
  }
  e.next()
}, 'users')

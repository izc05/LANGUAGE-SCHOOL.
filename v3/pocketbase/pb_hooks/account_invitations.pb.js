/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/language-school/admin/accounts/invite', (e) => {
  const INVITATION_HOURS = 48
  function text(value) { return typeof value === 'string' ? value.trim() : '' }
  function body() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    return parsed
  }
  function requireAdmin() {
    if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') {
      throw new ForbiddenError('Solo Administración puede gestionar invitaciones.')
    }
  }
  function readEmail(value) {
    const email = text(value).toLowerCase()
    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError('Indica un email válido.')
    return email
  }
  function readRole(value) {
    const role = text(value).toUpperCase()
    if (role !== 'STUDENT' && role !== 'TEACHER' && role !== 'ADMIN') throw new BadRequestError('El rol de la invitación no es válido.')
    return role
  }
  function readBase(value) {
    const base = text(value).replace(/\/+$/, '')
    if (!base) return ''
    if (!/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(base)) throw new BadRequestError('La URL base de activación no es válida.')
    return base
  }
  function issue(app, userId, createdBy) {
    const pending = app.findAllRecords('account_invitations', $dbx.hashExp({ user: userId, status: 'PENDING' }))
    const now = new Date().toISOString()
    pending.forEach((record) => {
      record.set('status', 'REVOKED')
      record.set('revoked_at', now)
      app.save(record)
    })
    const token = $security.randomString(48)
    const collection = app.findCollectionByNameOrId('account_invitations')
    const invitation = new Record(collection)
    invitation.set('user', userId)
    invitation.set('token_hash', $security.sha256(token))
    invitation.set('status', 'PENDING')
    invitation.set('expires_at', new Date(Date.now() + INVITATION_HOURS * 60 * 60 * 1000).toISOString())
    invitation.set('created_by', createdBy)
    invitation.set('sent_at', '')
    invitation.set('used_at', '')
    invitation.set('revoked_at', '')
    app.save(invitation)
    return { invitation, token }
  }
  function createAccount(app, role, data) {
    const name = text(data.name)
    const surname = text(data.surname)
    const email = readEmail(data.email)
    const phone = text(data.phone)
    if (!name || !surname || name.length > 100 || surname.length > 120 || phone.length > 30) throw new BadRequestError('Revisa los datos básicos de la cuenta.')

    const user = new Record(app.findCollectionByNameOrId('users'))
    user.setEmail(email)
    user.setRandomPassword()
    user.set('name', name)
    user.set('surname', surname)
    user.set('role', role)
    user.set('status', 'INVITED')
    user.set('verified', false)
    user.set('phone', phone)
    app.save(user)

    if (role === 'STUDENT') {
      const profile = new Record(app.findCollectionByNameOrId('student_profiles'))
      profile.set('user', user.id)
      profile.set('birth_date', text(data.birthDate))
      profile.set('guardian_name', text(data.guardianName))
      profile.set('guardian_phone', text(data.guardianPhone))
      profile.set('notes_private', text(data.notesPrivate))
      profile.set('active', false)
      app.save(profile)
    } else if (role === 'TEACHER') {
      const profile = new Record(app.findCollectionByNameOrId('teacher_profiles'))
      profile.set('user', user.id)
      profile.set('bio', text(data.bio))
      profile.set('specialties', Array.isArray(data.specialties) ? data.specialties.slice(0, 30) : [])
      profile.set('public_profile', data.publicProfile === true)
      profile.set('active', false)
      app.save(profile)
    }
    return user
  }
  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  }
  function trySend(app, user, invitation, activationUrl) {
    if (!activationUrl) return false
    try {
      const settings = app.settings()
      app.newMailClient().send(new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: [{ address: user.getString('email') }],
        subject: 'Activa tu cuenta · Language School',
        html: `<p>Hola ${escapeHtml(user.getString('name'))},</p><p>Tu cuenta de Language School está preparada.</p><p><a href="${escapeHtml(activationUrl)}">Crear mi contraseña y activar la cuenta</a></p><p>Este enlace es de un solo uso y caduca en ${INVITATION_HOURS} horas.</p><p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>`,
      }))
      invitation.set('sent_at', new Date().toISOString())
      app.save(invitation)
      return true
    } catch (_) {
      return false
    }
  }

  requireAdmin()
  const data = body()
  const role = readRole(data.role)
  const activationBaseUrl = readBase(data.activationBaseUrl)
  let userId = ''
  let invitationId = ''
  let rawToken = ''
  let expiresAt = ''

  e.app.runInTransaction((txApp) => {
    const user = createAccount(txApp, role, data)
    const issued = issue(txApp, user.id, e.auth.id)
    userId = user.id
    invitationId = issued.invitation.id
    rawToken = issued.token
    expiresAt = issued.invitation.getString('expires_at')
  })

  const user = e.app.findRecordById('users', userId)
  const invitation = e.app.findRecordById('account_invitations', invitationId)
  const activationUrl = activationBaseUrl ? `${activationBaseUrl}/activar-cuenta?token=${encodeURIComponent(rawToken)}` : ''
  const emailSent = trySend(e.app, user, invitation, activationUrl)
  const responseActivationUrl = role === 'ADMIN' ? '' : activationUrl
  return e.json(201, { userId, invitationId, role, status: 'PENDING', expiresAt, activationUrl: responseActivationUrl, emailSent })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/admin/accounts/invite/resend', (e) => {
  const INVITATION_HOURS = 48
  function text(value) { return typeof value === 'string' ? value.trim() : '' }
  function body() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    return parsed
  }
  function requireAdmin() {
    if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') throw new ForbiddenError('Solo Administración puede gestionar invitaciones.')
  }
  function readId(value) {
    const id = text(value)
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError('Cuenta no válida.')
    return id
  }
  function readBase(value) {
    const base = text(value).replace(/\/+$/, '')
    if (!base) return ''
    if (!/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(base)) throw new BadRequestError('La URL base de activación no es válida.')
    return base
  }
  function issue(app, userId, createdBy) {
    const pending = app.findAllRecords('account_invitations', $dbx.hashExp({ user: userId, status: 'PENDING' }))
    const now = new Date().toISOString()
    pending.forEach((record) => {
      record.set('status', 'REVOKED')
      record.set('revoked_at', now)
      app.save(record)
    })
    const token = $security.randomString(48)
    const invitation = new Record(app.findCollectionByNameOrId('account_invitations'))
    invitation.set('user', userId)
    invitation.set('token_hash', $security.sha256(token))
    invitation.set('status', 'PENDING')
    invitation.set('expires_at', new Date(Date.now() + INVITATION_HOURS * 60 * 60 * 1000).toISOString())
    invitation.set('created_by', createdBy)
    invitation.set('sent_at', '')
    invitation.set('used_at', '')
    invitation.set('revoked_at', '')
    app.save(invitation)
    return { invitation, token }
  }
  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
  }
  function trySend(app, user, invitation, activationUrl) {
    if (!activationUrl) return false
    try {
      const settings = app.settings()
      app.newMailClient().send(new MailerMessage({
        from: { address: settings.meta.senderAddress, name: settings.meta.senderName },
        to: [{ address: user.getString('email') }],
        subject: 'Activa tu cuenta · Language School',
        html: `<p>Hola ${escapeHtml(user.getString('name'))},</p><p>Tu nueva invitación de Language School está preparada.</p><p><a href="${escapeHtml(activationUrl)}">Crear mi contraseña y activar la cuenta</a></p><p>Este enlace es de un solo uso y caduca en ${INVITATION_HOURS} horas.</p>`,
      }))
      invitation.set('sent_at', new Date().toISOString())
      app.save(invitation)
      return true
    } catch (_) { return false }
  }

  requireAdmin()
  const data = body()
  const userId = readId(data.userId)
  const activationBaseUrl = readBase(data.activationBaseUrl)
  let invitationId = ''
  let rawToken = ''
  let expiresAt = ''
  let accountRole = ''

  e.app.runInTransaction((txApp) => {
    const user = txApp.findRecordById('users', userId)
    const role = user.getString('role')
    if (role !== 'STUDENT' && role !== 'TEACHER' && role !== 'ADMIN') throw new BadRequestError('La cuenta no admite invitaciones.')
    if (user.getString('status') !== 'INVITED') throw new BadRequestError('La cuenta ya no está pendiente de activación.')
    const issued = issue(txApp, userId, e.auth.id)
    invitationId = issued.invitation.id
    rawToken = issued.token
    expiresAt = issued.invitation.getString('expires_at')
    accountRole = role
  })

  const user = e.app.findRecordById('users', userId)
  const invitation = e.app.findRecordById('account_invitations', invitationId)
  const activationUrl = activationBaseUrl ? `${activationBaseUrl}/activar-cuenta?token=${encodeURIComponent(rawToken)}` : ''
  const emailSent = trySend(e.app, user, invitation, activationUrl)
  const responseActivationUrl = accountRole === 'ADMIN' ? '' : activationUrl
  return e.json(200, { userId, invitationId, status: 'PENDING', expiresAt, activationUrl: responseActivationUrl, emailSent })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/admin/accounts/invite/revoke', (e) => {
  function text(value) { return typeof value === 'string' ? value.trim() : '' }
  function body() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    return parsed
  }
  function requireAdmin() {
    if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') throw new ForbiddenError('Solo Administración puede gestionar invitaciones.')
  }
  function readId(value) {
    const id = text(value)
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError('Cuenta no válida.')
    return id
  }

  requireAdmin()
  const userId = readId(body().userId)
  const user = e.app.findRecordById('users', userId)
  if (user.getString('status') !== 'INVITED') throw new BadRequestError('La cuenta ya no está pendiente de activación.')
  const now = new Date().toISOString()
  const pending = e.app.findAllRecords('account_invitations', $dbx.hashExp({ user: userId, status: 'PENDING' }))
  pending.forEach((record) => {
    record.set('status', 'REVOKED')
    record.set('revoked_at', now)
    e.app.save(record)
  })
  return e.json(200, { userId, status: 'REVOKED' })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/admin/accounts/invite/status', (e) => {
  function text(value) { return typeof value === 'string' ? value.trim() : '' }
  function body() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    return parsed
  }
  function requireAdmin() {
    if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') throw new ForbiddenError('Solo Administración puede gestionar invitaciones.')
  }
  function readId(value) {
    const id = text(value)
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError('Cuenta no válida.')
    return id
  }

  requireAdmin()
  const userId = readId(body().userId)
  const user = e.app.findRecordById('users', userId)
  const records = e.app.findRecordsByFilter('account_invitations', `user = "${userId}"`, '-created', 1, 0)
  if (!records.length) return e.json(200, { userId, accountStatus: user.getString('status'), invitationStatus: 'NONE' })

  const invitation = records[0]
  let invitationStatus = invitation.getString('status')
  if (invitationStatus === 'PENDING') {
    const expires = new Date(invitation.getString('expires_at')).getTime()
    if (!Number.isFinite(expires) || expires <= Date.now()) invitationStatus = 'EXPIRED'
  }
  return e.json(200, {
    userId,
    accountStatus: user.getString('status'),
    invitationStatus,
    invitationId: invitation.id,
    expiresAt: invitation.getString('expires_at'),
    sentAt: invitation.getString('sent_at') || null,
    usedAt: invitation.getString('used_at') || null,
    revokedAt: invitation.getString('revoked_at') || null,
  })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/account/activate', (e) => {
  function text(value) { return typeof value === 'string' ? value.trim() : '' }
  function body() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    return parsed
  }

  const data = body()
  const token = text(data.token)
  const password = text(data.password)
  const passwordConfirm = text(data.passwordConfirm)
  if (!/^[A-Za-z0-9]{40,100}$/.test(token)) throw new BadRequestError('La invitación no es válida.')
  if (password.length < 8) throw new BadRequestError('La contraseña debe tener al menos 8 caracteres.')
  if (password !== passwordConfirm) throw new BadRequestError('Las contraseñas no coinciden.')

  const tokenHash = $security.sha256(token)
  const records = e.app.findRecordsByFilter('account_invitations', `token_hash = "${tokenHash}" && status = "PENDING"`, '', 1, 0)
  if (!records.length) throw new BadRequestError('La invitación no es válida, ya se utilizó o fue revocada.')
  const initial = records[0]
  const expires = new Date(initial.getString('expires_at')).getTime()
  if (!Number.isFinite(expires) || expires <= Date.now()) throw new BadRequestError('La invitación ha caducado. Solicita una nueva a la academia.')

  const invitationId = initial.id
  const userId = initial.getString('user')
  const now = new Date().toISOString()
  e.app.runInTransaction((txApp) => {
    const invitation = txApp.findRecordById('account_invitations', invitationId)
    if (invitation.getString('status') !== 'PENDING') throw new BadRequestError('La invitación ya no está disponible.')
    const txExpires = new Date(invitation.getString('expires_at')).getTime()
    if (!Number.isFinite(txExpires) || txExpires <= Date.now()) throw new BadRequestError('La invitación ha caducado. Solicita una nueva a la academia.')
    const user = txApp.findRecordById('users', userId)
    if (user.getString('status') !== 'INVITED') throw new BadRequestError('La cuenta ya no está pendiente de activación.')
    user.setPassword(password)
    user.set('verified', true)
    user.set('status', 'ACTIVE')
    txApp.save(user)
    invitation.set('status', 'USED')
    invitation.set('used_at', now)
    txApp.save(invitation)
  })
  return e.json(200, { success: true, userId })
})

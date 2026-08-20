/// <reference path="../pb_data/types.d.ts" />

const ACCOUNT_INVITATION_HOURS = 48

function invitationReadText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function invitationReadBody(e) {
  const body = e.requestInfo().body || {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new BadRequestError('El cuerpo de la solicitud no es válido.')
  }
  return body
}

function invitationRequireAdmin(e) {
  if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') {
    throw new ForbiddenError('Solo Administración puede gestionar invitaciones.')
  }
}

function invitationReadId(value, label) {
  const id = invitationReadText(value)
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
  return id
}

function invitationReadEmail(value) {
  const email = invitationReadText(value).toLowerCase()
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestError('Indica un email válido.')
  }
  return email
}

function invitationReadRole(value) {
  const role = invitationReadText(value).toUpperCase()
  if (role !== 'STUDENT' && role !== 'TEACHER') {
    throw new BadRequestError('El rol de la invitación no es válido.')
  }
  return role
}

function invitationActivationBase(value) {
  const base = invitationReadText(value).replace(/\/+$/, '')
  if (!base) return ''
  if (!/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(base)) {
    throw new BadRequestError('La URL base de activación no es válida.')
  }
  return base
}

function invitationLink(base, token) {
  if (!base) return ''
  return `${base}/activar-cuenta?token=${encodeURIComponent(token)}`
}

function invitationEscapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function invitationExpiresAt() {
  return new Date(Date.now() + ACCOUNT_INVITATION_HOURS * 60 * 60 * 1000).toISOString()
}

function invitationIssue(app, userId, createdBy) {
  const pending = app.findAllRecords(
    'account_invitations',
    $dbx.hashExp({ user: userId, status: 'PENDING' }),
  )
  const now = new Date().toISOString()
  pending.forEach((record) => {
    record.set('status', 'REVOKED')
    record.set('revoked_at', now)
    app.save(record)
  })

  const token = $security.randomString(48)
  const tokenHash = $security.sha256(token)
  const collection = app.findCollectionByNameOrId('account_invitations')
  const invitation = new Record(collection)
  invitation.set('user', userId)
  invitation.set('token_hash', tokenHash)
  invitation.set('status', 'PENDING')
  invitation.set('expires_at', invitationExpiresAt())
  invitation.set('created_by', createdBy)
  invitation.set('sent_at', '')
  invitation.set('used_at', '')
  invitation.set('revoked_at', '')
  app.save(invitation)

  return { invitation, token }
}

function invitationTrySend(app, user, invitation, activationUrl) {
  if (!activationUrl) return false

  try {
    const settings = app.settings()
    const message = new MailerMessage({
      from: {
        address: settings.meta.senderAddress,
        name: settings.meta.senderName,
      },
      to: [{ address: user.getString('email') }],
      subject: 'Activa tu cuenta · Language School',
      html: `
        <p>Hola ${invitationEscapeHtml(user.getString('name'))},</p>
        <p>Tu cuenta de Language School está preparada.</p>
        <p><a href="${invitationEscapeHtml(activationUrl)}">Crear mi contraseña y activar la cuenta</a></p>
        <p>Este enlace es de un solo uso y caduca en ${ACCOUNT_INVITATION_HOURS} horas.</p>
        <p>Si no esperabas esta invitación, puedes ignorar este mensaje.</p>
      `,
    })
    app.newMailClient().send(message)
    invitation.set('sent_at', new Date().toISOString())
    app.save(invitation)
    return true
  } catch (_) {
    // SMTP/sendmail can be unavailable during local setup. The endpoint still
    // returns the one-time link to the authenticated Admin as the safe fallback.
    return false
  }
}

function invitationCreateAccount(txApp, role, body) {
  const name = invitationReadText(body.name)
  const surname = invitationReadText(body.surname)
  const email = invitationReadEmail(body.email)
  const phone = invitationReadText(body.phone)
  if (!name || !surname || name.length > 100 || surname.length > 120 || phone.length > 30) {
    throw new BadRequestError('Revisa los datos básicos de la cuenta.')
  }

  const users = txApp.findCollectionByNameOrId('users')
  const user = new Record(users)
  user.setEmail(email)
  user.setRandomPassword()
  user.set('name', name)
  user.set('surname', surname)
  user.set('role', role)
  user.set('status', 'INVITED')
  user.set('verified', false)
  user.set('phone', phone)
  txApp.save(user)

  if (role === 'STUDENT') {
    const profileCollection = txApp.findCollectionByNameOrId('student_profiles')
    const profile = new Record(profileCollection)
    profile.set('user', user.id)
    profile.set('birth_date', invitationReadText(body.birthDate))
    profile.set('guardian_name', invitationReadText(body.guardianName))
    profile.set('guardian_phone', invitationReadText(body.guardianPhone))
    profile.set('notes_private', invitationReadText(body.notesPrivate))
    profile.set('active', false)
    txApp.save(profile)
  } else {
    const profileCollection = txApp.findCollectionByNameOrId('teacher_profiles')
    const profile = new Record(profileCollection)
    profile.set('user', user.id)
    profile.set('bio', invitationReadText(body.bio))
    profile.set('specialties', Array.isArray(body.specialties) ? body.specialties.slice(0, 30) : [])
    profile.set('public_profile', body.publicProfile === true)
    profile.set('active', false)
    txApp.save(profile)
  }

  return user
}

routerAdd('POST', '/api/language-school/admin/accounts/invite', (e) => {
  invitationRequireAdmin(e)
  const body = invitationReadBody(e)
  const role = invitationReadRole(body.role)
  const activationBaseUrl = invitationActivationBase(body.activationBaseUrl)

  let userId = ''
  let invitationId = ''
  let rawToken = ''
  let expiresAt = ''

  e.app.runInTransaction((txApp) => {
    const user = invitationCreateAccount(txApp, role, body)
    const issued = invitationIssue(txApp, user.id, e.auth.id)
    userId = user.id
    invitationId = issued.invitation.id
    rawToken = issued.token
    expiresAt = issued.invitation.getString('expires_at')
  })

  const user = e.app.findRecordById('users', userId)
  const invitation = e.app.findRecordById('account_invitations', invitationId)
  const activationUrl = invitationLink(activationBaseUrl, rawToken)
  const emailSent = invitationTrySend(e.app, user, invitation, activationUrl)

  return e.json(201, {
    userId,
    invitationId,
    role,
    status: 'PENDING',
    expiresAt,
    activationUrl,
    emailSent,
  })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/admin/accounts/invite/resend', (e) => {
  invitationRequireAdmin(e)
  const body = invitationReadBody(e)
  const userId = invitationReadId(body.userId, 'Cuenta')
  const activationBaseUrl = invitationActivationBase(body.activationBaseUrl)

  let invitationId = ''
  let rawToken = ''
  let expiresAt = ''
  e.app.runInTransaction((txApp) => {
    const user = txApp.findRecordById('users', userId)
    if (user.getString('role') !== 'STUDENT' && user.getString('role') !== 'TEACHER') {
      throw new BadRequestError('Solo se pueden invitar alumnos y profesores.')
    }
    if (user.getString('status') !== 'INVITED') {
      throw new BadRequestError('La cuenta ya no está pendiente de activación.')
    }
    const issued = invitationIssue(txApp, userId, e.auth.id)
    invitationId = issued.invitation.id
    rawToken = issued.token
    expiresAt = issued.invitation.getString('expires_at')
  })

  const user = e.app.findRecordById('users', userId)
  const invitation = e.app.findRecordById('account_invitations', invitationId)
  const activationUrl = invitationLink(activationBaseUrl, rawToken)
  const emailSent = invitationTrySend(e.app, user, invitation, activationUrl)

  return e.json(200, {
    userId,
    invitationId,
    status: 'PENDING',
    expiresAt,
    activationUrl,
    emailSent,
  })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/admin/accounts/invite/revoke', (e) => {
  invitationRequireAdmin(e)
  const body = invitationReadBody(e)
  const userId = invitationReadId(body.userId, 'Cuenta')
  const now = new Date().toISOString()

  const user = e.app.findRecordById('users', userId)
  if (user.getString('status') !== 'INVITED') {
    throw new BadRequestError('La cuenta ya no está pendiente de activación.')
  }

  const pending = e.app.findAllRecords(
    'account_invitations',
    $dbx.hashExp({ user: userId, status: 'PENDING' }),
  )
  pending.forEach((record) => {
    record.set('status', 'REVOKED')
    record.set('revoked_at', now)
    e.app.save(record)
  })

  return e.json(200, { userId, status: 'REVOKED' })
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/admin/accounts/invite/status', (e) => {
  invitationRequireAdmin(e)
  const body = invitationReadBody(e)
  const userId = invitationReadId(body.userId, 'Cuenta')
  const user = e.app.findRecordById('users', userId)

  const records = e.app.findRecordsByFilter(
    'account_invitations',
    `user = "${userId}"`,
    '-created',
    1,
    0,
  )
  if (!records.length) {
    return e.json(200, { userId, accountStatus: user.getString('status'), invitationStatus: 'NONE' })
  }

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
  const body = invitationReadBody(e)
  const token = invitationReadText(body.token)
  const password = invitationReadText(body.password)
  const passwordConfirm = invitationReadText(body.passwordConfirm)

  if (!/^[A-Za-z0-9]{40,100}$/.test(token)) throw new BadRequestError('La invitación no es válida.')
  if (password.length < 8) throw new BadRequestError('La contraseña debe tener al menos 8 caracteres.')
  if (password !== passwordConfirm) throw new BadRequestError('Las contraseñas no coinciden.')

  const tokenHash = $security.sha256(token)
  const records = e.app.findRecordsByFilter(
    'account_invitations',
    `token_hash = "${tokenHash}" && status = "PENDING"`,
    '',
    1,
    0,
  )
  if (!records.length) throw new BadRequestError('La invitación no es válida, ya se utilizó o fue revocada.')

  const initial = records[0]
  const expires = new Date(initial.getString('expires_at')).getTime()
  if (!Number.isFinite(expires) || expires <= Date.now()) {
    throw new BadRequestError('La invitación ha caducado. Solicita una nueva a la academia.')
  }

  const invitationId = initial.id
  const userId = initial.getString('user')
  const now = new Date().toISOString()

  e.app.runInTransaction((txApp) => {
    const invitation = txApp.findRecordById('account_invitations', invitationId)
    if (invitation.getString('status') !== 'PENDING') {
      throw new BadRequestError('La invitación ya no está disponible.')
    }
    const txExpires = new Date(invitation.getString('expires_at')).getTime()
    if (!Number.isFinite(txExpires) || txExpires <= Date.now()) {
      throw new BadRequestError('La invitación ha caducado. Solicita una nueva a la academia.')
    }

    const user = txApp.findRecordById('users', userId)
    if (user.getString('status') !== 'INVITED') {
      throw new BadRequestError('La cuenta ya no está pendiente de activación.')
    }

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

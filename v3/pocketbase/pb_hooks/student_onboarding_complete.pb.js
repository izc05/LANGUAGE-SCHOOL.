/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/language-school/admin/student-onboarding/complete', (e) => {
  const INVITATION_HOURS = 48
  const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

  function text(value) { return typeof value === 'string' ? value.trim() : '' }
  function body() {
    const parsed = e.requestInfo().body || {}
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('El cuerpo de la solicitud no es válido.')
    return parsed
  }
  function requireAdmin() {
    if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') {
      throw new ForbiddenError('Solo Administración puede completar el alta de alumnos.')
    }
  }
  function readId(value, label) {
    const id = text(value)
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new BadRequestError(`${label} no válido.`)
    return id
  }
  function readEmail(value) {
    const email = text(value).toLowerCase()
    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestError('Indica un email válido.')
    return email
  }
  function readBase(value) {
    const base = text(value).replace(/\/+$/, '')
    if (!base) return ''
    if (!/^https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/.*)?$/.test(base)) throw new BadRequestError('La URL base de activación no es válida.')
    return base
  }
  function readLevelMode(value) {
    const mode = text(value).toUpperCase()
    if (mode !== 'UNEVALUATED' && mode !== 'TEST' && mode !== 'INITIAL') throw new BadRequestError('El modo de nivel no es válido.')
    return mode
  }
  function readInitialLevel(mode, value) {
    if (mode !== 'INITIAL') return ''
    const level = text(value).toUpperCase()
    if (!CEFR_LEVELS.includes(level)) throw new BadRequestError('Selecciona un nivel inicial A1–C2 válido.')
    return level
  }
  function resolveGroup(app, groupId, expectedCourseId) {
    let group
    try { group = app.findRecordById('groups', groupId) } catch { throw new BadRequestError('El grupo no existe.') }
    if (group.getString('status') !== 'ACTIVE') throw new BadRequestError('El grupo debe estar activo.')
    if (group.getString('course') !== expectedCourseId) throw new BadRequestError('El grupo ya no pertenece al curso seleccionado. Revisa el alta antes de continuar.')

    let course
    try { course = app.findRecordById('courses', group.getString('course')) } catch { throw new BadRequestError('El curso del grupo no existe.') }
    if (course.getString('status') !== 'ACTIVE') throw new BadRequestError('El curso del grupo debe estar activo.')

    let teacher
    try { teacher = app.findRecordById('users', group.getString('teacher')) } catch { throw new BadRequestError('El profesor del grupo no existe.') }
    if (teacher.getString('role') !== 'TEACHER' || teacher.getString('status') !== 'ACTIVE') {
      throw new BadRequestError('El profesor responsable del grupo debe estar activo.')
    }
    return { group, course, teacher }
  }
  function createStudent(app, data, email) {
    const name = text(data.name)
    const surname = text(data.surname)
    const phone = text(data.phone)
    if (!name || !surname || name.length > 100 || surname.length > 120 || phone.length > 30) throw new BadRequestError('Revisa los datos básicos del alumno.')

    const user = new Record(app.findCollectionByNameOrId('users'))
    user.setEmail(email)
    user.setRandomPassword()
    user.set('name', name)
    user.set('surname', surname)
    user.set('role', 'STUDENT')
    user.set('status', 'INVITED')
    user.set('verified', false)
    user.set('phone', phone)
    app.save(user)

    const profile = new Record(app.findCollectionByNameOrId('student_profiles'))
    profile.set('user', user.id)
    profile.set('birth_date', text(data.birthDate))
    profile.set('guardian_name', text(data.guardianName))
    profile.set('guardian_phone', text(data.guardianPhone))
    profile.set('notes_private', text(data.notesPrivate))
    profile.set('active', false)
    app.save(profile)
    return { user, profile }
  }
  function createInitialAssessment(app, studentId, level, notes) {
    if (!level) return null
    const assessment = new Record(app.findCollectionByNameOrId('student_level_assessments'))
    assessment.set('student', studentId)
    assessment.set('source_attempt', '')
    assessment.set('automatic_level', '')
    assessment.set('speaking_level', '')
    assessment.set('validated_level', level)
    assessment.set('notes', text(notes))
    assessment.set('assessed_by', e.auth.id)
    assessment.set('assessed_at', new Date().toISOString())
    assessment.set('reason', 'INITIAL')
    app.save(assessment)
    return assessment
  }
  function issueInvitation(app, userId) {
    const token = $security.randomString(48)
    const invitation = new Record(app.findCollectionByNameOrId('account_invitations'))
    invitation.set('user', userId)
    invitation.set('token_hash', $security.sha256(token))
    invitation.set('status', 'PENDING')
    invitation.set('expires_at', new Date(Date.now() + INVITATION_HOURS * 60 * 60 * 1000).toISOString())
    invitation.set('created_by', e.auth.id)
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
  const email = readEmail(data.email)
  const targetGroupId = readId(data.targetGroupId, 'Grupo')
  const expectedCourseId = readId(data.expectedCourseId, 'Curso')
  const levelMode = readLevelMode(data.levelMode)
  const initialLevel = readInitialLevel(levelMode, data.initialLevel)
  const acknowledgeLevelMismatch = data.acknowledgeLevelMismatch === true
  const activationBaseUrl = readBase(e.app.settings().meta.appURL || '')

  let userId = ''
  let profileId = ''
  let assessmentId = ''
  let enrollmentId = ''
  let invitationId = ''
  let rawToken = ''
  let expiresAt = ''
  let targetLevel = ''
  let courseId = ''
  let teacherId = ''
  let levelMismatch = false

  e.app.runInTransaction((txApp) => {
    const resolved = resolveGroup(txApp, targetGroupId, expectedCourseId)
    targetLevel = resolved.group.getString('target_level')
    courseId = resolved.course.id
    teacherId = resolved.teacher.id
    levelMismatch = Boolean(initialLevel && targetLevel && targetLevel !== 'MIXED' && initialLevel !== targetLevel)
    if (levelMismatch && !acknowledgeLevelMismatch) {
      throw new BadRequestError(`El nivel inicial del alumno (${initialLevel}) no coincide con el nivel objetivo del grupo (${targetLevel}). Confirma expresamente la asignación para continuar.`)
    }

    const created = createStudent(txApp, data, email)
    userId = created.user.id
    profileId = created.profile.id

    const assessment = createInitialAssessment(txApp, userId, initialLevel, data.levelNotes)
    assessmentId = assessment ? assessment.id : ''

    const issued = issueInvitation(txApp, userId)
    invitationId = issued.invitation.id
    rawToken = issued.token
    expiresAt = issued.invitation.getString('expires_at')

    const occupied = txApp.countRecords(
      'enrollments',
      $dbx.hashExp({ group: targetGroupId, status: 'ACTIVE' }),
    )
    if (occupied >= resolved.group.getInt('capacity')) throw new BadRequestError('El grupo ya ha alcanzado su capacidad.')

    const enrollment = new Record(txApp.findCollectionByNameOrId('enrollments'))
    enrollment.set('student', userId)
    enrollment.set('group', targetGroupId)
    enrollment.set('status', 'ACTIVE')
    enrollment.set('joined_at', new Date().toISOString())
    enrollment.set('ended_at', '')
    txApp.save(enrollment)
    enrollmentId = enrollment.id
  })

  const user = e.app.findRecordById('users', userId)
  const invitation = e.app.findRecordById('account_invitations', invitationId)
  const activationUrl = activationBaseUrl ? `${activationBaseUrl}/activar-cuenta?token=${encodeURIComponent(rawToken)}` : ''
  const emailSent = trySend(e.app, user, invitation, activationUrl)

  return e.json(201, {
    userId,
    profileId,
    assessmentId: assessmentId || null,
    enrollmentId,
    studentStatus: 'INVITED',
    currentLevel: initialLevel,
    targetLevel,
    levelMismatch,
    courseId,
    teacherId,
    invitation: {
      userId,
      invitationId,
      role: 'STUDENT',
      status: 'PENDING',
      expiresAt,
      activationUrl: '',
      emailSent,
    },
  })
}, $apis.requireAuth('users'))
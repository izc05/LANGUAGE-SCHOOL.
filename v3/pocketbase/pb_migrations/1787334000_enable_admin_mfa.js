migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const e2e = $os.getenv('LANGUAGE_SCHOOL_E2E') === '1'

  // Production contract: every application ADMIN must complete MFA.
  // The two fixture addresses are exempt only when an ephemeral CI database is
  // migrated with LANGUAGE_SCHOOL_E2E=1 so the existing broad regression suite
  // can keep using its established ADMIN fixture. Production never sets it.
  users.mfa.enabled = true
  users.mfa.duration = 900
  users.mfa.rule = e2e
    ? 'role = "ADMIN" && email != "ci-admin@example.com" && email != "e2e-admin@example.com"'
    : 'role = "ADMIN"'

  users.otp.enabled = true
  users.otp.duration = 300
  users.otp.length = 6
  users.otp.emailTemplate.subject = 'Código de acceso · {APP_NAME}'
  users.otp.emailTemplate.body = '<p>Tu código de seguridad para acceder a {APP_NAME} es:</p><p><strong style="font-size:24px;letter-spacing:4px">{OTP}</strong></p><p>Caduca en 5 minutos. Si no has intentado iniciar sesión, ignora este mensaje.</p>'

  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')

  users.mfa.enabled = false
  users.mfa.duration = 1800
  users.mfa.rule = ''
  users.otp.enabled = false
  users.otp.duration = 180
  users.otp.length = 8

  app.save(users)
})

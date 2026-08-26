/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
  e.next()

  function env(name) {
    return String($os.getenv(name) || '').trim()
  }

  const publicOrigin = env('PUBLIC_ORIGIN').replace(/\/+$/, '')
  const isE2E = env('LANGUAGE_SCHOOL_E2E') === '1'
  const deploymentMode = env('DEPLOYMENT_MODE') || 'production'
  const pilotMailCapture = env('PILOT_MAIL_CAPTURE').toLowerCase() === 'true'
  if (!publicOrigin) return

  if (deploymentMode !== 'pilot' && deploymentMode !== 'production') {
    throw new Error('DEPLOYMENT_MODE must be exactly pilot or production.')
  }

  const validProductionOrigin = /^https:\/\/[^/]+$/i.test(publicOrigin)
  const validE2EOrigin = isE2E && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(publicOrigin)
  if (!validProductionOrigin && !validE2EOrigin) {
    throw new Error('PUBLIC_ORIGIN must be the final HTTPS origin (loopback HTTP is allowed only in E2E).')
  }

  const settings = e.app.settings()
  settings.meta.appURL = publicOrigin

  const configuredAppName = env('APP_NAME')
  if (configuredAppName) settings.meta.appName = configuredAppName

  const smtpEnabled = env('SMTP_ENABLED').toLowerCase() === 'true'
  if (!isE2E && deploymentMode === 'production' && !smtpEnabled) {
    throw new Error('SMTP_ENABLED=true is required in production.')
  }
  if (deploymentMode === 'pilot' && pilotMailCapture && !smtpEnabled) {
    throw new Error('PILOT_MAIL_CAPTURE=true requires SMTP_ENABLED=true.')
  }
  if (smtpEnabled) {
    const host = env('SMTP_HOST')
    const port = Number(env('SMTP_PORT') || '587')
    const senderAddress = env('SMTP_SENDER_ADDRESS')
    const senderName = env('SMTP_SENDER_NAME') || settings.meta.appName || 'Language School'
    const localHost = /^(?:localhost|127\..*|0\.0\.0\.0|::1|\[::1\]|.*\.local)$/i.test(host)

    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !senderAddress.includes('@')) {
      throw new Error('SMTP_ENABLED=true requires valid SMTP_HOST, SMTP_PORT and SMTP_SENDER_ADDRESS.')
    }
    if (!isE2E && deploymentMode === 'production' && (pilotMailCapture || localHost)) {
      throw new Error('Production rejects PILOT or loopback/local SMTP capture.')
    }
    if (deploymentMode === 'pilot' && localHost) {
      if (!pilotMailCapture || host !== '127.0.0.1' || env('SMTP_TLS').toLowerCase() !== 'false') {
        throw new Error('Local PILOT SMTP requires the explicit loopback capture contract.')
      }
      if (env('SMTP_USERNAME') || env('SMTP_PASSWORD') || env('SMTP_AUTH_METHOD')) {
        throw new Error('Local PILOT SMTP must not use authentication fields.')
      }
    } else if (pilotMailCapture) {
      throw new Error('PILOT_MAIL_CAPTURE requires the loopback-only PILOT SMTP configuration.')
    }

    settings.smtp.enabled = true
    settings.smtp.host = host
    settings.smtp.port = port
    settings.smtp.username = env('SMTP_USERNAME')
    settings.smtp.password = env('SMTP_PASSWORD')
    settings.smtp.authMethod = env('SMTP_AUTH_METHOD')
    settings.smtp.tls = env('SMTP_TLS').toLowerCase() !== 'false'
    settings.smtp.localName = env('SMTP_LOCAL_NAME')
    settings.meta.senderName = senderName
    settings.meta.senderAddress = senderAddress
  } else if (deploymentMode === 'pilot') {
    settings.smtp.enabled = false
  }

  e.app.save(settings)
})

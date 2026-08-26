routerAdd('POST', '/api/language-school/contact', (e) => {
  const readText = (value) => typeof value === 'string' ? value.trim() : ''
  const testMode = readText($os.getenv('LANGUAGE_SCHOOL_E2E')) === '1'
  const deploymentMode = readText($os.getenv('DEPLOYMENT_MODE')) || 'production'
  const pilotMode = deploymentMode === 'pilot'
  const officialAlwaysPassTestSecret = '1x0000000000000000000000000000000AA'

  const safeLog = (level, message, extra) => {
    const logger = $app.logger()
    const data = extra || {}
    if (level === 'error') logger.error(message, 'stage', readText(data.stage), 'status', Number(data.status || 0))
    else logger.warn(message, 'stage', readText(data.stage), 'status', Number(data.status || 0))
  }

  const body = e.requestInfo().body || {}
  const name = readText(body.name)
  const email = readText(body.email)
  const phone = readText(body.phone)
  const interest = readText(body.interest)
  const message = readText(body.message)
  const honeypot = readText(body.website)
  const token = readText(body.turnstileToken)

  // Bots that fill the hidden field get a neutral response so the honeypot
  // itself does not become an oracle.
  if (honeypot) return e.json(200, { success: true })

  if (!name || !email || !message) return e.json(400, { message: 'Revisa los datos del formulario.' })
  if (name.length > 160 || email.length > 255 || phone.length > 30 || interest.length > 160 || message.length > 4000) {
    return e.json(400, { message: 'Revisa los datos del formulario.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return e.json(400, { message: 'Revisa el email indicado.' })
  if (!token || token.length > 2048) return e.json(400, { message: 'Completa la verificación de seguridad.' })

  const secret = readText($os.getenv('TURNSTILE_SECRET_KEY'))
  const expectedAction = readText($os.getenv('TURNSTILE_EXPECTED_ACTION'))
  const allowedHostnames = readText($os.getenv('TURNSTILE_ALLOWED_HOSTNAMES'))
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  if (!secret) {
    safeLog('error', '[contact] Turnstile secret missing', { stage: 'configuration' })
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }
  if (deploymentMode !== 'pilot' && deploymentMode !== 'production') {
    safeLog('error', '[contact] Invalid deployment mode', { stage: 'configuration' })
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }
  if (secret === officialAlwaysPassTestSecret && !testMode && !pilotMode) {
    safeLog('error', '[contact] Turnstile test secret rejected outside PILOT/E2E', { stage: 'configuration' })
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }
  if (!expectedAction) {
    safeLog('error', '[contact] Turnstile expected action missing', { stage: 'configuration' })
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }
  if (!testMode && expectedAction !== 'contact') {
    safeLog('error', '[contact] Turnstile production action must be contact', { stage: 'configuration' })
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }
  const pilotOfficialTest = pilotMode && secret === officialAlwaysPassTestSecret
  if (allowedHostnames.length === 0 && !pilotOfficialTest) {
    safeLog('error', '[contact] Turnstile hostname allowlist missing', { stage: 'configuration' })
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }
  if (!testMode && !pilotOfficialTest && allowedHostnames.some((host) => host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local') || host.endsWith('.test'))) {
    safeLog('error', '[contact] Local Turnstile hostname rejected outside E2E', { stage: 'configuration' })
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }

  let verification
  // CI already validates the production Siteverify contract independently. In the
  // browser suite and explicit PILOT profile keep the official Cloudflare
  // always-pass secret deterministic and fully local. Production rejects that
  // secret above, while PILOT remains isolated to test-only data.
  if ((testMode || pilotMode) && secret === officialAlwaysPassTestSecret) {
    verification = {
      success: true,
      action: pilotMode ? 'contact' : 'test',
      hostname: allowedHostnames.indexOf('localhost') !== -1 ? 'localhost' : allowedHostnames[0],
    }
  } else {
    try {
      const response = $http.send({
        url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, response: token }),
        timeout: 10,
      })
      if (response.statusCode !== 200 || !response.json) {
        safeLog('warn', '[contact] Turnstile Siteverify unavailable', { stage: 'siteverify', status: response.statusCode })
        return e.json(503, { message: 'No se ha podido verificar el formulario. Inténtalo de nuevo.' })
      }
      verification = response.json
    } catch (_) {
      safeLog('error', '[contact] Turnstile Siteverify request failed', { stage: 'siteverify' })
      return e.json(503, { message: 'No se ha podido verificar el formulario. Inténtalo de nuevo.' })
    }
  }

  if (verification.success !== true) {
    safeLog('warn', '[contact] Turnstile rejected request', { stage: 'validation' })
    return e.json(400, { message: 'No se ha podido validar la verificación de seguridad.' })
  }

  const verifiedAction = readText(verification.action)
  const verifiedHostname = readText(verification.hostname).toLowerCase()
  const actionMatches = testMode
    ? (verifiedAction === expectedAction || verifiedAction === 'test')
    : verifiedAction === expectedAction

  if (!actionMatches) {
    safeLog('warn', '[contact] Turnstile action mismatch', { stage: 'validation' })
    return e.json(400, { message: 'No se ha podido validar la verificación de seguridad.' })
  }
  if (!pilotOfficialTest && (!verifiedHostname || allowedHostnames.indexOf(verifiedHostname) === -1)) {
    safeLog('warn', '[contact] Turnstile hostname mismatch', { stage: 'validation' })
    return e.json(400, { message: 'No se ha podido validar la verificación de seguridad.' })
  }

  try {
    const collection = $app.findCollectionByNameOrId('contact_requests')
    const record = new Record(collection)
    record.set('name', name)
    record.set('email', email)
    record.set('phone', phone)
    record.set('interest', interest)
    record.set('message', message)
    record.set('status', 'NEW')
    $app.save(record)
  } catch (_) {
    safeLog('error', '[contact] Failed to persist protected contact request', { stage: 'persist' })
    return e.json(500, { message: 'No se ha podido registrar la solicitud. Inténtalo de nuevo.' })
  }

  return e.json(201, { success: true })
})

routerAdd('POST', '/api/language-school/contact', (e) => {
  const readText = (value) => typeof value === 'string' ? value.trim() : ''

  const logContactError = (stage, error) => {
    $app.logger().error('[contact] protected contact request failed', 'stage', stage, 'error', error)
  }

  const invalidContactPayload = (body) => {
    const name = readText(body.name)
    const email = readText(body.email)
    const phone = readText(body.phone)
    const interest = readText(body.interest)
    const message = readText(body.message)

    if (!name || !email || !message) return true
    if (name.length > 160 || email.length > 255 || phone.length > 30 || interest.length > 160 || message.length > 4000) return true
    if (email.indexOf('@') === -1) return true
    return false
  }

  const allowedTurnstileHostname = (hostname) => {
    const configured = readText($os.getenv('TURNSTILE_ALLOWED_HOSTNAMES'))
    if (!configured) return true
    const allowed = configured.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)
    return allowed.indexOf(readText(hostname).toLowerCase()) !== -1
  }

  const body = e.requestInfo().body || {}

  // Honeypot: bots that fill hidden fields get a neutral success response.
  if (readText(body.website)) {
    return e.json(200, { success: true })
  }

  if (invalidContactPayload(body)) {
    return e.json(400, { message: 'Revisa los datos del formulario.' })
  }

  const token = readText(body.turnstileToken)
  if (!token || token.length > 2048) {
    return e.json(400, { message: 'Completa la verificación de seguridad.' })
  }

  const secret = readText($os.getenv('TURNSTILE_SECRET_KEY'))
  if (!secret) {
    $app.logger().error('[contact] TURNSTILE_SECRET_KEY is not configured')
    return e.json(503, { message: 'La protección del formulario no está disponible temporalmente.' })
  }

  let verification
  try {
    const response = $http.send({
      url: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token }),
      timeout: 10,
    })

    if (response.statusCode !== 200 || !response.json) {
      $app.logger().warn('[contact] Turnstile Siteverify returned an unexpected response', 'status', response.statusCode)
      return e.json(503, { message: 'No se ha podido verificar el formulario. Inténtalo de nuevo.' })
    }
    verification = response.json
  } catch (error) {
    logContactError('siteverify', error)
    return e.json(503, { message: 'No se ha podido verificar el formulario. Inténtalo de nuevo.' })
  }

  if (verification.success !== true) {
    $app.logger().warn('[contact] Turnstile rejected a contact request')
    return e.json(400, { message: 'No se ha podido validar la verificación de seguridad.' })
  }

  const expectedAction = readText($os.getenv('TURNSTILE_EXPECTED_ACTION'))
  if (expectedAction && readText(verification.action) !== expectedAction) {
    $app.logger().warn('[contact] Turnstile action mismatch')
    return e.json(400, { message: 'No se ha podido validar la verificación de seguridad.' })
  }

  if (!allowedTurnstileHostname(verification.hostname)) {
    $app.logger().warn('[contact] Turnstile hostname mismatch')
    return e.json(400, { message: 'No se ha podido validar la verificación de seguridad.' })
  }

  try {
    const collection = $app.findCollectionByNameOrId('contact_requests')
    const record = new Record(collection)
    record.set('name', readText(body.name))
    record.set('email', readText(body.email))
    record.set('phone', readText(body.phone))
    record.set('interest', readText(body.interest))
    record.set('message', readText(body.message))
    record.set('status', 'NEW')
    $app.save(record)
  } catch (error) {
    logContactError('persist', error)
    return e.json(500, { message: 'No se ha podido registrar la solicitud. Inténtalo de nuevo.' })
  }

  return e.json(201, { success: true })
})

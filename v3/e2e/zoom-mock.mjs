import http from 'node:http'

const host = '127.0.0.1'
const port = Number(process.env.E2E_ZOOM_MOCK_PORT || 8092)

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    return json(response, 200, { ok: true })
  }

  if (request.method === 'POST' && request.url?.startsWith('/oauth/token')) {
    const authorization = request.headers.authorization || ''
    if (!authorization.startsWith('Basic ')) {
      return json(response, 401, { reason: 'missing_basic_auth' })
    }
    return json(response, 200, {
      access_token: 'e2e-zoom-access-token',
      token_type: 'bearer',
      expires_in: 3599,
      scope: 'meeting:write:meeting:admin',
    })
  }

  if (request.method === 'POST' && request.url === '/v2/users/e2e-host/meetings') {
    if (request.headers.authorization !== 'Bearer e2e-zoom-access-token') {
      return json(response, 401, { reason: 'invalid_bearer' })
    }

    let raw = ''
    for await (const chunk of request) raw += chunk
    let payload = null
    try { payload = JSON.parse(raw || '{}') } catch { return json(response, 400, { reason: 'invalid_json' }) }

    if (
      payload?.type !== 2 ||
      !payload?.topic?.startsWith('Language School · ') ||
      !payload?.start_time ||
      !Number.isFinite(payload?.duration) ||
      payload?.settings?.waiting_room !== true ||
      payload?.settings?.join_before_host !== false ||
      payload?.settings?.mute_upon_entry !== true
    ) {
      return json(response, 400, { reason: 'unexpected_meeting_payload', payload })
    }

    return json(response, 201, {
      id: 12345678901,
      uuid: 'e2e-created-zoom-uuid',
      topic: payload.topic,
      start_time: payload.start_time,
      duration: payload.duration,
      password: 'e2e-pass',
      join_url: 'https://zoom.example/j/12345678901?pwd=participant',
      start_url: 'https://zoom.example/s/12345678901?zak=HOST_SECRET_MUST_NOT_ESCAPE',
    })
  }

  return json(response, 404, { reason: 'not_found', method: request.method, url: request.url })
})

server.listen(port, host, () => {
  console.log(`Zoom E2E mock listening on http://${host}:${port}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)))
}

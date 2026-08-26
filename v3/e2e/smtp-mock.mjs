import net from 'node:net'
import http from 'node:http'

const SMTP_HOST = '127.0.0.1'
const SMTP_PORT = Number(process.env.LANGUAGE_SCHOOL_E2E_SMTP_PORT || 2525)
const HTTP_HOST = '127.0.0.1'
const HTTP_PORT = Number(process.env.LANGUAGE_SCHOOL_E2E_SMTP_HTTP_PORT || 8093)

const messages = []

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function decodeQuotedPrintableBytes(value) {
  const bytes = []
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '=' && /^[A-Fa-f0-9]{2}$/.test(value.slice(index + 1, index + 3))) {
      bytes.push(Number.parseInt(value.slice(index + 1, index + 3), 16))
      index += 2
      continue
    }
    bytes.push(value.charCodeAt(index) & 255)
  }
  return Buffer.from(bytes)
}

function decodeQuotedPrintable(value) {
  const normalized = value.replace(/=\r?\n/g, '')
  return decodeQuotedPrintableBytes(normalized).toString('utf8')
}

function decodeMimeHeader(value) {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_match, charset, encoding, payload) => {
    const mode = String(encoding).toUpperCase()
    const bytes = mode === 'B'
      ? Buffer.from(payload, 'base64')
      : decodeQuotedPrintableBytes(String(payload).replace(/_/g, ' '))
    return bytes.toString(String(charset).toLowerCase().includes('utf') ? 'utf8' : 'latin1')
  })
}

function readHeader(headers, name) {
  const match = headers.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))
  return match?.[1]?.trim() || ''
}

function normalizedMessage(raw, envelope) {
  const separator = raw.search(/\r?\n\r?\n/)
  const rawHeaders = separator >= 0 ? raw.slice(0, separator) : raw
  const rawBody = separator >= 0 ? raw.slice(separator).replace(/^\r?\n\r?\n/, '') : ''
  const headers = rawHeaders.replace(/\r?\n[ \t]+/g, ' ')
  const decodedBody = decodeQuotedPrintable(rawBody)
  const decoded = `${headers}\r\n\r\n${decodedBody}`
  const subject = decodeMimeHeader(readHeader(headers, 'Subject'))
  const to = decodeMimeHeader(readHeader(headers, 'To'))
  const from = decodeMimeHeader(readHeader(headers, 'From'))

  return {
    id: messages.length + 1,
    receivedAt: new Date().toISOString(),
    envelope,
    subject,
    to: to || envelope.to.join(', '),
    from: from || envelope.from,
    raw,
    decoded,
  }
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${HTTP_HOST}:${HTTP_PORT}`)
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, smtpPort: SMTP_PORT, messages: messages.length })
  }
  if (req.method === 'GET' && url.pathname === '/messages') {
    const recipient = (url.searchParams.get('recipient') || '').trim().toLowerCase()
    const selected = recipient
      ? messages.filter((message) => message.to.toLowerCase().includes(recipient) || message.envelope.to.some((value) => value.toLowerCase().includes(recipient)))
      : messages
    return json(res, 200, { messages: selected })
  }
  if (req.method === 'DELETE' && url.pathname === '/messages') {
    messages.splice(0, messages.length)
    return json(res, 200, { ok: true })
  }
  return json(res, 404, { error: 'not_found' })
})

const smtpServer = net.createServer((socket) => {
  socket.setEncoding('utf8')
  let buffer = ''
  let dataMode = false
  let dataLines = []
  let envelope = { from: '', to: [] }

  function reply(line) {
    socket.write(`${line}\r\n`)
  }

  function resetTransaction() {
    dataMode = false
    dataLines = []
    envelope = { from: '', to: [] }
  }

  reply('220 language-school-e2e.local ESMTP ready')

  socket.on('data', (chunk) => {
    buffer += chunk
    let newlineIndex
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)

      if (dataMode) {
        if (line === '.') {
          const raw = dataLines.map((value) => value.startsWith('..') ? value.slice(1) : value).join('\r\n') + '\r\n'
          messages.push(normalizedMessage(raw, envelope))
          resetTransaction()
          reply('250 2.0.0 message accepted for delivery')
        } else {
          dataLines.push(line)
        }
        continue
      }

      const [verbRaw] = line.trim().split(/\s+/, 1)
      const verb = (verbRaw || '').toUpperCase()

      if (verb === 'EHLO' || verb === 'HELO') {
        socket.write('250-language-school-e2e.local\r\n250-8BITMIME\r\n250-SIZE 26214400\r\n250 PIPELINING\r\n')
      } else if (verb === 'MAIL') {
        envelope.from = line.replace(/^MAIL\s+FROM:\s*/i, '').trim()
        reply('250 2.1.0 sender ok')
      } else if (verb === 'RCPT') {
        envelope.to.push(line.replace(/^RCPT\s+TO:\s*/i, '').trim())
        reply('250 2.1.5 recipient ok')
      } else if (verb === 'DATA') {
        dataMode = true
        dataLines = []
        reply('354 end data with <CR><LF>.<CR><LF>')
      } else if (verb === 'RSET') {
        resetTransaction()
        reply('250 2.0.0 reset')
      } else if (verb === 'NOOP') {
        reply('250 2.0.0 ok')
      } else if (verb === 'QUIT') {
        reply('221 2.0.0 bye')
        socket.end()
      } else {
        reply('250 2.0.0 ok')
      }
    }
  })

  socket.on('error', () => {})
})

smtpServer.listen(SMTP_PORT, SMTP_HOST, () => {
  console.log(`SMTP mock listening on smtp://${SMTP_HOST}:${SMTP_PORT}`)
})
httpServer.listen(HTTP_PORT, HTTP_HOST, () => {
  console.log(`SMTP mock control listening on http://${HTTP_HOST}:${HTTP_PORT}`)
})

function shutdown() {
  smtpServer.close(() => {})
  httpServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 500).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

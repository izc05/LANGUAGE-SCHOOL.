import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'

const SMTP_HOST = '127.0.0.1'
const SMTP_PORT = Number(process.env.SMTP_PORT || '2526')
const CONTROL_SOCKET = process.env.PILOT_MAIL_CONTROL_SOCKET || '/run/language-school-pilot-mail/control.sock'
const MAX_MESSAGES = 100

function abort(message) {
  console.error(`PILOT mail capture refused to start: ${message}`)
  process.exit(1)
}

if ((process.env.DEPLOYMENT_MODE || '').trim() !== 'pilot') abort('DEPLOYMENT_MODE must be pilot')
if ((process.env.PILOT_MAIL_CAPTURE || '').trim().toLowerCase() !== 'true') abort('PILOT_MAIL_CAPTURE must be true')
if ((process.env.SMTP_ENABLED || '').trim().toLowerCase() !== 'true') abort('SMTP_ENABLED must be true')
if ((process.env.SMTP_HOST || '').trim() !== SMTP_HOST) abort('SMTP_HOST must be exactly 127.0.0.1')
if ((process.env.SMTP_TLS || '').trim().toLowerCase() !== 'false') abort('SMTP_TLS must be false for the loopback-only capture')
if ((process.env.SMTP_USERNAME || '').trim() || (process.env.SMTP_PASSWORD || '').trim() || (process.env.SMTP_AUTH_METHOD || '').trim()) {
  abort('SMTP authentication fields must be empty')
}
if (!Number.isInteger(SMTP_PORT) || SMTP_PORT < 1 || SMTP_PORT > 65535) abort('SMTP_PORT is invalid')

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
    } else {
      bytes.push(value.charCodeAt(index) & 255)
    }
  }
  return Buffer.from(bytes)
}

function decodeQuotedPrintable(value) {
  return decodeQuotedPrintableBytes(value.replace(/=\r?\n/g, '')).toString('utf8')
}

function decodeMimeHeader(value) {
  return value.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_match, charset, encoding, payload) => {
    const bytes = String(encoding).toUpperCase() === 'B'
      ? Buffer.from(payload, 'base64')
      : decodeQuotedPrintableBytes(String(payload).replace(/_/g, ' '))
    return bytes.toString(String(charset).toLowerCase().includes('utf') ? 'utf8' : 'latin1')
  })
}

function readHeader(headers, name) {
  const match = headers.match(new RegExp(`^${name}:\\s*(.+)$`, 'im'))
  return match?.[1]?.trim() || ''
}

function normalizeAddress(value) {
  const match = String(value).match(/<([^>]+)>/)
  return (match?.[1] || String(value)).trim().toLowerCase()
}

function normalizedMessage(raw, envelope) {
  const separator = raw.search(/\r?\n\r?\n/)
  const rawHeaders = separator >= 0 ? raw.slice(0, separator) : raw
  const rawBody = separator >= 0 ? raw.slice(separator).replace(/^\r?\n\r?\n/, '') : ''
  const headers = rawHeaders.replace(/\r?\n[ \t]+/g, ' ')
  const decoded = `${headers}\r\n\r\n${decodeQuotedPrintable(rawBody)}`
  const recipients = [decodeMimeHeader(readHeader(headers, 'To')), ...envelope.to]
    .flatMap((value) => String(value).split(','))
    .map(normalizeAddress)
    .filter(Boolean)

  return {
    receivedAt: new Date().toISOString(),
    recipients: [...new Set(recipients)],
    subject: decodeMimeHeader(readHeader(headers, 'Subject')),
    decoded,
  }
}

const controlServer = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://unix.local')
  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true, messages: messages.length })
  }
  if (req.method === 'GET' && url.pathname === '/latest') {
    const recipient = normalizeAddress(url.searchParams.get('recipient') || '')
    if (!recipient || !recipient.includes('@')) return json(res, 400, { error: 'recipient_required' })
    const message = [...messages].reverse().find((candidate) => candidate.recipients.includes(recipient))
    if (!message) return json(res, 404, { error: 'message_not_found' })
    const otp = message.decoded.match(/\b(\d{6})\b/)?.[1] || ''
    return json(res, 200, {
      recipient,
      receivedAt: message.receivedAt,
      subject: message.subject,
      otp: otp || null,
    })
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

  const reply = (line) => socket.write(`${line}\r\n`)
  const resetTransaction = () => {
    dataMode = false
    dataLines = []
    envelope = { from: '', to: [] }
  }

  reply('220 language-school-pilot.local ESMTP ready')
  socket.on('data', (chunk) => {
    buffer += chunk
    let newlineIndex
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      let line = buffer.slice(0, newlineIndex)
      buffer = buffer.slice(newlineIndex + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)

      if (dataMode) {
        if (line === '.') {
          const raw = `${dataLines.map((value) => value.startsWith('..') ? value.slice(1) : value).join('\r\n')}\r\n`
          messages.push(normalizedMessage(raw, envelope))
          if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES)
          resetTransaction()
          reply('250 2.0.0 message accepted for local capture')
        } else {
          dataLines.push(line)
        }
        continue
      }

      const verb = (line.trim().split(/\s+/, 1)[0] || '').toUpperCase()
      if (verb === 'EHLO' || verb === 'HELO') {
        socket.write('250-language-school-pilot.local\r\n250-8BITMIME\r\n250-SIZE 26214400\r\n250 PIPELINING\r\n')
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

try {
  fs.unlinkSync(CONTROL_SOCKET)
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

smtpServer.listen(SMTP_PORT, SMTP_HOST, () => {
  console.log(`PILOT SMTP capture listening on ${SMTP_HOST}:${SMTP_PORT}`)
})
controlServer.listen(CONTROL_SOCKET, () => {
  fs.chmodSync(CONTROL_SOCKET, 0o600)
  console.log(`PILOT mail control available through local Unix socket ${CONTROL_SOCKET}`)
})

function shutdown() {
  smtpServer.close(() => {})
  controlServer.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 500).unref()
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

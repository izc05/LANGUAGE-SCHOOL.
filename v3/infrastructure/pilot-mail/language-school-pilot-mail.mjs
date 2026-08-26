#!/usr/bin/env node
import http from 'node:http'

const CONTROL_SOCKET = process.env.PILOT_MAIL_CONTROL_SOCKET || '/run/language-school-pilot-mail/control.sock'

if (typeof process.getuid === 'function' && process.getuid() !== 0) {
  console.error('Run this local operator utility with sudo.')
  process.exit(1)
}

function request(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: CONTROL_SOCKET, method, path }, (res) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(body) } catch { return reject(new Error('Invalid response from PILOT mail capture.')) }
        if ((res.statusCode || 500) >= 400) return reject(new Error(parsed.error || `HTTP ${res.statusCode}`))
        resolve(parsed)
      })
    })
    req.on('error', reject)
    req.end()
  })
}

const [command, argument] = process.argv.slice(2)
try {
  if (command === 'latest') {
    const recipient = String(argument || '').trim().toLowerCase()
    if (!recipient || !recipient.includes('@')) throw new Error('Usage: sudo language-school-pilot-mail latest <email>')
    const message = await request('GET', `/latest?recipient=${encodeURIComponent(recipient)}`)
    console.log(`Recipient: ${message.recipient}`)
    console.log(`Subject: ${message.subject || '(no subject)'}`)
    console.log(`Received: ${message.receivedAt}`)
    if (!message.otp) throw new Error('The latest captured message does not contain a six-digit OTP.')
    console.log(`OTP: ${message.otp}`)
  } else if (command === 'clear') {
    await request('DELETE', '/messages')
    console.log('Captured PILOT messages cleared from memory.')
  } else if (command === 'health') {
    const health = await request('GET', '/health')
    console.log(`PILOT mail capture healthy; messages in memory: ${health.messages}`)
  } else {
    throw new Error('Usage: sudo language-school-pilot-mail <latest EMAIL|clear|health>')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

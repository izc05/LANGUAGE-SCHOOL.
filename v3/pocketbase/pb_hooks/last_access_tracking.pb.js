/// <reference path="../pb_data/types.d.ts" />

// Keep a single operational timestamp, not a browsing history or a live
// presence signal. The server, rather than the browser, owns this value.
onRecordAuthRequest((e) => {
  // PocketBase invokes hook handlers in their own runtime scope, so keep this
  // value local to the handler instead of relying on a module-level binding.
  const throttleMs = 15 * 60 * 1000
  const record = e.record
  const previous = new Date(record.getString('last_access_at')).getTime()
  const now = Date.now()

  if (!Number.isFinite(previous) || now - previous >= throttleMs) {
    try {
      record.set('last_access_at', new Date(now).toISOString())
      e.app.save(record)
    } catch (error) {
      // Access tracking must never make an otherwise valid sign-in fail.
      console.log(`Unable to update last access for ${record.id}: ${error}`)
    }
  }

  e.next()
}, 'users')

onRecordEnrich((e) => {
  const requester = e.requestInfo.auth
  if (!requester || requester.getString('role') !== 'ADMIN') {
    e.record.hide('last_access_at')
  }
  e.next()
}, 'users')

/// <reference path="../pb_data/types.d.ts" />

// TEMPORARY · FASE 15B.2A
// Until 15B.2B removes Admin's legacy direct-password account creation,
// an ACTIVE STUDENT/TEACHER explicitly created through the authenticated
// Admin API with a supplied password is treated as an already activated
// legacy account. Secure invitations are created server-side as INVITED
// with verified=false, so they never match this compatibility path.
onRecordCreateRequest((e) => {
  const auth = e.auth
  if (!auth || auth.getString('role') !== 'ADMIN' || auth.getString('status') !== 'ACTIVE') {
    return e.next()
  }

  const body = e.requestInfo().body || {}
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return e.next()
  }

  const role = e.record.getString('role')
  const status = e.record.getString('status')
  const hasExplicitPassword =
    typeof body.password === 'string' &&
    body.password.length > 0 &&
    typeof body.passwordConfirm === 'string' &&
    body.passwordConfirm.length > 0

  if ((role === 'STUDENT' || role === 'TEACHER') && status === 'ACTIVE' && hasExplicitPassword) {
    e.record.set('verified', true)
  }

  e.next()
}, 'users')

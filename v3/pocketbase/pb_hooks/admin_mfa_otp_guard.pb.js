/// <reference path="../pb_data/types.d.ts" />

// OTP is enabled on the shared users auth collection because PocketBase uses
// it as the second factor for ADMIN accounts. Do not let that simultaneously
// become a standalone passwordless login method for STUDENT/TEACHER accounts.
onRecordRequestOTPRequest((e) => {
  if (e.record && e.record.getString('role') !== 'ADMIN') {
    // Preserve PocketBase's enumeration-safe request behaviour: behave as if
    // the address were unknown instead of exposing that a non-admin exists.
    e.record = null
  }
  e.next()
}, 'users')

onRecordAuthWithOTPRequest((e) => {
  if (e.record && e.record.getString('role') !== 'ADMIN') {
    throw new ForbiddenError('El código de un solo uso está reservado al acceso seguro de Administración.')
  }
  e.next()
}, 'users')

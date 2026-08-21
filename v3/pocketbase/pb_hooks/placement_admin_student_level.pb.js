/// <reference path="../pb_data/types.d.ts" />

routerAdd('GET', '/api/language-school/placement/admin/students/{studentId}/summary', (e) => {
  const adminLevel = require(`${__hooks}/placement_admin_student_level.js`)
  return adminLevel.summary(e)
}, $apis.requireAuth('users'))

routerAdd('POST', '/api/language-school/placement/admin/students/{studentId}/assessments', (e) => {
  const adminLevel = require(`${__hooks}/placement_admin_student_level.js`)
  return adminLevel.createAssessment(e)
}, $apis.requireAuth('users'))

/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/language-school/placement/start', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.start(e)
})

routerAdd('GET', '/api/language-school/placement/campus/summary', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.campusSummary(e)
})

routerAdd('GET', '/api/language-school/placement/teacher/students/{studentId}/summary', (e) => {
  const teacherPlacement = require(`${__hooks}/placement_teacher.js`)
  return teacherPlacement.summary(e)
})

routerAdd('POST', '/api/language-school/placement/teacher/students/{studentId}/validate', (e) => {
  const teacherPlacement = require(`${__hooks}/placement_teacher.js`)
  return teacherPlacement.validate(e)
})

routerAdd('GET', '/api/language-school/placement/admin/tests', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.listTests(e)
})

routerAdd('POST', '/api/language-school/placement/admin/tests', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.createDraft(e)
})

routerAdd('PATCH', '/api/language-school/placement/admin/tests/{id}', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.updateDraft(e)
})

routerAdd('DELETE', '/api/language-school/placement/admin/tests/{id}', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.deleteDraft(e)
})

routerAdd('GET', '/api/language-school/placement/admin/tests/{id}/questions', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.listQuestions(e)
})

routerAdd('POST', '/api/language-school/placement/admin/tests/{id}/questions', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.createQuestion(e)
})

routerAdd('PATCH', '/api/language-school/placement/admin/questions/{id}', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.updateQuestion(e)
})

routerAdd('DELETE', '/api/language-school/placement/admin/questions/{id}', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.deleteQuestion(e)
})

routerAdd('POST', '/api/language-school/placement/admin/tests/{id}/publish', (e) => {
  const placementAdmin = require(`${__hooks}/placement_admin.js`)
  return placementAdmin.publish(e)
})

routerAdd('GET', '/api/language-school/placement/attempts/{id}/question', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.nextQuestion(e)
})

routerAdd('POST', '/api/language-school/placement/attempts/{id}/answer', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.answer(e)
})

routerAdd('POST', '/api/language-school/placement/attempts/{id}/finish', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.finish(e)
})

routerAdd('GET', '/api/language-school/placement/attempts/{id}/result', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.result(e)
})

routerAdd('GET', '/api/language-school/placement/attempts/{id}/recommendations', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.recommendations(e)
})

routerAdd('POST', '/api/language-school/placement/attempts/{id}/contact', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  return placement.contact(e)
})

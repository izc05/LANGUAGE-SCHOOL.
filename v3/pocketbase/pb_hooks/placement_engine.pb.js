/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/language-school/placement/start', (e) => {
  const placement = require(`${__hooks}/placement_service.js`)
  try {
    return placement.start(e)
  } catch (error) {
    console.log(`[placement/start] ${error && error.stack ? error.stack : String(error)}`)
    throw error
  }
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

const placement = require(`${__hooks}/placement_service.js`)
const listening = require(`${__hooks}/placement_listening_service.js`)
const listeningCore = require(`${__hooks}/placement_listening_core.js`)

function publishedAlgorithm(app) {
  const tests = app.findAllRecords('placement_tests').filter((record) => record.getString('status') === 'PUBLISHED')
  if (tests.length !== 1) return ''
  return tests[0].getString('algorithm_version')
}

function attemptAlgorithm(e) {
  try {
    const attempt = e.app.findRecordById('placement_attempts', String(e.request.pathValue('id') || ''))
    return attempt.getString('algorithm_version')
  } catch {
    return ''
  }
}

function start(e) {
  return publishedAlgorithm(e.app) === listeningCore.ALGORITHM_VERSION ? listening.start(e) : placement.start(e)
}

function nextQuestion(e) {
  return attemptAlgorithm(e) === listeningCore.ALGORITHM_VERSION ? listening.nextQuestion(e) : placement.nextQuestion(e)
}

function answer(e) {
  return placement.answer(e)
}

function finish(e) {
  return attemptAlgorithm(e) === listeningCore.ALGORITHM_VERSION ? listening.finish(e) : placement.finish(e)
}

function result(e) {
  return attemptAlgorithm(e) === listeningCore.ALGORITHM_VERSION ? listening.result(e) : placement.result(e)
}

module.exports = { start, nextQuestion, answer, finish, result }

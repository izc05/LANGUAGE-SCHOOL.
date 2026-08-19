const placement = require(`${__hooks}/placement_service.js`)
const listening = require(`${__hooks}/placement_listening_service.js`)
const listeningCore = require(`${__hooks}/placement_listening_core.js`)
const progressive = require(`${__hooks}/placement_progressive_service.js`)
const progressiveCore = require(`${__hooks}/placement_progressive_core.js`)

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
  const algorithm = publishedAlgorithm(e.app)
  if (algorithm === listeningCore.ALGORITHM_VERSION) return listening.start(e)
  if (algorithm === progressiveCore.ALGORITHM_VERSION) return progressive.start(e)
  return placement.start(e)
}

function nextQuestion(e) {
  const algorithm = attemptAlgorithm(e)
  if (algorithm === listeningCore.ALGORITHM_VERSION) return listening.nextQuestion(e)
  if (algorithm === progressiveCore.ALGORITHM_VERSION) return progressive.nextQuestion(e)
  return placement.nextQuestion(e)
}

function answer(e) {
  return attemptAlgorithm(e) === progressiveCore.ALGORITHM_VERSION ? progressive.answer(e) : placement.answer(e)
}

function finish(e) {
  const algorithm = attemptAlgorithm(e)
  if (algorithm === listeningCore.ALGORITHM_VERSION) return listening.finish(e)
  if (algorithm === progressiveCore.ALGORITHM_VERSION) return progressive.finish(e)
  return placement.finish(e)
}

function result(e) {
  const algorithm = attemptAlgorithm(e)
  if (algorithm === listeningCore.ALGORITHM_VERSION) return listening.result(e)
  if (algorithm === progressiveCore.ALGORITHM_VERSION) return progressive.result(e)
  return placement.result(e)
}

module.exports = { start, nextQuestion, answer, finish, result }

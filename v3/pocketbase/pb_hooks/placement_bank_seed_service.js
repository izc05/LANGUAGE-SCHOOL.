const placementBank = require(`${__hooks}/placement_bank_v1.js`)
const placementCore = require(`${__hooks}/placement_core.js`)

function firstAdmin(app) {
  return app.findAllRecords('users').find((record) => record.getString('role') === 'ADMIN' && record.getString('status') === 'ACTIVE') || null
}

function seedBaselineBank(app, admin) {
  if (!admin || admin.getString('role') !== 'ADMIN') return false
  const existing = app.findAllRecords('placement_tests')
  if (existing.length > 0) return false

  placementBank.validateBank()
  app.runInTransaction((txApp) => {
    if (txApp.findAllRecords('placement_tests').length > 0) return

    const tests = txApp.findCollectionByNameOrId('placement_tests')
    const questions = txApp.findCollectionByNameOrId('placement_questions')
    const test = new Record(tests)
    test.set('name', placementBank.NAME)
    test.set('version', placementBank.VERSION_HINT)
    test.set('status', 'DRAFT')
    test.set('algorithm_version', 'cefr-v1')
    test.set('public_question_count', placementCore.blueprintQuestionCount(placementCore.PUBLIC_BLUEPRINT))
    test.set('campus_question_count', placementCore.blueprintQuestionCount(placementCore.CAMPUS_BLUEPRINT))
    test.set('public_blueprint', placementCore.PUBLIC_BLUEPRINT)
    test.set('campus_blueprint', placementCore.CAMPUS_BLUEPRINT)
    test.set('campus_retake_days', 30)
    test.set('published_at', '')
    test.set('created_by', admin.id)
    txApp.save(test)

    placementBank.questions.forEach((item, index) => {
      const question = new Record(questions)
      question.set('test', test.id)
      question.set('code', item.code)
      question.set('skill', item.skill)
      question.set('cefr_level', item.level)
      question.set('prompt', item.prompt)
      question.set('passage', item.passage || '')
      question.set('options', item.options)
      question.set('correct_option_id', item.correct)
      question.set('internal_explanation', item.explanation || '')
      question.set('weight', 1)
      question.set('active', true)
      question.set('admin_order', index + 1)
      txApp.save(question)
    })
  })
  return true
}

module.exports = { firstAdmin, seedBaselineBank }

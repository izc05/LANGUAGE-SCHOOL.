migrate((app) => {
  const assessments = app.findCollectionByNameOrId('student_level_assessments')
  assessments.createRule = null
  assessments.updateRule = null
  assessments.deleteRule = null
  app.save(assessments)

  const attempts = app.findCollectionByNameOrId('placement_attempts')
  attempts.updateRule = null
  attempts.deleteRule = null
  app.save(attempts)
}, (app) => {
  const adminOnly = '@request.auth.id != "" && @request.auth.role = "ADMIN"'

  const attempts = app.findCollectionByNameOrId('placement_attempts')
  attempts.updateRule = adminOnly
  attempts.deleteRule = adminOnly
  app.save(attempts)

  const assessments = app.findCollectionByNameOrId('student_level_assessments')
  assessments.createRule = adminOnly
  assessments.updateRule = adminOnly
  assessments.deleteRule = adminOnly
  app.save(assessments)
})

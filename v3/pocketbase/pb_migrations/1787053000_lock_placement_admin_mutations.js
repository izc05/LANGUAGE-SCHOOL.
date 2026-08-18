migrate((app) => {
  const placementTests = app.findCollectionByNameOrId('placement_tests')
  placementTests.updateRule = null
  placementTests.deleteRule = null
  app.save(placementTests)

  const placementQuestions = app.findCollectionByNameOrId('placement_questions')
  placementQuestions.updateRule = null
  placementQuestions.deleteRule = null
  app.save(placementQuestions)
}, (app) => {
  const adminOnly = '@request.auth.id != "" && @request.auth.role = "ADMIN"'

  const placementQuestions = app.findCollectionByNameOrId('placement_questions')
  placementQuestions.updateRule = adminOnly
  placementQuestions.deleteRule = adminOnly
  app.save(placementQuestions)

  const placementTests = app.findCollectionByNameOrId('placement_tests')
  placementTests.updateRule = adminOnly
  placementTests.deleteRule = adminOnly
  app.save(placementTests)
})

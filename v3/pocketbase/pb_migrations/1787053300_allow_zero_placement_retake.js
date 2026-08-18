migrate((app) => {
  const tests = app.findCollectionByNameOrId('placement_tests')
  const field = tests.fields.getByName('campus_retake_days')
  field.required = false
  app.save(tests)
}, (app) => {
  const tests = app.findCollectionByNameOrId('placement_tests')
  const field = tests.fields.getByName('campus_retake_days')
  field.required = true
  app.save(tests)
})

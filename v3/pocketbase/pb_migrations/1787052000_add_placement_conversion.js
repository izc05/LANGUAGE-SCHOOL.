migrate((app) => {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
  const courses = app.findCollectionByNameOrId('courses')
  courses.fields.add(
    new SelectField({
      name: 'cefr_levels',
      maxSelect: levels.length,
      values: levels,
      help: 'Compatibilidad MCER estructurada para recomendaciones del test de nivel. No sustituye el texto visible level.',
    }),
  )
  app.save(courses)

  const attempts = app.findCollectionByNameOrId('placement_attempts')
  const contacts = app.findCollectionByNameOrId('contact_requests')
  contacts.fields.add(
    new RelationField({
      name: 'placement_attempt',
      collectionId: attempts.id,
      maxSelect: 1,
      cascadeDelete: false,
    }),
    new SelectField({ name: 'placement_level', maxSelect: 1, values: levels }),
    new NumberField({ name: 'placement_score', min: 0, max: 100 }),
  )
  contacts.createRule = '@request.body.status = "NEW" && @request.body.placement_attempt:isset = false && @request.body.placement_level:isset = false && @request.body.placement_score:isset = false'
  app.save(contacts)
}, (app) => {
  const contacts = app.findCollectionByNameOrId('contact_requests')
  contacts.fields.removeByName('placement_attempt')
  contacts.fields.removeByName('placement_level')
  contacts.fields.removeByName('placement_score')
  contacts.createRule = '@request.body.status = "NEW"'
  app.save(contacts)

  const courses = app.findCollectionByNameOrId('courses')
  courses.fields.removeByName('cefr_levels')
  app.save(courses)
})

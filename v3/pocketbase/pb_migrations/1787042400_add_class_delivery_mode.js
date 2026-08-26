migrate((app) => {
  const classes = app.findCollectionByNameOrId('classes')

  classes.fields.add(
    new SelectField({ name: 'delivery_mode', maxSelect: 1, values: ['IN_PERSON', 'ONLINE', 'HYBRID'] }),
    new TextField({ name: 'location_text', max: 240 }),
    new TextField({ name: 'online_join_url', max: 2000 }),
  )

  app.save(classes)
}, (app) => {
  const classes = app.findCollectionByNameOrId('classes')
  classes.fields.removeByName('delivery_mode')
  classes.fields.removeByName('location_text')
  classes.fields.removeByName('online_join_url')
  app.save(classes)
})

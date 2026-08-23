migrate((app) => {
  const classes = app.findCollectionByNameOrId('classes')

  classes.fields.add(
    new SelectField({ name: 'video_provider', maxSelect: 1, values: ['ZOOM', 'GOOGLE_MEET', 'MANUAL'] }),
  )

  app.save(classes)
}, (app) => {
  const classes = app.findCollectionByNameOrId('classes')
  classes.fields.removeByName('video_provider')
  app.save(classes)
})

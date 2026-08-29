migrate((app) => {
  const profiles = app.findCollectionByNameOrId('teacher_profiles')

  profiles.fields.add(
    new TextField({ name: 'display_name', max: 160 }),
    new TextField({ name: 'headline', max: 180 }),
    new NumberField({ name: 'sort_order', min: 0, max: 9999, onlyInt: true }),
  )

  app.save(profiles)
}, (app) => {
  const profiles = app.findCollectionByNameOrId('teacher_profiles')
  profiles.fields.removeByName('display_name')
  profiles.fields.removeByName('headline')
  profiles.fields.removeByName('sort_order')
  app.save(profiles)
})

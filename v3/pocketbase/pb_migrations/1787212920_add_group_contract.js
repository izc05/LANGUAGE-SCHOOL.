/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const groups = app.findCollectionByNameOrId('groups')

  groups.fields.add(
    new SelectField({
      name: 'target_level',
      maxSelect: 1,
      values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'MIXED'],
      required: false,
    }),
  )
  groups.fields.add(
    new SelectField({
      name: 'default_delivery_mode',
      maxSelect: 1,
      values: ['IN_PERSON', 'ONLINE', 'HYBRID'],
      required: false,
    }),
  )
  app.save(groups)

  app.db().newQuery(`
    UPDATE groups
    SET target_level = CASE
      WHEN UPPER(TRIM(COALESCE((SELECT level FROM courses WHERE courses.id = groups.course), ''))) IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')
        THEN UPPER(TRIM((SELECT level FROM courses WHERE courses.id = groups.course)))
      ELSE 'MIXED'
    END,
    default_delivery_mode = 'IN_PERSON'
  `).execute()

  const requiredGroups = app.findCollectionByNameOrId('groups')
  requiredGroups.fields.getByName('target_level').required = true
  requiredGroups.fields.getByName('default_delivery_mode').required = true
  app.save(requiredGroups)
}, (app) => {
  const groups = app.findCollectionByNameOrId('groups')
  groups.fields.removeByName('default_delivery_mode')
  groups.fields.removeByName('target_level')
  app.save(groups)
})

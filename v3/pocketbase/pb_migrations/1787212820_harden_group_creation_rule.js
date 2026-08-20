migrate((app) => {
  const groups = app.findCollectionByNameOrId('groups')
  groups.createRule = '@request.auth.role = "ADMIN" && teacher.role = "TEACHER" && teacher.status = "ACTIVE" && course.status = "ACTIVE"'
  app.save(groups)
}, (app) => {
  const groups = app.findCollectionByNameOrId('groups')
  groups.createRule = '@request.auth.role = "ADMIN"'
  app.save(groups)
})

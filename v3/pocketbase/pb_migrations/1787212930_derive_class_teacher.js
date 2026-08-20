/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const classes = app.findCollectionByNameOrId('classes')
  classes.createRule = '@request.auth.role = "ADMIN" && group.status = "ACTIVE" && group.course.status = "ACTIVE" && group.teacher.role = "TEACHER" && group.teacher.status = "ACTIVE"'
  app.save(classes)
}, (app) => {
  const classes = app.findCollectionByNameOrId('classes')
  classes.createRule = '@request.auth.role = "ADMIN" && group.status = "ACTIVE" && group.course.status = "ACTIVE" && teacher.role = "TEACHER" && teacher.status = "ACTIVE" && teacher = group.teacher'
  app.save(classes)
})

migrate((app) => {
  const attendance = app.findCollectionByNameOrId('attendance')

  const teacherScope = '@request.auth.role = "TEACHER" && class.teacher = @request.auth.id && class.group.enrollments_via_group.student ?= student && class.group.enrollments_via_group.status ?= "ACTIVE"'

  attendance.createRule = `@request.auth.role = "ADMIN" || (${teacherScope})`
  attendance.updateRule = `@request.auth.role = "ADMIN" || (${teacherScope} && @request.body.class:changed = false && @request.body.student:changed = false)`
  app.save(attendance)
}, (app) => {
  const attendance = app.findCollectionByNameOrId('attendance')
  attendance.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && class.teacher = @request.auth.id)'
  attendance.updateRule = '@request.auth.role = "ADMIN" || class.teacher = @request.auth.id'
  app.save(attendance)
})

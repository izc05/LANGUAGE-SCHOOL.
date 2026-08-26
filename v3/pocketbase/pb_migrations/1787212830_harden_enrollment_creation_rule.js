migrate((app) => {
  const enrollments = app.findCollectionByNameOrId('enrollments')
  enrollments.createRule = '@request.auth.role = "ADMIN" && student.role = "STUDENT" && student.status = "ACTIVE" && group.status = "ACTIVE" && group.course.status = "ACTIVE" && group.teacher.role = "TEACHER" && group.teacher.status = "ACTIVE"'
  enrollments.updateRule = '@request.auth.role = "ADMIN" && @request.body.student:changed = false && @request.body.group:changed = false'
  app.save(enrollments)
}, (app) => {
  const enrollments = app.findCollectionByNameOrId('enrollments')
  enrollments.createRule = '@request.auth.role = "ADMIN"'
  enrollments.updateRule = '@request.auth.role = "ADMIN"'
  app.save(enrollments)
})

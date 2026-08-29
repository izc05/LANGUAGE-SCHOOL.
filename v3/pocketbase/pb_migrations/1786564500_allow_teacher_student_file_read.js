migrate((app) => {
  const files = app.findCollectionByNameOrId('student_files')
  files.listRule = 'student = @request.auth.id || @request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && student.enrollments_via_student.group.teacher ?= @request.auth.id && student.enrollments_via_student.status ?= "ACTIVE")'
  files.viewRule = files.listRule
  app.save(files)
}, (app) => {
  const files = app.findCollectionByNameOrId('student_files')
  files.listRule = 'student = @request.auth.id || @request.auth.role = "ADMIN"'
  files.viewRule = files.listRule
  app.save(files)
})

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.listRule = '@request.auth.id = id || @request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && role = "STUDENT" && enrollments_via_student.group.teacher ?= @request.auth.id && enrollments_via_student.status ?= "ACTIVE")'
  users.viewRule = users.listRule
  app.save(users)

  const studentProfiles = app.findCollectionByNameOrId('student_profiles')
  studentProfiles.listRule = '@request.auth.role = "ADMIN" || user = @request.auth.id || (@request.auth.role = "TEACHER" && user.enrollments_via_student.group.teacher ?= @request.auth.id && user.enrollments_via_student.status ?= "ACTIVE")'
  studentProfiles.viewRule = studentProfiles.listRule
  app.save(studentProfiles)
}, (app) => {
  const studentProfiles = app.findCollectionByNameOrId('student_profiles')
  studentProfiles.listRule = '@request.auth.role = "ADMIN" || user = @request.auth.id'
  studentProfiles.viewRule = studentProfiles.listRule
  app.save(studentProfiles)

  const users = app.findCollectionByNameOrId('users')
  users.listRule = '@request.auth.id = id || @request.auth.role = "ADMIN"'
  users.viewRule = users.listRule
  app.save(users)
})

migrate((app) => {
  const studentProfiles = app.findCollectionByNameOrId('student_profiles')
  studentProfiles.updateRule = '@request.auth.role = "ADMIN" && @request.body.active:changed = false'
  app.save(studentProfiles)

  const teacherProfiles = app.findCollectionByNameOrId('teacher_profiles')
  teacherProfiles.updateRule = '@request.auth.role = "ADMIN" && @request.body.active:changed = false'
  app.save(teacherProfiles)
}, (app) => {
  const studentProfiles = app.findCollectionByNameOrId('student_profiles')
  studentProfiles.updateRule = '@request.auth.role = "ADMIN"'
  app.save(studentProfiles)

  const teacherProfiles = app.findCollectionByNameOrId('teacher_profiles')
  teacherProfiles.updateRule = '@request.auth.role = "ADMIN"'
  app.save(teacherProfiles)
})

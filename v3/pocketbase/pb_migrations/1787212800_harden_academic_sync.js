migrate((app) => {
  const teacherProfiles = app.findCollectionByNameOrId('teacher_profiles')
  const publicTeacherRule = '@request.auth.role = "ADMIN" || user = @request.auth.id || (public_profile = true && active = true && user.status = "ACTIVE")'
  teacherProfiles.listRule = publicTeacherRule
  teacherProfiles.viewRule = publicTeacherRule
  app.save(teacherProfiles)

  const enrollments = app.findCollectionByNameOrId('enrollments')
  enrollments.removeIndex('idx_enrollments_student_group')
  enrollments.addIndex('idx_enrollments_student_group', false, 'student, `group`', '')
  enrollments.addIndex('idx_enrollments_one_active_student', true, 'student', 'status = "ACTIVE"')
  app.save(enrollments)
}, (app) => {
  const enrollments = app.findCollectionByNameOrId('enrollments')
  enrollments.removeIndex('idx_enrollments_one_active_student')
  enrollments.removeIndex('idx_enrollments_student_group')
  enrollments.addIndex('idx_enrollments_student_group', true, 'student, `group`', '')
  app.save(enrollments)

  const teacherProfiles = app.findCollectionByNameOrId('teacher_profiles')
  teacherProfiles.listRule = 'public_profile = true || @request.auth.role = "ADMIN" || user = @request.auth.id'
  teacherProfiles.viewRule = 'public_profile = true || @request.auth.role = "ADMIN" || user = @request.auth.id'
  app.save(teacherProfiles)
})

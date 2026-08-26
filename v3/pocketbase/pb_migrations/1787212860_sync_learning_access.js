migrate((app) => {
  const materials = app.findCollectionByNameOrId('materials')
  materials.listRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && (teacher = @request.auth.id || (visibility = "GROUP" && group.teacher = @request.auth.id) || (visibility = "STUDENT" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id))) || (published = true && @request.auth.role = "STUDENT" && (student = @request.auth.id || (visibility = "GROUP" && @collection.enrollments.student ?= @request.auth.id && @collection.enrollments.group ?= group && @collection.enrollments.status ?= "ACTIVE") || (visibility = "COURSE" && @collection.enrollments.student ?= @request.auth.id && @collection.enrollments.group.course ?= course && @collection.enrollments.status ?= "ACTIVE")))'
  materials.viewRule = materials.listRule
  materials.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && ((visibility = "GROUP" && group.teacher = @request.auth.id && group.status = "ACTIVE" && student = "" && course = "") || (visibility = "STUDENT" && student != "" && group = "" && course = "" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)))'
  materials.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && @request.body.teacher:changed = false && @request.body.visibility:changed = false && @request.body.group:changed = false && @request.body.student:changed = false && @request.body.course:changed = false && ((visibility = "GROUP" && group.teacher = @request.auth.id && group.status = "ACTIVE") || (visibility = "STUDENT" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)))'
  materials.deleteRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && ((visibility = "GROUP" && group.teacher = @request.auth.id) || (visibility = "STUDENT" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)))'
  app.save(materials)

  const assignments = app.findCollectionByNameOrId('assignments')
  assignments.listRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && (teacher = @request.auth.id || group.teacher = @request.auth.id || (student != "" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id))) || (@request.auth.role = "STUDENT" && status != "DRAFT" && (student = @request.auth.id || (group != "" && @collection.enrollments.student ?= @request.auth.id && @collection.enrollments.group ?= group && @collection.enrollments.status ?= "ACTIVE") || (@collection.assignment_submissions.assignment ?= id && @collection.assignment_submissions.student ?= @request.auth.id)))'
  assignments.viewRule = assignments.listRule
  assignments.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && ((group != "" && group.teacher = @request.auth.id && group.status = "ACTIVE" && student = "") || (group = "" && student != "" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)))'
  assignments.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && @request.body.teacher:changed = false && @request.body.group:changed = false && @request.body.student:changed = false && ((group != "" && group.teacher = @request.auth.id && group.status = "ACTIVE") || (group = "" && student != "" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)))'
  assignments.deleteRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && ((group != "" && group.teacher = @request.auth.id) || (group = "" && student != "" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)))'
  app.save(assignments)

  const submissions = app.findCollectionByNameOrId('assignment_submissions')
  submissions.listRule = '@request.auth.role = "ADMIN" || student = @request.auth.id || (@request.auth.role = "TEACHER" && (assignment.teacher = @request.auth.id || assignment.group.teacher = @request.auth.id || @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id))'
  submissions.viewRule = submissions.listRule
  submissions.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "STUDENT" && student = @request.auth.id && assignment.status = "PUBLISHED" && (assignment.student = @request.auth.id || (assignment.group != "" && @collection.enrollments.student ?= @request.auth.id && @collection.enrollments.group ?= assignment.group && @collection.enrollments.status ?= "ACTIVE")))'
  submissions.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && @request.body.assignment:changed = false && @request.body.student:changed = false && ((assignment.group != "" && assignment.group.teacher = @request.auth.id) || (assignment.group = "" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id))) || (@request.auth.role = "STUDENT" && student = @request.auth.id && status = "SUBMITTED" && @request.body.student:changed = false && @request.body.assignment:changed = false && @request.body.teacher_feedback:changed = false && @request.body.grade_text:changed = false && @request.body.status:changed = false)'
  app.save(submissions)

  const files = app.findCollectionByNameOrId('student_files')
  files.listRule = 'student = @request.auth.id || @request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && @collection.enrollments.student ?= student && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)'
  files.viewRule = files.listRule
  app.save(files)

  const notifications = app.findCollectionByNameOrId('notifications')
  notifications.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && created_by = @request.auth.id && @collection.enrollments.student ?= recipient && @collection.enrollments.status ?= "ACTIVE" && @collection.enrollments.group.teacher ?= @request.auth.id)'
  app.save(notifications)
}, (app) => {
  const notifications = app.findCollectionByNameOrId('notifications')
  notifications.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && created_by = @request.auth.id && recipient.enrollments_via_student.group.teacher ?= @request.auth.id && recipient.enrollments_via_student.status ?= "ACTIVE")'
  app.save(notifications)

  const files = app.findCollectionByNameOrId('student_files')
  files.listRule = 'student = @request.auth.id || @request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && student.enrollments_via_student.group.teacher ?= @request.auth.id && student.enrollments_via_student.status ?= "ACTIVE")'
  files.viewRule = files.listRule
  app.save(files)

  const submissions = app.findCollectionByNameOrId('assignment_submissions')
  submissions.listRule = '@request.auth.role = "ADMIN" || student = @request.auth.id || assignment.teacher = @request.auth.id'
  submissions.viewRule = submissions.listRule
  submissions.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "STUDENT" && student = @request.auth.id && (assignment.student = @request.auth.id || assignment.group.enrollments_via_group.student ?= @request.auth.id))'
  submissions.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && assignment.teacher = @request.auth.id && @request.body.assignment:changed = false && @request.body.student:changed = false) || (@request.auth.role = "STUDENT" && student = @request.auth.id && status = "SUBMITTED" && @request.body.student:changed = false && @request.body.assignment:changed = false && @request.body.teacher_feedback:changed = false && @request.body.grade_text:changed = false && @request.body.status:changed = false)'
  app.save(submissions)

  const assignments = app.findCollectionByNameOrId('assignments')
  assignments.listRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id || (@request.auth.role = "STUDENT" && status != "DRAFT" && (student = @request.auth.id || group.enrollments_via_group.student ?= @request.auth.id))'
  assignments.viewRule = assignments.listRule
  assignments.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && ((group.teacher = @request.auth.id && student = "") || (group = "" && student.enrollments_via_student.group.teacher ?= @request.auth.id && student.enrollments_via_student.status ?= "ACTIVE")))'
  assignments.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && @request.body.teacher:changed = false && @request.body.group:changed = false && @request.body.student:changed = false)'
  assignments.deleteRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id'
  app.save(assignments)

  const materials = app.findCollectionByNameOrId('materials')
  materials.listRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id || (published = true && @request.auth.role = "STUDENT" && (student = @request.auth.id || group.enrollments_via_group.student ?= @request.auth.id || course.groups_via_course.enrollments_via_group.student ?= @request.auth.id))'
  materials.viewRule = materials.listRule
  materials.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && ((visibility = "GROUP" && group.teacher = @request.auth.id && student = "" && course = "") || (visibility = "STUDENT" && student.enrollments_via_student.group.teacher ?= @request.auth.id && student.enrollments_via_student.status ?= "ACTIVE" && group = "" && course = "")))'
  materials.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && @request.body.teacher:changed = false && @request.body.visibility:changed = false && @request.body.group:changed = false && @request.body.student:changed = false && @request.body.course:changed = false)'
  materials.deleteRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id'
  app.save(materials)
})

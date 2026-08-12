migrate((app) => {
  const classes = app.findCollectionByNameOrId('classes')
  classes.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && group.teacher = @request.auth.id)'
  classes.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && group.teacher = @request.auth.id && @request.body.teacher:changed = false && @request.body.group:changed = false)'
  app.save(classes)

  const materials = app.findCollectionByNameOrId('materials')
  materials.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && ((visibility = "GROUP" && group.teacher = @request.auth.id && student = "" && course = "") || (visibility = "STUDENT" && student.enrollments_via_student.group.teacher ?= @request.auth.id && student.enrollments_via_student.status ?= "ACTIVE" && group = "" && course = "")))'
  materials.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && @request.body.teacher:changed = false && @request.body.visibility:changed = false && @request.body.group:changed = false && @request.body.student:changed = false && @request.body.course:changed = false)'
  app.save(materials)

  const assignments = app.findCollectionByNameOrId('assignments')
  assignments.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && ((group.teacher = @request.auth.id && student = "") || (group = "" && student.enrollments_via_student.group.teacher ?= @request.auth.id && student.enrollments_via_student.status ?= "ACTIVE")))'
  assignments.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id && @request.body.teacher:changed = false && @request.body.group:changed = false && @request.body.student:changed = false)'
  app.save(assignments)

  const submissions = app.findCollectionByNameOrId('assignment_submissions')
  submissions.updateRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && assignment.teacher = @request.auth.id && @request.body.assignment:changed = false && @request.body.student:changed = false) || (@request.auth.role = "STUDENT" && student = @request.auth.id && status = "SUBMITTED" && @request.body.student:changed = false && @request.body.assignment:changed = false && @request.body.teacher_feedback:changed = false && @request.body.grade_text:changed = false && @request.body.status:changed = false)'
  app.save(submissions)

  const notifications = app.findCollectionByNameOrId('notifications')
  notifications.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && created_by = @request.auth.id && recipient.enrollments_via_student.group.teacher ?= @request.auth.id && recipient.enrollments_via_student.status ?= "ACTIVE")'
  app.save(notifications)
}, (app) => {
  const notifications = app.findCollectionByNameOrId('notifications')
  notifications.createRule = '@request.auth.role = "ADMIN" || @request.auth.role = "TEACHER"'
  app.save(notifications)

  const submissions = app.findCollectionByNameOrId('assignment_submissions')
  submissions.updateRule = '@request.auth.role = "ADMIN" || assignment.teacher = @request.auth.id || (student = @request.auth.id && status = "SUBMITTED" && @request.body.student:changed = false && @request.body.assignment:changed = false && @request.body.teacher_feedback:changed = false && @request.body.grade_text:changed = false && @request.body.status:changed = false)'
  app.save(submissions)

  const assignments = app.findCollectionByNameOrId('assignments')
  assignments.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id)'
  assignments.updateRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id'
  app.save(assignments)

  const materials = app.findCollectionByNameOrId('materials')
  materials.createRule = '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && teacher = @request.auth.id)'
  materials.updateRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id'
  app.save(materials)

  const classes = app.findCollectionByNameOrId('classes')
  classes.createRule = '@request.auth.role = "ADMIN"'
  classes.updateRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id'
  app.save(classes)
})

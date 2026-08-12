migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const courses = app.findCollectionByNameOrId('courses')
  const groups = app.findCollectionByNameOrId('groups')
  const classes = app.findCollectionByNameOrId('classes')

  // Students may view only groups/courses that are reachable through their
  // own ACTIVE enrollment. Admin and teacher behavior remains unchanged.
  groups.listRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id || (@request.auth.role = "STUDENT" && enrollments_via_group.student ?= @request.auth.id && enrollments_via_group.status ?= "ACTIVE")'
  groups.viewRule = groups.listRule
  app.save(groups)

  courses.listRule = '(public_visible = true && status = "ACTIVE") || @request.auth.role = "ADMIN" || @request.auth.role = "TEACHER" || (@request.auth.role = "STUDENT" && groups_via_course.enrollments_via_group.student ?= @request.auth.id && groups_via_course.enrollments_via_group.status ?= "ACTIVE")'
  courses.viewRule = courses.listRule
  app.save(courses)

  const attendance = new Collection({
    type: 'base',
    name: 'attendance',
    listRule: '@request.auth.role = "ADMIN" || student = @request.auth.id || class.teacher = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || student = @request.auth.id || class.teacher = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && @request.body.class.teacher = @request.auth.id)',
    updateRule: '@request.auth.role = "ADMIN" || class.teacher = @request.auth.id',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'relation', name: 'class', required: true, maxSelect: 1, collectionId: classes.id, cascadeDelete: true },
      { type: 'relation', name: 'student', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['PRESENT', 'ABSENT', 'JUSTIFIED'] },
      { type: 'text', name: 'notes', max: 1000 },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_attendance_class_student ON attendance (`class`, student)',
      'CREATE INDEX idx_attendance_student_status ON attendance (student, status)',
    ],
  })
  app.save(attendance)

  const materials = new Collection({
    type: 'base',
    name: 'materials',
    listRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id || (published = true && @request.auth.role = "STUDENT" && (student = @request.auth.id || group.enrollments_via_group.student ?= @request.auth.id || course.groups_via_course.enrollments_via_group.student ?= @request.auth.id))',
    viewRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id || (published = true && @request.auth.role = "STUDENT" && (student = @request.auth.id || group.enrollments_via_group.student ?= @request.auth.id || course.groups_via_course.enrollments_via_group.student ?= @request.auth.id))',
    createRule: '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && @request.body.teacher = @request.auth.id)',
    updateRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id',
    deleteRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id',
    fields: [
      { type: 'text', name: 'title', required: true, max: 220 },
      { type: 'text', name: 'description', max: 1800 },
      {
        type: 'file',
        name: 'file',
        required: true,
        maxSelect: 1,
        maxSize: 20971520,
        protected: true,
        mimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'audio/mpeg',
          'audio/mp4',
          'image/jpeg',
          'image/png',
          'image/webp',
        ],
      },
      { type: 'relation', name: 'teacher', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'relation', name: 'course', maxSelect: 1, collectionId: courses.id, cascadeDelete: false },
      { type: 'relation', name: 'group', maxSelect: 1, collectionId: groups.id, cascadeDelete: false },
      { type: 'relation', name: 'student', maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'select', name: 'visibility', required: true, maxSelect: 1, values: ['COURSE', 'GROUP', 'STUDENT'] },
      { type: 'bool', name: 'published' },
    ],
    indexes: [
      'CREATE INDEX idx_materials_student_created ON materials (student, created)',
      'CREATE INDEX idx_materials_group_created ON materials (`group`, created)',
      'CREATE INDEX idx_materials_course_created ON materials (course, created)',
    ],
  })
  app.save(materials)

  const assignments = new Collection({
    type: 'base',
    name: 'assignments',
    listRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id || (@request.auth.role = "STUDENT" && status != "DRAFT" && (student = @request.auth.id || group.enrollments_via_group.student ?= @request.auth.id))',
    viewRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id || (@request.auth.role = "STUDENT" && status != "DRAFT" && (student = @request.auth.id || group.enrollments_via_group.student ?= @request.auth.id))',
    createRule: '@request.auth.role = "ADMIN" || (@request.auth.role = "TEACHER" && @request.body.teacher = @request.auth.id)',
    updateRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id',
    deleteRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id',
    fields: [
      { type: 'text', name: 'title', required: true, max: 220 },
      { type: 'editor', name: 'description', maxSize: 30000 },
      { type: 'relation', name: 'teacher', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'relation', name: 'group', maxSelect: 1, collectionId: groups.id, cascadeDelete: true },
      { type: 'relation', name: 'student', maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      {
        type: 'file',
        name: 'attachment',
        maxSelect: 1,
        maxSize: 20971520,
        protected: true,
        mimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'audio/mpeg',
          'image/jpeg',
          'image/png',
          'image/webp',
        ],
      },
      { type: 'date', name: 'due_at' },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['DRAFT', 'PUBLISHED', 'CLOSED'] },
    ],
    indexes: [
      'CREATE INDEX idx_assignments_group_due ON assignments (`group`, due_at)',
      'CREATE INDEX idx_assignments_student_due ON assignments (student, due_at)',
      'CREATE INDEX idx_assignments_teacher_status ON assignments (teacher, status)',
    ],
  })
  app.save(assignments)

  const submissions = new Collection({
    type: 'base',
    name: 'assignment_submissions',
    listRule: '@request.auth.role = "ADMIN" || student = @request.auth.id || assignment.teacher = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || student = @request.auth.id || assignment.teacher = @request.auth.id',
    // Student creation remains deliberately narrow: the student must own the
    // submission and the referenced assignment must be visible to that token.
    // PocketBase will hide inaccessible assignment records via its rules.
    createRule: '@request.auth.role = "ADMIN" || (@request.auth.role = "STUDENT" && @request.body.student = @request.auth.id)',
    updateRule: '@request.auth.role = "ADMIN" || assignment.teacher = @request.auth.id || (student = @request.auth.id && status = "SUBMITTED" && @request.body.student:changed = false && @request.body.assignment:changed = false && @request.body.teacher_feedback:changed = false && @request.body.grade_text:changed = false && @request.body.status:changed = false)',
    deleteRule: '@request.auth.role = "ADMIN" || (student = @request.auth.id && status = "SUBMITTED")',
    fields: [
      { type: 'relation', name: 'assignment', required: true, maxSelect: 1, collectionId: assignments.id, cascadeDelete: true },
      { type: 'relation', name: 'student', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      {
        type: 'file',
        name: 'file',
        maxSelect: 1,
        maxSize: 20971520,
        protected: true,
        mimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'audio/mpeg',
          'audio/mp4',
          'image/jpeg',
          'image/png',
          'image/webp',
        ],
      },
      { type: 'editor', name: 'text_answer', maxSize: 30000 },
      { type: 'date', name: 'submitted_at' },
      { type: 'editor', name: 'teacher_feedback', maxSize: 30000 },
      { type: 'text', name: 'grade_text', max: 80 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['SUBMITTED', 'REVIEWED', 'RETURNED'] },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_submissions_assignment_student ON assignment_submissions (assignment, student)',
      'CREATE INDEX idx_submissions_student_status ON assignment_submissions (student, status)',
    ],
  })
  app.save(submissions)

  const notifications = new Collection({
    type: 'base',
    name: 'notifications',
    listRule: '@request.auth.role = "ADMIN" || recipient = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || recipient = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN" || @request.auth.role = "TEACHER"',
    updateRule: '@request.auth.role = "ADMIN" || (recipient = @request.auth.id && @request.body.recipient:changed = false && @request.body.title:changed = false && @request.body.body:changed = false && @request.body.type:changed = false && @request.body.created_by:changed = false)',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'relation', name: 'recipient', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'text', name: 'title', required: true, max: 220 },
      { type: 'text', name: 'body', required: true, max: 3000 },
      { type: 'select', name: 'type', required: true, maxSelect: 1, values: ['GENERAL', 'CLASS', 'MATERIAL', 'ASSIGNMENT', 'SYSTEM'] },
      { type: 'date', name: 'read_at' },
      { type: 'relation', name: 'created_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
    ],
    indexes: [
      'CREATE INDEX idx_notifications_recipient_read ON notifications (recipient, read_at)',
      'CREATE INDEX idx_notifications_recipient_created ON notifications (recipient, created)',
    ],
  })
  app.save(notifications)
}, (app) => {
  for (const name of ['notifications', 'assignment_submissions', 'assignments', 'materials', 'attendance']) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      app.delete(collection)
    } catch {
      // Safe rollback when a collection is already absent.
    }
  }

  const courses = app.findCollectionByNameOrId('courses')
  courses.listRule = '(public_visible = true && status = "ACTIVE") || @request.auth.role = "ADMIN" || @request.auth.role = "TEACHER"'
  courses.viewRule = courses.listRule
  app.save(courses)

  const groups = app.findCollectionByNameOrId('groups')
  groups.listRule = '@request.auth.role = "ADMIN" || teacher = @request.auth.id'
  groups.viewRule = groups.listRule
  app.save(groups)
})

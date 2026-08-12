migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const courses = app.findCollectionByNameOrId('courses')

  const groups = new Collection({
    type: 'base',
    name: 'groups',
    listRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'name', required: true, max: 160 },
      { type: 'relation', name: 'course', required: true, maxSelect: 1, collectionId: courses.id, cascadeDelete: false },
      { type: 'relation', name: 'teacher', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'text', name: 'academic_year', required: true, max: 20 },
      { type: 'text', name: 'schedule_text', max: 250 },
      { type: 'number', name: 'capacity', required: true, min: 1, max: 100, onlyInt: true },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED'] },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE INDEX idx_groups_course_status ON groups (course, status)',
      'CREATE INDEX idx_groups_teacher_status ON groups (teacher, status)',
    ],
  })
  app.save(groups)

  const enrollments = new Collection({
    type: 'base',
    name: 'enrollments',
    listRule: '@request.auth.role = "ADMIN" || student = @request.auth.id || group.teacher = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || student = @request.auth.id || group.teacher = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'relation', name: 'student', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'relation', name: 'group', required: true, maxSelect: 1, collectionId: groups.id, cascadeDelete: true },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['ACTIVE', 'PAUSED', 'FINISHED', 'CANCELLED'] },
      { type: 'date', name: 'joined_at', required: true },
      { type: 'date', name: 'ended_at' },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_enrollments_student_group ON enrollments (student, `group`)',
      'CREATE INDEX idx_enrollments_student_status ON enrollments (student, status)',
    ],
  })
  app.save(enrollments)

  const classes = new Collection({
    type: 'base',
    name: 'classes',
    listRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id || group.teacher = @request.auth.id || (@request.auth.role = "STUDENT" && @collection.enrollments.student ?= @request.auth.id && @collection.enrollments.group ?= group && @collection.enrollments.status ?= "ACTIVE")',
    viewRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id || group.teacher = @request.auth.id || (@request.auth.role = "STUDENT" && @collection.enrollments.student ?= @request.auth.id && @collection.enrollments.group ?= group && @collection.enrollments.status ?= "ACTIVE")',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN" || teacher = @request.auth.id',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'relation', name: 'group', required: true, maxSelect: 1, collectionId: groups.id, cascadeDelete: true },
      { type: 'relation', name: 'teacher', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'date', name: 'starts_at', required: true },
      { type: 'date', name: 'ends_at', required: true },
      { type: 'text', name: 'topic', required: true, max: 220 },
      { type: 'editor', name: 'description', maxSize: 20000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['SCHEDULED', 'COMPLETED', 'CANCELLED'] },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE INDEX idx_classes_group_start ON classes (`group`, starts_at)',
      'CREATE INDEX idx_classes_teacher_start ON classes (teacher, starts_at)',
      'CREATE INDEX idx_classes_status_start ON classes (status, starts_at)',
    ],
  })
  app.save(classes)

  const studentFiles = new Collection({
    type: 'base',
    name: 'student_files',
    listRule: '@request.auth.role = "ADMIN" || student = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || student = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN" || (@request.auth.role = "STUDENT" && @request.body.student = @request.auth.id && @request.body.uploaded_by = @request.auth.id)',
    updateRule: '@request.auth.role = "ADMIN" || (student = @request.auth.id && @request.body.student:changed = false && @request.body.uploaded_by:changed = false)',
    deleteRule: '@request.auth.role = "ADMIN" || student = @request.auth.id',
    fields: [
      { type: 'text', name: 'title', required: true, max: 220 },
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
      { type: 'relation', name: 'student', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'relation', name: 'uploaded_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'select', name: 'category', required: true, maxSelect: 1, values: ['MATERIAL', 'HOMEWORK', 'AUDIO', 'DOCUMENT', 'OTHER'] },
      { type: 'text', name: 'description', max: 1000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['ACTIVE', 'ARCHIVED'] },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE INDEX idx_student_files_student_created ON student_files (student, created)',
    ],
  })
  app.save(studentFiles)
}, (app) => {
  for (const name of ['student_files', 'classes', 'enrollments', 'groups']) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      app.delete(collection)
    } catch {
      // Safe rollback when a collection is already absent.
    }
  }
})

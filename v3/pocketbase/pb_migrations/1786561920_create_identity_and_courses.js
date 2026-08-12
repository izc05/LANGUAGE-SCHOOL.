migrate((app) => {
  const users = new Collection({
    type: 'auth',
    name: 'users',
    listRule: '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "ADMIN")',
    viewRule: '@request.auth.id != "" && (id = @request.auth.id || @request.auth.role = "ADMIN")',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN" || (id = @request.auth.id && @request.body.role:changed = false && @request.body.status:changed = false)',
    deleteRule: '@request.auth.role = "ADMIN" && id != @request.auth.id',
    authRule: 'status = "ACTIVE"',
    manageRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'name', required: true, max: 100 },
      { type: 'text', name: 'surname', required: true, max: 120 },
      { type: 'select', name: 'role', required: true, maxSelect: 1, values: ['ADMIN', 'TEACHER', 'STUDENT'] },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
      {
        type: 'file',
        name: 'avatar',
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['100x100', '300x300'],
      },
      { type: 'text', name: 'phone', max: 30 },
    ],
    passwordAuth: {
      enabled: true,
      identityFields: ['email'],
    },
    otp: { enabled: false },
    oauth2: { enabled: false },
  })
  app.save(users)

  const studentProfiles = new Collection({
    type: 'base',
    name: 'student_profiles',
    listRule: '@request.auth.role = "ADMIN" || user = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || user = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'date', name: 'birth_date' },
      { type: 'text', name: 'guardian_name', max: 160 },
      { type: 'text', name: 'guardian_phone', max: 30 },
      { type: 'editor', name: 'notes_private', maxSize: 10000 },
      { type: 'bool', name: 'active' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_student_profiles_user ON student_profiles (user)',
    ],
  })
  app.save(studentProfiles)

  const teacherProfiles = new Collection({
    type: 'base',
    name: 'teacher_profiles',
    listRule: 'public_profile = true || @request.auth.role = "ADMIN" || user = @request.auth.id',
    viewRule: 'public_profile = true || @request.auth.role = "ADMIN" || user = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'editor', name: 'bio', maxSize: 20000 },
      { type: 'json', name: 'specialties', maxSize: 10000 },
      {
        type: 'file',
        name: 'public_photo',
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['300x300', '800x800'],
      },
      { type: 'bool', name: 'public_profile' },
      { type: 'bool', name: 'active' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_teacher_profiles_user ON teacher_profiles (user)',
    ],
  })
  app.save(teacherProfiles)

  const courses = new Collection({
    type: 'base',
    name: 'courses',
    listRule: '(public_visible = true && status = "ACTIVE") || @request.auth.role = "ADMIN" || @request.auth.role = "TEACHER"',
    viewRule: '(public_visible = true && status = "ACTIVE") || @request.auth.role = "ADMIN" || @request.auth.role = "TEACHER"',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'text', name: 'title', required: true, max: 160 },
      { type: 'text', name: 'slug', required: true, max: 180, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
      { type: 'text', name: 'level', max: 40 },
      { type: 'editor', name: 'description', maxSize: 40000 },
      {
        type: 'file',
        name: 'cover_image',
        maxSelect: 1,
        maxSize: 8388608,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        thumbs: ['600x400', '1200x800'],
      },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['DRAFT', 'ACTIVE', 'ARCHIVED'] },
      { type: 'bool', name: 'public_visible' },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_courses_slug ON courses (slug)',
      'CREATE INDEX idx_courses_public_status ON courses (public_visible, status)',
    ],
  })
  app.save(courses)
}, (app) => {
  for (const name of ['courses', 'teacher_profiles', 'student_profiles', 'users']) {
    try {
      const collection = app.findCollectionByNameOrId(name)
      app.delete(collection)
    } catch {
      // Allows safe rollback if a previous collection was already absent.
    }
  }
})

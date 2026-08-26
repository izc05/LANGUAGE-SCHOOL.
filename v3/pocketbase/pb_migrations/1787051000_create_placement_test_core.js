migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  const adminOnly = '@request.auth.id != "" && @request.auth.role = "ADMIN"'

  const placementTests = new Collection({
    type: 'base',
    name: 'placement_tests',
    listRule: adminOnly,
    viewRule: adminOnly,
    createRule: adminOnly,
    updateRule: adminOnly,
    deleteRule: adminOnly,
    fields: [
      { type: 'text', name: 'name', required: true, max: 180 },
      { type: 'text', name: 'version', required: true, max: 40 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
      { type: 'text', name: 'algorithm_version', required: true, max: 40 },
      { type: 'number', name: 'public_question_count', required: true, min: 1, max: 100, onlyInt: true },
      { type: 'number', name: 'campus_question_count', required: true, min: 1, max: 200, onlyInt: true },
      { type: 'json', name: 'public_blueprint', required: true, maxSize: 30000 },
      { type: 'json', name: 'campus_blueprint', required: true, maxSize: 50000 },
      { type: 'number', name: 'campus_retake_days', required: true, min: 0, max: 3650, onlyInt: true },
      { type: 'date', name: 'published_at' },
      { type: 'relation', name: 'created_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_placement_tests_version ON placement_tests (version)',
      "CREATE UNIQUE INDEX idx_placement_tests_single_published ON placement_tests (status) WHERE status = 'PUBLISHED'",
      'CREATE INDEX idx_placement_tests_status ON placement_tests (status)',
    ],
  })
  app.save(placementTests)

  const placementQuestions = new Collection({
    type: 'base',
    name: 'placement_questions',
    listRule: adminOnly,
    viewRule: adminOnly,
    createRule: adminOnly,
    updateRule: adminOnly,
    deleteRule: adminOnly,
    fields: [
      { type: 'relation', name: 'test', required: true, maxSelect: 1, collectionId: placementTests.id, cascadeDelete: true },
      { type: 'text', name: 'code', required: true, max: 100 },
      { type: 'select', name: 'skill', required: true, maxSelect: 1, values: ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING'] },
      { type: 'select', name: 'cefr_level', required: true, maxSelect: 1, values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      { type: 'editor', name: 'prompt', required: true, maxSize: 12000 },
      { type: 'editor', name: 'passage', maxSize: 30000 },
      {
        type: 'file',
        name: 'audio',
        maxSelect: 1,
        maxSize: 20971520,
        protected: true,
        mimeTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav'],
      },
      { type: 'json', name: 'options', required: true, maxSize: 20000 },
      { type: 'text', name: 'correct_option_id', required: true, max: 80 },
      { type: 'editor', name: 'internal_explanation', maxSize: 20000 },
      { type: 'number', name: 'weight', required: true, min: 0.1, max: 100 },
      { type: 'bool', name: 'active' },
      { type: 'number', name: 'admin_order', min: 0, max: 1000000, onlyInt: true },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_placement_questions_test_code ON placement_questions (test, code)',
      'CREATE INDEX idx_placement_questions_pool ON placement_questions (test, active, skill, cefr_level)',
    ],
  })
  app.save(placementQuestions)

  const placementAttempts = new Collection({
    type: 'base',
    name: 'placement_attempts',
    listRule: adminOnly,
    viewRule: adminOnly,
    createRule: adminOnly,
    updateRule: adminOnly,
    deleteRule: adminOnly,
    fields: [
      { type: 'relation', name: 'test', required: true, maxSelect: 1, collectionId: placementTests.id, cascadeDelete: false },
      { type: 'select', name: 'mode', required: true, maxSelect: 1, values: ['PUBLIC', 'CAMPUS'] },
      { type: 'relation', name: 'student', maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'text', name: 'public_token_hash', max: 64 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED', 'ABANDONED'] },
      { type: 'text', name: 'algorithm_version', required: true, max: 40 },
      { type: 'json', name: 'selection_snapshot', required: true, maxSize: 100000 },
      { type: 'date', name: 'started_at', required: true },
      { type: 'date', name: 'completed_at' },
      { type: 'number', name: 'raw_score', min: 0, max: 1000, onlyInt: true },
      { type: 'number', name: 'max_score', min: 0, max: 1000, onlyInt: true },
      { type: 'number', name: 'score_percent', min: 0, max: 100 },
      { type: 'select', name: 'estimated_level', maxSelect: 1, values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      { type: 'json', name: 'skill_scores', maxSize: 20000 },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE INDEX idx_placement_attempts_student_created ON placement_attempts (student, created)',
      'CREATE INDEX idx_placement_attempts_public_token ON placement_attempts (public_token_hash)',
      'CREATE INDEX idx_placement_attempts_status ON placement_attempts (status)',
    ],
  })
  app.save(placementAttempts)

  const placementAnswers = new Collection({
    type: 'base',
    name: 'placement_answers',
    listRule: adminOnly,
    viewRule: adminOnly,
    createRule: adminOnly,
    updateRule: adminOnly,
    deleteRule: adminOnly,
    fields: [
      { type: 'relation', name: 'attempt', required: true, maxSelect: 1, collectionId: placementAttempts.id, cascadeDelete: true },
      { type: 'relation', name: 'question', required: true, maxSelect: 1, collectionId: placementQuestions.id, cascadeDelete: false },
      { type: 'text', name: 'selected_option_id', required: true, max: 80 },
      { type: 'bool', name: 'is_correct' },
      { type: 'number', name: 'points_awarded', min: 0, max: 100 },
      { type: 'date', name: 'answered_at', required: true },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_placement_answers_attempt_question ON placement_answers (attempt, question)',
      'CREATE INDEX idx_placement_answers_attempt_created ON placement_answers (attempt, created)',
    ],
  })
  app.save(placementAnswers)

  const studentLevelAssessments = new Collection({
    type: 'base',
    name: 'student_level_assessments',
    listRule: adminOnly,
    viewRule: adminOnly,
    createRule: adminOnly,
    updateRule: adminOnly,
    deleteRule: adminOnly,
    fields: [
      { type: 'relation', name: 'student', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'relation', name: 'source_attempt', maxSelect: 1, collectionId: placementAttempts.id, cascadeDelete: false },
      { type: 'select', name: 'automatic_level', maxSelect: 1, values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      { type: 'select', name: 'speaking_level', maxSelect: 1, values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      { type: 'select', name: 'validated_level', required: true, maxSelect: 1, values: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] },
      { type: 'editor', name: 'notes', maxSize: 30000 },
      { type: 'relation', name: 'assessed_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'date', name: 'assessed_at', required: true },
      { type: 'select', name: 'reason', required: true, maxSelect: 1, values: ['INITIAL', 'REVIEW', 'PROGRESS', 'OTHER'] },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE INDEX idx_student_level_assessments_student_date ON student_level_assessments (student, assessed_at)',
    ],
  })
  app.save(studentLevelAssessments)
}, (app) => {
  for (const name of [
    'student_level_assessments',
    'placement_answers',
    'placement_attempts',
    'placement_questions',
    'placement_tests',
  ]) {
    try {
      app.delete(app.findCollectionByNameOrId(name))
    } catch {
      // Safe rollback when a dependent collection is already absent.
    }
  }
})

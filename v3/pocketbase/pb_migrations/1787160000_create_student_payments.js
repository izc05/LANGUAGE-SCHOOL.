migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const enrollments = app.findCollectionByNameOrId('enrollments')

  const payments = new Collection({
    type: 'base',
    name: 'student_payments',
    listRule: '@request.auth.role = "ADMIN"',
    viewRule: '@request.auth.role = "ADMIN"',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: null,
    fields: [
      { type: 'relation', name: 'student', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'relation', name: 'enrollment', required: true, maxSelect: 1, collectionId: enrollments.id, cascadeDelete: false },
      { type: 'select', name: 'billing_mode', required: true, maxSelect: 1, values: ['MONTHLY', 'INTENSIVE'] },
      { type: 'number', name: 'amount_cents', required: true, min: 1, max: 1000000, onlyInt: true },
      { type: 'date', name: 'period_start', required: true },
      { type: 'date', name: 'period_end', required: true },
      { type: 'date', name: 'due_date', required: true },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['PENDING', 'PAID', 'CANCELLED', 'REFUNDED'] },
      { type: 'date', name: 'paid_at' },
      { type: 'select', name: 'payment_method', maxSelect: 1, values: ['CASH', 'CARD', 'TRANSFER', 'BIZUM', 'OTHER'] },
      { type: 'text', name: 'reference', max: 160 },
      { type: 'text', name: 'notes', max: 1200 },
      { type: 'relation', name: 'recorded_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_student_payments_period ON student_payments (student, enrollment, billing_mode, period_start, period_end)',
      'CREATE INDEX idx_student_payments_student_due ON student_payments (student, due_date)',
      'CREATE INDEX idx_student_payments_status_due ON student_payments (status, due_date)',
      'CREATE INDEX idx_student_payments_enrollment_period ON student_payments (enrollment, period_start, period_end)',
    ],
  })

  app.save(payments)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('student_payments')
    app.delete(collection)
  } catch {
    // Safe rollback when the collection is already absent.
  }
})

/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  const statusField = users.fields.getByName('status')
  statusField.values = ['ACTIVE', 'INVITED', 'INACTIVE', 'SUSPENDED']
  // Admin accounts are provisioned by the trusted bootstrap/superuser path and
  // are outside the student/teacher invitation lifecycle. STUDENT/TEACHER
  // accounts must be ACTIVE + verified before password authentication is allowed.
  users.authRule = 'status = "ACTIVE" && (role = "ADMIN" || verified = true)'
  app.save(users)

  // Preserve current accounts as already activated before enforcing verified.
  app.db().newQuery(`
    UPDATE users
    SET verified = 1
    WHERE status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')
  `).execute()

  const invitations = new Collection({
    type: 'base',
    name: 'account_invitations',
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: 'relation', name: 'user', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: true },
      { type: 'text', name: 'token_hash', required: true, hidden: true, min: 64, max: 64 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['PENDING', 'USED', 'REVOKED'] },
      { type: 'date', name: 'expires_at', required: true },
      { type: 'relation', name: 'created_by', required: true, maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'date', name: 'sent_at' },
      { type: 'date', name: 'used_at' },
      { type: 'date', name: 'revoked_at' },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_account_invitations_token_hash ON account_invitations (token_hash)',
      'CREATE INDEX idx_account_invitations_user_status ON account_invitations (user, status)',
      "CREATE UNIQUE INDEX idx_account_invitations_one_pending_user ON account_invitations (user) WHERE status = 'PENDING'",
    ],
  })
  app.save(invitations)
}, (app) => {
  try {
    const invitations = app.findCollectionByNameOrId('account_invitations')
    app.delete(invitations)
  } catch {
    // Safe rollback if the collection has already been removed.
  }

  const users = app.findCollectionByNameOrId('users')
  app.db().newQuery(`
    UPDATE users
    SET status = 'INACTIVE'
    WHERE status = 'INVITED'
  `).execute()
  users.fields.getByName('status').values = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
  users.authRule = 'status = "ACTIVE"'
  app.save(users)
})

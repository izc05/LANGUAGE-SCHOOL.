migrate((app) => {
  const classes = app.findCollectionByNameOrId('classes')
  const users = app.findCollectionByNameOrId('users')

  const zoomMeetings = new Collection({
    type: 'base',
    name: 'zoom_meetings',
    listRule: '@request.auth.role = "ADMIN" || class.teacher = @request.auth.id || class.group.teacher = @request.auth.id',
    viewRule: '@request.auth.role = "ADMIN" || class.teacher = @request.auth.id || class.group.teacher = @request.auth.id',
    createRule: '@request.auth.role = "ADMIN"',
    updateRule: '@request.auth.role = "ADMIN"',
    deleteRule: '@request.auth.role = "ADMIN"',
    fields: [
      { type: 'relation', name: 'class', required: true, maxSelect: 1, collectionId: classes.id, cascadeDelete: true },
      { type: 'select', name: 'provider', required: true, maxSelect: 1, values: ['ZOOM'] },
      { type: 'text', name: 'external_meeting_id', max: 80 },
      { type: 'text', name: 'external_uuid', max: 220 },
      { type: 'url', name: 'join_url', max: 2000 },
      { type: 'select', name: 'status', required: true, maxSelect: 1, values: ['PENDING', 'READY', 'CANCELLED', 'ERROR'] },
      { type: 'relation', name: 'created_by', maxSelect: 1, collectionId: users.id, cascadeDelete: false },
      { type: 'autodate', name: 'created', onCreate: true },
      { type: 'autodate', name: 'updated', onCreate: true, onUpdate: true },
    ],
    indexes: [
      'CREATE UNIQUE INDEX idx_zoom_meetings_class ON zoom_meetings (`class`)',
      'CREATE INDEX idx_zoom_meetings_external_id ON zoom_meetings (external_meeting_id)',
      'CREATE INDEX idx_zoom_meetings_status ON zoom_meetings (status)',
    ],
  })

  app.save(zoomMeetings)
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('zoom_meetings')
    app.delete(collection)
  } catch {
    // Safe rollback when the collection is already absent.
  }
})

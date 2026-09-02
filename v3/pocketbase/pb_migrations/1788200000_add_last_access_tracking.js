migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  users.fields.add(new DateField({ name: 'last_access_at' }))
  users.updateRule = '(@request.auth.role = "ADMIN" && @request.body.role:changed = false && @request.body.last_access_at:changed = false) || (id = @request.auth.id && @request.body.role:changed = false && @request.body.status:changed = false && @request.body.last_access_at:changed = false)'
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')

  users.fields.removeByName('last_access_at')
  users.updateRule = '(@request.auth.role = "ADMIN" && @request.body.role:changed = false) || (id = @request.auth.id && @request.body.role:changed = false && @request.body.status:changed = false)'
  app.save(users)
})

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')
  users.updateRule = '(@request.auth.role = "ADMIN" && @request.body.role:changed = false) || (id = @request.auth.id && @request.body.role:changed = false && @request.body.status:changed = false)'
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.updateRule = '@request.auth.role = "ADMIN" || (id = @request.auth.id && @request.body.role:changed = false && @request.body.status:changed = false)'
  app.save(users)
})

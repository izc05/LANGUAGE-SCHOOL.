migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  // Application ADMIN accounts must use the canonical server-side onboarding
  // flows for STUDENT/TEACHER accounts. Superusers remain able to bootstrap
  // trusted fixtures and the first real ADMIN locally.
  users.createRule = null
  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')
  users.createRule = '@request.auth.role = "ADMIN"'
  app.save(users)
})

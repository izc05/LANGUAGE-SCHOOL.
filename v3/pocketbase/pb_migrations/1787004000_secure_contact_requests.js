migrate((app) => {
  const collection = app.findCollectionByNameOrId('contact_requests')
  collection.createRule = null
  app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId('contact_requests')
  collection.createRule = '@request.body.status = "NEW"'
  app.save(collection)
})

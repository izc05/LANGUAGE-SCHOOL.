migrate((app) => {
  const files = app.findCollectionByNameOrId('student_files')
  const file = files.fields.getByName('file')
  file.mimeTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'audio/mpeg',
    'audio/mp4',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]
  app.save(files)
}, (app) => {
  const files = app.findCollectionByNameOrId('student_files')
  const file = files.fields.getByName('file')
  file.mimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'audio/mpeg',
    'audio/mp4',
    'image/jpeg',
    'image/png',
    'image/webp',
  ]
  app.save(files)
})

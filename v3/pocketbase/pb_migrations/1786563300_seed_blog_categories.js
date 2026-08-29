migrate((app) => {
  const collection = app.findCollectionByNameOrId('blog_categories')
  const categories = [
    ['Speaking', 'speaking', 'Consejos y práctica para hablar inglés con más confianza.'],
    ['Vocabulary', 'vocabulary', 'Vocabulario útil aprendido mediante contexto y uso real.'],
    ['Grammar', 'grammar', 'Gramática explicada de forma práctica y aplicable.'],
    ['Exams', 'exams', 'Preparación, estrategias y recursos para exámenes oficiales.'],
    ['Kids', 'kids', 'Ideas, recursos y aprendizaje de inglés para niños.'],
    ['Academia', 'academia', 'Noticias, metodología y vida de Language School.'],
  ]

  for (const [name, slug, description] of categories) {
    const record = new Record(collection)
    record.set('name', name)
    record.set('slug', slug)
    record.set('description', description)
    record.set('active', true)
    app.save(record)
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('blog_categories')
  const slugs = ['speaking', 'vocabulary', 'grammar', 'exams', 'kids', 'academia']

  for (const slug of slugs) {
    try {
      const record = app.findFirstRecordByFilter(collection, 'slug = {:slug}', { slug })
      app.delete(record)
    } catch {
      // Rollback seguro si el registro ya no existe.
    }
  }
})

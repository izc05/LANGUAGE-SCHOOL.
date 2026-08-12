migrate((app) => {
  const collection = app.findCollectionByNameOrId('site_pages')

  try {
    app.findFirstRecordByFilter(collection, 'key = {:key}', { key: 'about' })
    return
  } catch {
    // La página aún no existe; se crea a continuación.
  }

  const record = new Record(collection)
  record.set('key', 'about')
  record.set('title', 'Sobre nosotros')
  record.set('status', 'PUBLISHED')
  record.set('content', {
    eyebrow: 'SOBRE LANGUAGE SCHOOL',
    title: 'Una academia cercana para aprender y usar el idioma con confianza.',
    intro: 'Clases presenciales y online con acompañamiento, objetivos claros y recursos que continúan disponibles entre sesiones.',
    storyTitle: 'Aprender no debería sentirse como memorizar por memorizar.',
    storyParagraphs: [
      'Nuestro enfoque busca que cada alumno entienda qué está trabajando, por qué lo trabaja y cómo llevarlo a situaciones reales.',
      'La plataforma digital complementa las clases con materiales, tareas, avisos y seguimiento en un espacio privado para cada alumno.',
    ],
    values: [
      { title: 'Cercanía', text: 'Seguimiento humano y comunicación clara durante todo el proceso.' },
      { title: 'Práctica útil', text: 'El idioma se trabaja para comprenderlo, hablarlo y utilizarlo fuera del aula.' },
      { title: 'Continuidad', text: 'La clase no termina al salir: materiales y tareas siguen accesibles en el espacio del alumno.' },
    ],
    closingTitle: 'Tu objetivo marca el camino.',
    closingText: 'Cuéntanos qué necesitas y te orientaremos hacia el programa más adecuado.',
  })
  app.save(record)
}, (app) => {
  const collection = app.findCollectionByNameOrId('site_pages')
  try {
    const record = app.findFirstRecordByFilter(collection, 'key = {:key}', { key: 'about' })
    app.delete(record)
  } catch {
    // Rollback seguro si el registro ya no existe.
  }
})

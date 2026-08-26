/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest((e) => {
  const isSeed = $os.getenv('LANGUAGE_SCHOOL_E2E') === '1' && e.record.getString('version') === 'e2e-8c1-v1'
  if (isSeed) {
    e.next()
    return
  }
  throw new ForbiddenError('Las versiones del test de nivel se crean desde el flujo seguro de Administración.')
}, 'placement_tests')

onRecordCreateRequest((e) => {
  if ($os.getenv('LANGUAGE_SCHOOL_E2E') === '1') {
    try {
      const test = e.app.findRecordById('placement_tests', e.record.getString('test'))
      if (test.getString('version') === 'e2e-8c1-v1') {
        e.next()
        return
      }
    } catch {
      // Fall through to the protected path.
    }
  }
  throw new ForbiddenError('Las preguntas del test de nivel se crean desde el flujo seguro de Administración.')
}, 'placement_questions')

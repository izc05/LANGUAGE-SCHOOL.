/// <reference path="../pb_data/types.d.ts" />

function recordJson(record, field, fallback) {
  const raw = record.get(field)
  if (raw === null || raw === undefined) return fallback
  try {
    const text = toString(raw)
    if (text) return JSON.parse(text)
  } catch {
    // JSONRaw can already be represented as a plain object.
  }
  try { return JSON.parse(JSON.stringify(raw)) } catch { return fallback }
}

function timestamp(value) {
  const parsed = Date.parse(String(value || '').replace(' ', 'T'))
  return Number.isFinite(parsed) ? parsed : 0
}

function optionOrder(question, seed) {
  const options = recordJson(question, 'options', [])
  if (!Array.isArray(options)) return []
  return options.map((option) => String(option && option.id || '')).filter(Boolean).sort((a, b) => {
    const left = $security.sha256(`${seed}:option:${question.id}:${a}`)
    const right = $security.sha256(`${seed}:option:${question.id}:${b}`)
    return left < right ? -1 : left > right ? 1 : 0
  })
}

function diversifyCampusSnapshot(app, attempt) {
  if (attempt.getString('mode') !== 'CAMPUS') return
  const studentId = attempt.getString('student')
  const testId = attempt.getString('test')
  if (!studentId || !testId) return

  const previous = app.findAllRecords('placement_attempts')
    .filter((record) => (
      record.getString('mode') === 'CAMPUS'
      && record.getString('student') === studentId
      && record.getString('test') === testId
      && record.getString('status') === 'COMPLETED'
    ))
    .sort((a, b) => timestamp(b.getString('completed_at')) - timestamp(a.getString('completed_at')))[0]
  if (!previous) return

  const previousSnapshot = recordJson(previous, 'selection_snapshot', [])
  const currentSnapshot = recordJson(attempt, 'selection_snapshot', [])
  if (!Array.isArray(previousSnapshot) || !Array.isArray(currentSnapshot) || !currentSnapshot.length) return

  const previousIds = {}
  previousSnapshot.forEach((entry) => { if (entry && entry.questionId) previousIds[String(entry.questionId)] = true })
  const selectedIds = {}
  currentSnapshot.forEach((entry) => { if (entry && entry.questionId) selectedIds[String(entry.questionId)] = true })
  const pool = app.findAllRecords('placement_questions').filter((question) => question.getString('test') === testId && question.getBool('active'))
  const seed = $security.randomString(40)

  currentSnapshot.forEach((entry) => {
    if (!entry || !entry.questionId || !previousIds[String(entry.questionId)]) return
    let current = null
    try { current = app.findRecordById('placement_questions', String(entry.questionId)) } catch { return }
    const candidates = pool.filter((question) => (
      question.getString('skill') === current.getString('skill')
      && question.getString('cefr_level') === current.getString('cefr_level')
      && !previousIds[question.id]
      && !selectedIds[question.id]
    ))
    candidates.sort((a, b) => {
      const left = $security.sha256(`${seed}:replacement:${a.id}`)
      const right = $security.sha256(`${seed}:replacement:${b.id}`)
      return left < right ? -1 : left > right ? 1 : 0
    })
    const replacement = candidates[0]
    if (!replacement) return
    delete selectedIds[String(entry.questionId)]
    selectedIds[replacement.id] = true
    entry.questionId = replacement.id
    entry.optionOrder = optionOrder(replacement, seed)
  })

  attempt.set('selection_snapshot', currentSnapshot)
}

onRecordCreate((e) => {
  try {
    diversifyCampusSnapshot(e.app, e.record)
  } catch (error) {
    console.log(`[placement-diversity] snapshot diversification skipped: ${String(error)}`)
  }
  e.next()
}, 'placement_attempts')

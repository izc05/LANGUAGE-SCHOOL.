const grammar = require(`${__hooks}/placement_bank_grammar.js`)
const vocabulary = require(`${__hooks}/placement_bank_vocabulary.js`)
const reading = require(`${__hooks}/placement_bank_reading.js`)

const NAME = 'Language School · Banco MCER inicial'
const VERSION_HINT = 'ls-cefr-2026-v1'
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const skills = ['GRAMMAR', 'VOCABULARY', 'READING']

const questions = [...grammar, ...vocabulary, ...reading].map((question) => ({
  ...question,
  options: question.options.map((option) => ({ ...option })),
}))

function refineQuestion(code, patch) {
  const question = questions.find((item) => item.code === code)
  if (!question) throw new Error(`Cannot refine missing placement question ${code}`)
  Object.assign(question, patch)
  if (patch.options) question.options = patch.options.map((option) => ({ ...option }))
}

refineQuestion('re-b1-01', {
  prompt: 'What advantage does Leo mention about his new routine?',
  passage: 'Leo used to drive to work and go to the gym in the evening. When traffic became worse, he started cycling to the office. The journey takes almost the same time, but now his daily exercise is already done when he gets home.',
  options: [
    { id: 'a', label: 'He gets home much earlier.' },
    { id: 'b', label: 'His daily exercise is already done.' },
    { id: 'c', label: 'He no longer has to work in the office.' },
    { id: 'd', label: 'His journey costs nothing.' },
  ],
  correct: 'b',
})

refineQuestion('vo-b1-01', {
  prompt: 'We had to ___ the meeting until Friday because the manager was ill.',
  options: [
    { id: 'a', label: 'put off' },
    { id: 'b', label: 'set up' },
    { id: 'c', label: 'carry out' },
    { id: 'd', label: 'bring forward' },
  ],
  correct: 'a',
  explanation: "'Put off' means postpone; the other phrasal verbs describe arranging, performing or moving something earlier.",
})

refineQuestion('vo-b2-01', {
  prompt: 'The new procedure is designed to ___ down on unnecessary paperwork.',
  options: [
    { id: 'a', label: 'cut' },
    { id: 'b', label: 'bring' },
    { id: 'c', label: 'take' },
    { id: 'd', label: 'keep' },
  ],
  correct: 'a',
  explanation: "The fixed phrasal verb is 'cut down on', meaning reduce the amount of something.",
})

refineQuestion('vo-c1-04', {
  prompt: 'The editor asked her to ___ the argument so that its central claim was more precise, without shortening the article.',
  options: [
    { id: 'a', label: 'refine' },
    { id: 'b', label: 'condense' },
    { id: 'c', label: 'retract' },
    { id: 'd', label: 'compile' },
  ],
  correct: 'a',
  explanation: "'Refine' means improve precision or clarity; 'without shortening' rules out condense.",
})

refineQuestion('gr-c2-03', {
  prompt: 'Had the warning been taken seriously, the outage ___ altogether.',
  options: [
    { id: 'a', label: 'might have been avoided' },
    { id: 'b', label: 'might be avoided' },
    { id: 'c', label: 'would avoid' },
    { id: 'd', label: 'had been avoided' },
  ],
  correct: 'a',
  explanation: "Inverted third conditional with modal perfect: 'Had ... been taken ..., ... might have been avoided'.",
})

function balanceCorrectOptionIds() {
  skills.forEach((skill) => levels.forEach((level) => {
    const cell = questions.filter((question) => question.skill === skill && question.level === level).sort((a, b) => a.code.localeCompare(b.code))
    cell.forEach((question, index) => {
      const target = String.fromCharCode(97 + index)
      if (question.correct === target) return
      const current = question.options.find((option) => option.id === question.correct)
      const destination = question.options.find((option) => option.id === target)
      if (!current || !destination) throw new Error(`Cannot balance answer IDs for ${question.code}`)
      const label = current.label
      current.label = destination.label
      destination.label = label
      question.correct = target
    })
  }))
}

function validateBank() {
  if (questions.length !== 72) throw new Error(`Placement baseline bank must contain 72 questions, found ${questions.length}`)
  const codes = {}
  const cells = {}

  questions.forEach((question) => {
    if (!question || typeof question !== 'object') throw new Error('Invalid placement baseline question')
    if (!skills.includes(question.skill) || !levels.includes(question.level)) throw new Error(`Invalid CEFR cell in ${question.code || 'unknown question'}`)
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(String(question.code || ''))) throw new Error('Invalid baseline question code')
    if (codes[question.code]) throw new Error(`Duplicate baseline question code ${question.code}`)
    codes[question.code] = true
    if (!String(question.prompt || '').trim()) throw new Error(`Missing prompt in ${question.code}`)
    if (!Array.isArray(question.options) || question.options.length !== 4) throw new Error(`Baseline question ${question.code} must have four options`)
    const optionIds = {}
    question.options.forEach((option) => {
      if (!option || !String(option.id || '').trim() || !String(option.label || '').trim() || optionIds[option.id]) throw new Error(`Invalid options in ${question.code}`)
      optionIds[option.id] = true
    })
    if (!optionIds[question.correct]) throw new Error(`Correct option missing in ${question.code}`)
    const key = `${question.skill}:${question.level}`
    cells[key] = Number(cells[key] || 0) + 1
  })

  skills.forEach((skill) => levels.forEach((level) => {
    const key = `${skill}:${level}`
    if (cells[key] !== 4) throw new Error(`Baseline cell ${key} must contain 4 questions, found ${cells[key] || 0}`)
    const correctIds = questions.filter((question) => question.skill === skill && question.level === level).map((question) => question.correct).sort().join('')
    if (correctIds !== 'abcd') throw new Error(`Baseline cell ${key} must balance correct answer IDs`)
  }))

  return { questionCount: questions.length, variantsPerCell: 4, cells: 18 }
}

balanceCorrectOptionIds()
const summary = validateBank()

module.exports = { NAME, VERSION_HINT, questions, summary, validateBank }

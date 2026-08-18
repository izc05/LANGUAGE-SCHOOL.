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

const readingB1 = questions.find((question) => question.code === 're-b1-01')
if (readingB1) {
  readingB1.prompt = 'What advantage does Leo mention about his new routine?'
  readingB1.passage = 'Leo used to drive to work and go to the gym in the evening. When traffic became worse, he started cycling to the office. The journey takes almost the same time, but now his daily exercise is already done when he gets home.'
  readingB1.options = [
    { id: 'a', label: 'He gets home much earlier.' },
    { id: 'b', label: 'His daily exercise is already done.' },
    { id: 'c', label: 'He no longer has to work in the office.' },
    { id: 'd', label: 'His journey costs nothing.' },
  ]
  readingB1.correct = 'b'
}

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

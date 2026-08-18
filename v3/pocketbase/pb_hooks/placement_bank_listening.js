const a = require(`${__hooks}/placement_bank_listening_a.js`)
const b = require(`${__hooks}/placement_bank_listening_b.js`)
const c = require(`${__hooks}/placement_bank_listening_c.js`)

const questions = [...a, ...b, ...c]
if (questions.length !== 24) throw new Error(`Listening bank must contain 24 questions, found ${questions.length}`)

module.exports = questions

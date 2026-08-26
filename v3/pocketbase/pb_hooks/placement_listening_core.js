const placementCore = require(`${__hooks}/placement_core.js`)

const ALGORITHM_VERSION = 'cefr-v2-listening'
const LISTENING_SKILL = 'LISTENING'
const LISTENING_BLUEPRINT = placementCore.LEVELS.map((level) => ({ skill: LISTENING_SKILL, level, count: 1 }))
const PUBLIC_BLUEPRINT = [...placementCore.PUBLIC_BLUEPRINT.map((cell) => ({ ...cell })), ...LISTENING_BLUEPRINT.map((cell) => ({ ...cell }))]
const CAMPUS_BLUEPRINT = [...placementCore.CAMPUS_BLUEPRINT.map((cell) => ({ ...cell })), ...LISTENING_BLUEPRINT.map((cell) => ({ ...cell }))]

function roundPercent(value) {
  return Math.round(value * 100) / 100
}

function calculate(items, mode) {
  if (!Array.isArray(items) || !items.length) throw new Error('At least one placement item is required')
  const coreItems = items.filter((item) => item.skill !== LISTENING_SKILL)
  const listeningItems = items.filter((item) => item.skill === LISTENING_SKILL)
  if (!coreItems.length || !listeningItems.length) throw new Error('Listening placement requires core and listening items')

  const base = placementCore.calculateCefrV1(coreItems, mode)
  const correct = listeningItems.filter((item) => item.correct).length
  const total = listeningItems.length
  const percent = total ? roundPercent((correct / total) * 100) : 0

  return {
    algorithmVersion: ALGORITHM_VERSION,
    rawScore: base.rawScore,
    maxScore: base.maxScore,
    scorePercent: base.scorePercent,
    estimatedLevel: base.estimatedLevel,
    skillScores: {
      ...base.skillScores,
      LISTENING: { correct, total, percent, diagnosticOnly: true },
    },
  }
}

function blueprintQuestionCount(blueprint) {
  return blueprint.reduce((total, cell) => total + Number(cell.count || 0), 0)
}

module.exports = {
  ALGORITHM_VERSION,
  LISTENING_SKILL,
  LISTENING_BLUEPRINT,
  PUBLIC_BLUEPRINT,
  CAMPUS_BLUEPRINT,
  calculate,
  blueprintQuestionCount,
}

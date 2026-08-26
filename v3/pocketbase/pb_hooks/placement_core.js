const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const SKILLS = ['GRAMMAR', 'VOCABULARY', 'READING']

const PUBLIC_BLUEPRINT = [
  { skill: 'GRAMMAR', level: 'A1', count: 1 },
  { skill: 'GRAMMAR', level: 'A2', count: 1 },
  { skill: 'GRAMMAR', level: 'B1', count: 1 },
  { skill: 'GRAMMAR', level: 'B2', count: 1 },
  { skill: 'GRAMMAR', level: 'C1', count: 1 },
  { skill: 'VOCABULARY', level: 'A1', count: 1 },
  { skill: 'VOCABULARY', level: 'A2', count: 1 },
  { skill: 'VOCABULARY', level: 'B1', count: 1 },
  { skill: 'VOCABULARY', level: 'C1', count: 1 },
  { skill: 'VOCABULARY', level: 'C2', count: 1 },
  { skill: 'READING', level: 'B1', count: 1 },
  { skill: 'READING', level: 'B2', count: 2 },
  { skill: 'READING', level: 'C1', count: 1 },
  { skill: 'READING', level: 'C2', count: 1 },
]

const CAMPUS_BLUEPRINT = [
  { skill: 'GRAMMAR', level: 'A1', count: 2 },
  { skill: 'GRAMMAR', level: 'A2', count: 2 },
  { skill: 'GRAMMAR', level: 'B1', count: 2 },
  { skill: 'GRAMMAR', level: 'B2', count: 1 },
  { skill: 'GRAMMAR', level: 'C1', count: 1 },
  { skill: 'GRAMMAR', level: 'C2', count: 2 },
  { skill: 'VOCABULARY', level: 'A1', count: 2 },
  { skill: 'VOCABULARY', level: 'A2', count: 1 },
  { skill: 'VOCABULARY', level: 'B1', count: 1 },
  { skill: 'VOCABULARY', level: 'B2', count: 2 },
  { skill: 'VOCABULARY', level: 'C1', count: 2 },
  { skill: 'VOCABULARY', level: 'C2', count: 2 },
  { skill: 'READING', level: 'A1', count: 1 },
  { skill: 'READING', level: 'A2', count: 2 },
  { skill: 'READING', level: 'B1', count: 2 },
  { skill: 'READING', level: 'B2', count: 2 },
  { skill: 'READING', level: 'C1', count: 2 },
  { skill: 'READING', level: 'C2', count: 1 },
]

function roundPercent(value) {
  return Math.round(value * 100) / 100
}

function candidateLevelFromPercent(percent) {
  if (percent >= 80) return 'C2'
  if (percent >= 65) return 'C1'
  if (percent >= 50) return 'B2'
  if (percent >= 35) return 'B1'
  if (percent >= 20) return 'A2'
  return 'A1'
}

function validLevel(level) {
  return LEVELS.indexOf(level) !== -1
}

function validSkill(skill) {
  return SKILLS.indexOf(skill) !== -1
}

function evidencePass(items, level, mode, overallPercent) {
  if (level === 'A1') return true

  const levelIndex = LEVELS.indexOf(level)
  const atLevel = items.filter((item) => item.level === level)
  const atOrBelow = items.filter((item) => LEVELS.indexOf(item.level) <= levelIndex)
  if (!atLevel.length || !atOrBelow.length) return false

  const levelCorrect = atLevel.filter((item) => item.correct).length
  const cumulativeCorrect = atOrBelow.filter((item) => item.correct).length
  const levelRatio = levelCorrect / atLevel.length
  const cumulativeRatio = cumulativeCorrect / atOrBelow.length

  if (level === 'C2') {
    const c2Minimum = mode === 'CAMPUS' ? 0.8 : 1
    return overallPercent >= 80 && levelRatio >= c2Minimum
  }

  return levelRatio >= 0.5 && cumulativeRatio >= 0.65
}

function estimateLevel(items, mode, overallPercent) {
  let index = LEVELS.indexOf(candidateLevelFromPercent(overallPercent))
  while (index > 0) {
    const level = LEVELS[index]
    if (evidencePass(items, level, mode, overallPercent)) return level
    index -= 1
  }
  return 'A1'
}

function calculateCefrV1(items, mode) {
  if (mode !== 'PUBLIC' && mode !== 'CAMPUS') {
    throw new Error('Unsupported placement mode')
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('At least one scored item is required')
  }

  items.forEach((item) => {
    if (!validSkill(item.skill) || !validLevel(item.level)) {
      throw new Error('Invalid scored item')
    }
  })

  const rawScore = items.filter((item) => item.correct).length
  const maxScore = items.length
  const scorePercent = roundPercent((rawScore / maxScore) * 100)
  const estimatedLevel = estimateLevel(items, mode, scorePercent)
  const skillScores = {}

  SKILLS.forEach((skill) => {
    const skillItems = items.filter((item) => item.skill === skill)
    const correct = skillItems.filter((item) => item.correct).length
    const total = skillItems.length
    skillScores[skill] = {
      correct,
      total,
      percent: total ? roundPercent((correct / total) * 100) : 0,
    }
  })

  return {
    algorithmVersion: 'cefr-v1',
    rawScore,
    maxScore,
    scorePercent,
    estimatedLevel,
    skillScores,
  }
}

function blueprintQuestionCount(blueprint) {
  return blueprint.reduce((total, cell) => total + Number(cell.count || 0), 0)
}

module.exports = {
  LEVELS,
  SKILLS,
  PUBLIC_BLUEPRINT,
  CAMPUS_BLUEPRINT,
  candidateLevelFromPercent,
  calculateCefrV1,
  blueprintQuestionCount,
}

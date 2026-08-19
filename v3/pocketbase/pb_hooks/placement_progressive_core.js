const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const SKILLS = ['GRAMMAR', 'VOCABULARY', 'READING']

const ALGORITHM_VERSION = 'cefr-v3-progressive'
const SNAPSHOT_KIND = 'PROGRESSIVE_PUBLIC_V1'
const PUBLIC_QUESTION_COUNT = 12

const CALIBRATION_BLUEPRINT = SKILLS.map((skill) => ({ skill, level: 'B1', count: 1 }))

const ROUTE_BLUEPRINTS = {
  FOUNDATION: SKILLS.flatMap((skill) => [
    { skill, level: 'A1', count: 1 },
    { skill, level: 'A2', count: 2 },
  ]),
  DEVELOPING: SKILLS.flatMap((skill) => [
    { skill, level: 'A1', count: 1 },
    { skill, level: 'A2', count: 1 },
    { skill, level: 'B1', count: 1 },
  ]),
  INDEPENDENT: SKILLS.flatMap((skill) => [
    { skill, level: 'B1', count: 1 },
    { skill, level: 'B2', count: 1 },
    { skill, level: 'C1', count: 1 },
  ]),
  PROFICIENT: SKILLS.flatMap((skill) => [
    { skill, level: 'B2', count: 1 },
    { skill, level: 'C1', count: 1 },
    { skill, level: 'C2', count: 1 },
  ]),
}

function cloneCells(cells) {
  return cells.map((cell) => ({ ...cell }))
}

function routeForCalibration(correct) {
  const value = Number(correct)
  if (!Number.isInteger(value) || value < 0 || value > 3) {
    throw new Error('Calibration score must be an integer from 0 to 3')
  }
  if (value === 0) return 'FOUNDATION'
  if (value === 1) return 'DEVELOPING'
  if (value === 2) return 'INDEPENDENT'
  return 'PROFICIENT'
}

function branchBlueprint(route) {
  const blueprint = ROUTE_BLUEPRINTS[String(route || '')]
  if (!blueprint) throw new Error('Unsupported progressive route')
  return cloneCells(blueprint)
}

function publicBlueprintDescriptor() {
  return {
    type: SNAPSHOT_KIND,
    questionCount: PUBLIC_QUESTION_COUNT,
    calibration: cloneCells(CALIBRATION_BLUEPRINT),
    routes: Object.fromEntries(
      Object.entries(ROUTE_BLUEPRINTS).map(([name, cells]) => [name, cloneCells(cells)]),
    ),
  }
}

function publicCoverageRequirements() {
  const required = {}
  Object.keys(ROUTE_BLUEPRINTS).forEach((route) => {
    const routeCounts = {}
    ;[...CALIBRATION_BLUEPRINT, ...ROUTE_BLUEPRINTS[route]].forEach((cell) => {
      const key = `${cell.skill}:${cell.level}`
      routeCounts[key] = Number(routeCounts[key] || 0) + Number(cell.count || 0)
    })
    Object.keys(routeCounts).forEach((key) => {
      required[key] = Math.max(Number(required[key] || 0), Number(routeCounts[key] || 0))
    })
  })

  return SKILLS.flatMap((skill) => LEVELS.map((level) => ({
    skill,
    level,
    count: Number(required[`${skill}:${level}`] || 0),
  }))).filter((cell) => cell.count > 0)
}

function roundPercent(value) {
  return Math.round(value * 100) / 100
}

function levelRatio(items, level) {
  const subset = items.filter((item) => item.level === level)
  if (!subset.length) return null
  return subset.filter((item) => item.correct).length / subset.length
}

function passes(items, level, minimum) {
  const ratio = levelRatio(items, level)
  return ratio !== null && ratio >= minimum
}

function estimateLevel(items, route) {
  if (route === 'FOUNDATION') {
    return passes(items, 'A1', 2 / 3) && passes(items, 'A2', 2 / 3) ? 'A2' : 'A1'
  }

  if (route === 'DEVELOPING') {
    if (passes(items, 'B1', 0.5) && passes(items, 'A2', 2 / 3) && passes(items, 'A1', 2 / 3)) return 'B1'
    if (passes(items, 'A2', 2 / 3) && passes(items, 'A1', 2 / 3)) return 'A2'
    return 'A1'
  }

  if (route === 'INDEPENDENT') {
    if (passes(items, 'C1', 2 / 3) && passes(items, 'B2', 2 / 3) && passes(items, 'B1', 0.5)) return 'C1'
    if (passes(items, 'B2', 2 / 3) && passes(items, 'B1', 0.5)) return 'B2'
    if (passes(items, 'B1', 0.5)) return 'B1'
    return 'A2'
  }

  if (route === 'PROFICIENT') {
    if (passes(items, 'C2', 1) && passes(items, 'C1', 2 / 3) && passes(items, 'B2', 2 / 3)) return 'C2'
    if (passes(items, 'C1', 2 / 3) && passes(items, 'B2', 2 / 3)) return 'C1'
    if (passes(items, 'B2', 2 / 3)) return 'B2'
    return 'B1'
  }

  throw new Error('Unsupported progressive route')
}

function calculate(items, route) {
  if (!Array.isArray(items) || items.length !== PUBLIC_QUESTION_COUNT) {
    throw new Error(`Progressive placement requires ${PUBLIC_QUESTION_COUNT} scored items`)
  }
  if (!ROUTE_BLUEPRINTS[String(route || '')]) throw new Error('Unsupported progressive route')

  items.forEach((item) => {
    if (!item || !SKILLS.includes(item.skill) || !LEVELS.includes(item.level) || typeof item.correct !== 'boolean') {
      throw new Error('Invalid progressive scored item')
    }
  })

  const rawScore = items.filter((item) => item.correct).length
  const maxScore = items.length
  const scorePercent = roundPercent((rawScore / maxScore) * 100)
  const skillScores = {}

  SKILLS.forEach((skill) => {
    const subset = items.filter((item) => item.skill === skill)
    const correct = subset.filter((item) => item.correct).length
    const total = subset.length
    if (total !== 4) throw new Error(`Progressive route must contain four ${skill} items`)
    skillScores[skill] = {
      correct,
      total,
      percent: roundPercent((correct / total) * 100),
    }
  })

  return {
    algorithmVersion: ALGORITHM_VERSION,
    rawScore,
    maxScore,
    scorePercent,
    estimatedLevel: estimateLevel(items, route),
    skillScores,
  }
}

module.exports = {
  LEVELS,
  SKILLS,
  ALGORITHM_VERSION,
  SNAPSHOT_KIND,
  PUBLIC_QUESTION_COUNT,
  CALIBRATION_BLUEPRINT,
  ROUTE_BLUEPRINTS,
  routeForCalibration,
  branchBlueprint,
  publicBlueprintDescriptor,
  publicCoverageRequirements,
  calculate,
}

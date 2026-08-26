/// <reference path="../pb_data/types.d.ts" />

onRecordCreate((e) => {
  try {
    const diversity = require(`${__hooks}/placement_attempt_diversity.js`)
    diversity.diversifyCampusSnapshot(e.app, e.record)
  } catch (error) {
    console.log(`[placement-diversity] snapshot diversification skipped: ${String(error)}`)
  }
  e.next()
}, 'placement_attempts')

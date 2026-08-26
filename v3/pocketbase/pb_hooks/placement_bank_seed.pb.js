/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
  e.next()
  try {
    const bankSeed = require(`${__hooks}/placement_bank_seed_service.js`)
    const admin = bankSeed.firstAdmin(e.app)
    if (admin) bankSeed.seedBaselineBank(e.app, admin)
  } catch (error) {
    console.log(`[placement-bank] baseline bootstrap skipped: ${String(error)}`)
  }
})

onRecordAfterCreateSuccess((e) => {
  try {
    if (e.record.getString('role') === 'ADMIN') {
      const bankSeed = require(`${__hooks}/placement_bank_seed_service.js`)
      bankSeed.seedBaselineBank(e.app, e.record)
    }
  } catch (error) {
    console.log(`[placement-bank] baseline seed failed: ${String(error)}`)
  }
  e.next()
}, 'users')

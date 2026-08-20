import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './visual-review',
  testMatch: ['phase18a.spec.ts', 'phase18a-clean-public.spec.ts'],
  timeout: 600_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  outputDir: 'visual-review-results',
})

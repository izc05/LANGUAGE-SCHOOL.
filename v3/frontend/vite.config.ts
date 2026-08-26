import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  // loadEnv merges matching variables already present in the process environment
  // with Vite's .env files, so the config can validate them without depending on
  // Node globals/types in the frontend TypeScript project.
  const env = loadEnv(mode, '.', 'VITE_')
  const appMode = (env.VITE_APP_MODE ?? '').trim().toLowerCase()
  const pocketBaseUrl = (env.VITE_POCKETBASE_URL ?? '').trim()
  const turnstileSiteKey = (env.VITE_TURNSTILE_SITE_KEY ?? '').trim()

  if (command === 'build') {
    if (appMode !== 'demo' && appMode !== 'connected') {
      throw new Error('Production build requires VITE_APP_MODE=demo or VITE_APP_MODE=connected.')
    }

    if (appMode === 'connected' && !pocketBaseUrl) {
      throw new Error('Connected production build requires VITE_POCKETBASE_URL.')
    }

    if (appMode === 'connected' && !turnstileSiteKey) {
      throw new Error('Connected production build requires VITE_TURNSTILE_SITE_KEY.')
    }
  }

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
    },
  }
})

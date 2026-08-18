import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), 'VITE_')
  const appMode = (process.env.VITE_APP_MODE ?? loadedEnv.VITE_APP_MODE ?? '').trim().toLowerCase()
  const pocketBaseUrl = (process.env.VITE_POCKETBASE_URL ?? loadedEnv.VITE_POCKETBASE_URL ?? '').trim()

  if (command === 'build') {
    if (appMode !== 'demo' && appMode !== 'connected') {
      throw new Error('Production build requires VITE_APP_MODE=demo or VITE_APP_MODE=connected.')
    }

    if (appMode === 'connected' && !pocketBaseUrl) {
      throw new Error('Connected production build requires VITE_POCKETBASE_URL.')
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

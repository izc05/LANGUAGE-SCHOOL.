export type AppMode = 'demo' | 'connected'

const rawMode = import.meta.env.VITE_APP_MODE?.trim().toLowerCase()

if (rawMode !== 'demo' && rawMode !== 'connected') {
  throw new Error('VITE_APP_MODE must be explicitly set to "demo" or "connected".')
}

if (import.meta.env.PROD && rawMode !== 'connected') {
  throw new Error('Production builds require VITE_APP_MODE=connected.')
}

export const appMode: AppMode = rawMode

const configuredPocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL?.trim()
if (appMode === 'connected' && !configuredPocketBaseUrl) {
  throw new Error('VITE_POCKETBASE_URL is required when VITE_APP_MODE=connected.')
}

export const pocketBaseUrl = configuredPocketBaseUrl || 'http://127.0.0.1:8090'
export const isDemoMode = appMode === 'demo'

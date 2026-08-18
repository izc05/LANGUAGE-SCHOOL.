export type AppMode = 'demo' | 'connected'

const rawMode = import.meta.env.VITE_APP_MODE?.trim().toLowerCase()

function resolveAppMode(): AppMode {
  if (rawMode === 'demo' || rawMode === 'connected') return rawMode

  // Local development remains easy to preview, but production builds must
  // deliberately choose whether they are demo or connected. This prevents a
  // deployment from silently becoming a demo because an environment variable
  // was forgotten.
  if (import.meta.env.DEV) return 'demo'

  throw new Error('VITE_APP_MODE must be explicitly set to demo or connected for production builds.')
}

export const appMode: AppMode = resolveAppMode()

const configuredPocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL?.trim() || ''
const configuredTurnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || ''

if (appMode === 'connected' && !configuredPocketBaseUrl) {
  throw new Error('VITE_POCKETBASE_URL is required when VITE_APP_MODE=connected.')
}
if (appMode === 'connected' && !configuredTurnstileSiteKey) {
  throw new Error('VITE_TURNSTILE_SITE_KEY is required when VITE_APP_MODE=connected.')
}

export const pocketBaseUrl = configuredPocketBaseUrl || 'http://127.0.0.1:8090'
export const turnstileSiteKey = configuredTurnstileSiteKey
export const isDemoMode = appMode === 'demo'

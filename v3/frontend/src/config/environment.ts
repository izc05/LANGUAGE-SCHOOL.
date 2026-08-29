export type AppMode = 'demo' | 'connected'

const rawMode = import.meta.env.VITE_APP_MODE?.trim().toLowerCase()

export const appMode: AppMode = rawMode === 'connected' ? 'connected' : 'demo'
export const pocketBaseUrl = import.meta.env.VITE_POCKETBASE_URL?.trim() || 'http://127.0.0.1:8090'
export const isDemoMode = appMode === 'demo'

import { pocketBaseUrl } from '../../config/environment'

export type BackendHealth = {
  ok: boolean
  checkedAt: string
  latencyMs: number
}

export async function checkBackendHealth(timeoutMs = 4000): Promise<BackendHealth> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  const started = performance.now()

  try {
    const response = await fetch(`${pocketBaseUrl.replace(/\/$/, '')}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })

    return {
      ok: response.ok,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - started),
    }
  } catch {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - started),
    }
  } finally {
    window.clearTimeout(timer)
  }
}

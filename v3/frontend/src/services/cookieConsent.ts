export type CookieConsentPreferences = {
  necessary: true
  preferences: boolean
  analytics: boolean
  marketing: boolean
  updatedAt: string
}

export type CookieConsentCategory = 'necessary' | 'preferences' | 'analytics' | 'marketing'

const STORAGE_KEY = 'language-school-cookie-consent-v1'
const CHANGE_EVENT = 'language-school:cookie-consent-change'
const OPEN_EVENT = 'language-school:cookie-consent-open'
// The AEPD cookie guide treats a validity period longer than 24 months as a
// poor practice. Expiring a decision also makes a changed cookie inventory
// visible to returning visitors instead of silently relying on an old choice.
const CONSENT_MAX_AGE_MS = 24 * 30 * 24 * 60 * 60 * 1000

export function readCookieConsent(): CookieConsentPreferences | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : ''
    const updatedAtMs = Date.parse(updatedAt)
    if (!Number.isFinite(updatedAtMs) || Date.now() - updatedAtMs >= CONSENT_MAX_AGE_MS) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return {
      necessary: true,
      preferences: parsed.preferences === true,
      analytics: parsed.analytics === true,
      marketing: parsed.marketing === true,
      updatedAt,
    }
  } catch {
    return null
  }
}

export function writeCookieConsent(input: Omit<CookieConsentPreferences, 'necessary' | 'updatedAt'>): CookieConsentPreferences {
  const value: CookieConsentPreferences = {
    necessary: true,
    preferences: input.preferences,
    analytics: input.analytics,
    marketing: input.marketing,
    updatedAt: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) } catch { /* storage may be unavailable */ }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }))
  }
  return value
}

export function hasCookieConsent(category: CookieConsentCategory): boolean {
  if (category === 'necessary') return true
  const current = readCookieConsent()
  return current?.[category] === true
}

export function subscribeCookieConsent(listener: (value: CookieConsentPreferences | null) => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  const onChange = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail as CookieConsentPreferences : readCookieConsent()
    listener(detail ?? readCookieConsent())
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(readCookieConsent())
  }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function requestCookieSettings(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_EVENT))
}

export function subscribeCookieSettingsRequest(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(OPEN_EVENT, listener)
  return () => window.removeEventListener(OPEN_EVENT, listener)
}

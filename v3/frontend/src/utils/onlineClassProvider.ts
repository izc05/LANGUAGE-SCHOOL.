export type OnlineClassProvider = 'ZOOM' | 'GOOGLE_MEET'

export function getOnlineClassProvider(value?: string): OnlineClassProvider {
  const raw = value?.trim() || ''
  if (!raw) return 'ZOOM'

  try {
    const url = new URL(raw)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    if (url.protocol === 'https:' && hostname === 'meet.google.com') return 'GOOGLE_MEET'
  } catch {
    // Invalid URLs are rejected by the existing class delivery services.
  }

  return 'ZOOM'
}

export function onlineClassProviderLabel(provider: OnlineClassProvider): string {
  return provider === 'GOOGLE_MEET' ? 'Google Meet' : 'Zoom'
}

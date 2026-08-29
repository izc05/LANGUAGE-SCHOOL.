export type OnlineClassProvider = 'ZOOM' | 'GOOGLE_MEET' | 'JITSI' | 'MICROSOFT_TEAMS' | 'EXTERNAL'

const providers: OnlineClassProvider[] = ['ZOOM', 'GOOGLE_MEET', 'JITSI', 'MICROSOFT_TEAMS', 'EXTERNAL']

export function isOnlineClassProvider(value?: string): value is OnlineClassProvider {
  return providers.includes(value as OnlineClassProvider)
}

export function getOnlineClassProvider(value?: string, configuredProvider?: string): OnlineClassProvider {
  if (isOnlineClassProvider(configuredProvider)) return configuredProvider
  const raw = value?.trim() || ''
  if (!raw) return 'ZOOM'

  try {
    const url = new URL(raw)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    if (url.protocol === 'https:' && hostname === 'meet.google.com') return 'GOOGLE_MEET'
    if (url.protocol === 'https:' && hostname === 'meet.jit.si') return 'JITSI'
    if (url.protocol === 'https:' && ['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'].includes(hostname)) return 'MICROSOFT_TEAMS'
    if (url.protocol === 'https:' && (hostname === 'zoom.us' || hostname.endsWith('.zoom.us'))) return 'ZOOM'
  } catch {
    // Invalid URLs are rejected by the existing class delivery services.
  }

  // Legacy classes without an explicit provider used every non-Meet URL as
  // the Zoom fallback. The migration assigns EXTERNAL to unknown URLs.
  return 'ZOOM'
}

export function onlineClassProviderLabel(provider: OnlineClassProvider): string {
  if (provider === 'GOOGLE_MEET') return 'Google Meet'
  if (provider === 'JITSI') return 'Jitsi Meet'
  if (provider === 'MICROSOFT_TEAMS') return 'Microsoft Teams'
  if (provider === 'EXTERNAL') return 'Enlace externo'
  return 'Zoom'
}

export function providerNeedsManualUrl(provider: OnlineClassProvider): boolean {
  return provider === 'GOOGLE_MEET' || provider === 'MICROSOFT_TEAMS' || provider === 'EXTERNAL'
}

export function normalizeProviderUrl(provider: OnlineClassProvider, value?: string): string {
  const raw = value?.trim() || ''
  if (!raw) {
    if (providerNeedsManualUrl(provider)) throw new Error(`${onlineClassProviderLabel(provider)} necesita un enlace https.`)
    return ''
  }

  let parsed: URL
  try { parsed = new URL(raw) } catch { throw new Error('El enlace de videoclase debe ser una URL https válida.') }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('El enlace de videoclase debe ser una URL https válida.')
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (provider === 'GOOGLE_MEET' && hostname !== 'meet.google.com') throw new Error('El enlace no pertenece a Google Meet.')
  if (provider === 'JITSI' && hostname !== 'meet.jit.si') throw new Error('El enlace no pertenece a Jitsi Meet.')
  if (provider === 'MICROSOFT_TEAMS' && !['teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft'].includes(hostname)) {
    throw new Error('El enlace no pertenece a Microsoft Teams.')
  }
  return parsed.toString()
}

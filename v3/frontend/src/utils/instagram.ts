export function normalizeInstagramPublicPostUrl(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null

  try {
    const url = new URL(raw)
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    if (url.protocol !== 'https:' || hostname !== 'instagram.com') return null

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null

    const kind = parts[0].toLowerCase()
    const shortcode = parts[1]
    if (!['p', 'reel', 'reels', 'tv'].includes(kind)) return null
    if (!/^[A-Za-z0-9_-]+$/.test(shortcode)) return null

    const canonicalKind = kind === 'reels' ? 'reel' : kind
    return `https://www.instagram.com/${canonicalKind}/${shortcode}/`
  } catch {
    return null
  }
}

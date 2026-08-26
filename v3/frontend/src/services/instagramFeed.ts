import { pocketBaseUrl } from '../config/environment'

export type InstagramMediaKind = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REEL'

export type InstagramFeedItem = {
  id: string
  caption: string
  kind: InstagramMediaKind
  imageUrl: string
  permalink: string
  timestamp: string
}

export type InstagramFeed = {
  enabled: boolean
  username: string
  profileUrl: string
  items: InstagramFeedItem[]
  updatedAt: string
  cached?: boolean
  stale?: boolean
}

const instagramFeedEndpoint = `${pocketBaseUrl.replace(/\/$/, '')}/api/language-school/instagram/feed`

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function isInstagramKind(value: unknown): value is InstagramMediaKind {
  return value === 'IMAGE' || value === 'VIDEO' || value === 'CAROUSEL_ALBUM' || value === 'REEL'
}

function normalizeFeed(value: unknown): InstagramFeed {
  if (!value || typeof value !== 'object') throw new Error('Invalid Instagram feed response.')

  const source = value as Record<string, unknown>
  const rawItems = Array.isArray(source.items) ? source.items : []
  const items = rawItems.flatMap((rawItem): InstagramFeedItem[] => {
    if (!rawItem || typeof rawItem !== 'object') return []
    const item = rawItem as Record<string, unknown>
    const id = readString(item.id)
    const imageUrl = readString(item.imageUrl)
    const permalink = readString(item.permalink)
    const kind = item.kind
    if (!id || !imageUrl || !permalink || !isInstagramKind(kind)) return []

    return [{
      id,
      caption: readString(item.caption),
      kind,
      imageUrl,
      permalink,
      timestamp: readString(item.timestamp),
    }]
  })

  return {
    enabled: source.enabled === true,
    username: readString(source.username),
    profileUrl: readString(source.profileUrl),
    items,
    updatedAt: readString(source.updatedAt),
    cached: source.cached === true,
    stale: source.stale === true,
  }
}

export async function getInstagramFeed(signal?: AbortSignal): Promise<InstagramFeed> {
  const response = await fetch(instagramFeedEndpoint, {
    method: 'GET',
    headers: { accept: 'application/json' },
    cache: 'no-store',
    signal,
  })

  if (!response.ok) throw new Error(`Instagram feed request failed (${response.status}).`)
  return normalizeFeed(await response.json())
}

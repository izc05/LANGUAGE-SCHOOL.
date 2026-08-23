let instagramFeedCache = {
  expiresAt: 0,
  staleUntil: 0,
  payload: null,
}

routerAdd('GET', '/api/language-school/instagram/feed', (e) => {
  const readText = (value) => typeof value === 'string' ? value.trim() : ''
  const readInt = (value, fallback, minimum, maximum) => {
    const parsed = Number.parseInt(readText(value), 10)
    if (!Number.isFinite(parsed)) return fallback
    return Math.max(minimum, Math.min(maximum, parsed))
  }
  const logger = $app.logger()
  const enabled = readText($os.getenv('INSTAGRAM_FEED_ENABLED')).toLowerCase() === 'true'

  if (!enabled) return e.json(200, { enabled: false, username: '', profileUrl: '', items: [], updatedAt: '' })

  const accessToken = readText($os.getenv('INSTAGRAM_ACCESS_TOKEN'))
  if (!accessToken) {
    logger.warn('[instagram] Feed enabled without access token', 'stage', 'configuration')
    return e.json(200, { enabled: false, username: '', profileUrl: '', items: [], updatedAt: '' })
  }

  const apiVersion = readText($os.getenv('INSTAGRAM_API_VERSION')) || 'v26.0'
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    logger.error('[instagram] Invalid API version', 'stage', 'configuration')
    return e.json(200, { enabled: false, username: '', profileUrl: '', items: [], updatedAt: '' })
  }

  const limit = readInt($os.getenv('INSTAGRAM_FEED_LIMIT'), 9, 1, 12)
  const cacheSeconds = readInt($os.getenv('INSTAGRAM_CACHE_SECONDS'), 900, 60, 3600)
  const staleSeconds = Math.max(cacheSeconds, 86400)
  const now = Math.floor(Date.now() / 1000)

  const responseFromCache = (stale) => ({
    enabled: true,
    username: instagramFeedCache.payload.username,
    profileUrl: instagramFeedCache.payload.profileUrl,
    items: instagramFeedCache.payload.items,
    updatedAt: instagramFeedCache.payload.updatedAt,
    cached: true,
    stale,
  })

  if (instagramFeedCache.payload && now < instagramFeedCache.expiresAt) {
    return e.json(200, responseFromCache(false))
  }

  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username'
  const requestUrl = `https://graph.instagram.com/${apiVersion}/me/media?fields=${encodeURIComponent(fields)}&limit=${limit}`

  let response
  try {
    response = $http.send({
      url: requestUrl,
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      timeout: 10,
    })
  } catch (_) {
    logger.warn('[instagram] Meta request failed', 'stage', 'request')
    if (instagramFeedCache.payload && now < instagramFeedCache.staleUntil) return e.json(200, responseFromCache(true))
    return e.json(200, { enabled: true, username: '', profileUrl: '', items: [], updatedAt: '', unavailable: true })
  }

  if (response.statusCode !== 200 || !response.json || !Array.isArray(response.json.data)) {
    logger.warn('[instagram] Meta returned an unusable response', 'stage', 'response', 'status', Number(response.statusCode || 0))
    if (instagramFeedCache.payload && now < instagramFeedCache.staleUntil) return e.json(200, responseFromCache(true))
    return e.json(200, { enabled: true, username: '', profileUrl: '', items: [], updatedAt: '', unavailable: true })
  }

  const items = response.json.data.flatMap((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') return []
    const id = readText(rawItem.id)
    const caption = readText(rawItem.caption).slice(0, 420)
    const mediaType = readText(rawItem.media_type)
    const mediaUrl = readText(rawItem.media_url)
    const thumbnailUrl = readText(rawItem.thumbnail_url)
    const permalink = readText(rawItem.permalink)
    const timestamp = readText(rawItem.timestamp)
    const imageUrl = mediaType === 'VIDEO' ? (thumbnailUrl || mediaUrl) : (mediaUrl || thumbnailUrl)

    if (!id || !imageUrl.startsWith('https://') || !permalink.startsWith('https://www.instagram.com/')) return []

    let kind = mediaType === 'CAROUSEL_ALBUM' ? 'CAROUSEL_ALBUM' : mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE'
    if (kind === 'VIDEO' && permalink.indexOf('/reel/') !== -1) kind = 'REEL'

    return [{ id, caption, kind, imageUrl, permalink, timestamp }]
  })

  const firstUsername = response.json.data
    .map((item) => readText(item && item.username))
    .find((value) => /^[A-Za-z0-9._]{1,30}$/.test(value)) || ''
  const updatedAt = new Date().toISOString()
  const payload = {
    enabled: true,
    username: firstUsername,
    profileUrl: firstUsername ? `https://www.instagram.com/${firstUsername}/` : '',
    items,
    updatedAt,
  }

  instagramFeedCache = {
    expiresAt: now + cacheSeconds,
    staleUntil: now + staleSeconds,
    payload,
  }

  return e.json(200, {
    enabled: payload.enabled,
    username: payload.username,
    profileUrl: payload.profileUrl,
    items: payload.items,
    updatedAt: payload.updatedAt,
    cached: false,
    stale: false,
  })
})

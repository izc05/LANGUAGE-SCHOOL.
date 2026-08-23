import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import { getInstagramFeed, type InstagramFeed as InstagramFeedData, type InstagramFeedItem } from '../services/instagramFeed'
import '../styles/instagram-feed.css'

type FeedState =
  | { status: 'loading' }
  | { status: 'hidden' }
  | { status: 'ready'; feed: InstagramFeedData }

function labelFor(item: InstagramFeedItem): string {
  if (item.kind === 'REEL') return 'Reel'
  if (item.kind === 'VIDEO') return 'Vídeo'
  if (item.kind === 'CAROUSEL_ALBUM') return 'Carrusel'
  return 'Publicación'
}

function accessibleLabel(item: InstagramFeedItem, username: string): string {
  const prefix = username ? `${labelFor(item)} de @${username}` : `${labelFor(item)} de Instagram`
  const compactCaption = item.caption.replace(/\s+/g, ' ').trim().slice(0, 140)
  return compactCaption ? `${prefix}: ${compactCaption}` : prefix
}

export default function InstagramFeed() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [state, setState] = useState<FeedState>({ status: 'loading' })

  useEffect(() => {
    setTarget(isHome ? document.getElementById('main-content') : null)
  }, [isHome, location.key])

  useEffect(() => {
    if (!isHome) {
      setState({ status: 'hidden' })
      return
    }

    const controller = new AbortController()
    setState({ status: 'loading' })

    getInstagramFeed(controller.signal)
      .then((feed) => {
        if (!feed.enabled || feed.items.length === 0) {
          setState({ status: 'hidden' })
          return
        }
        setState({ status: 'ready', feed })
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ status: 'hidden' })
      })

    return () => controller.abort()
  }, [isHome])

  const visibleItems = useMemo(
    () => state.status === 'ready' ? state.feed.items.slice(0, 9) : [],
    [state],
  )

  if (!isHome || !target || state.status !== 'ready') return null

  const { feed } = state
  const profileUrl = feed.profileUrl || visibleItems[0]?.permalink || 'https://www.instagram.com/'
  const profileLabel = feed.username ? `@${feed.username}` : 'Instagram'

  return createPortal(
    <section className="instagram-feed-section" aria-labelledby="instagram-feed-title">
      <div className="container instagram-feed-inner">
        <div className="instagram-feed-heading">
          <div>
            <span className="eyebrow">DESDE INSTAGRAM</span>
            <h2 id="instagram-feed-title">Lo último de <em>Language School.</em></h2>
            <p>Clases, actividades y pequeños momentos de la academia, actualizados automáticamente desde Instagram.</p>
          </div>
          <a className="instagram-profile-link" href={profileUrl} target="_blank" rel="noreferrer">
            <span aria-hidden="true">◎</span>
            <strong>{profileLabel}</strong>
            <small>Ver perfil ↗</small>
          </a>
        </div>

        <div className="instagram-feed-grid">
          {visibleItems.map((item) => (
            <a
              className="instagram-feed-card"
              href={item.permalink}
              target="_blank"
              rel="noreferrer"
              key={item.id}
              aria-label={accessibleLabel(item, feed.username)}
            >
              <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
              <span className="instagram-feed-badge">{labelFor(item)}</span>
              <span className="instagram-feed-overlay" aria-hidden="true">
                <strong>{feed.username ? `@${feed.username}` : 'Language School'}</strong>
                {item.caption && <small>{item.caption}</small>}
                <i>Ver en Instagram ↗</i>
              </span>
            </a>
          ))}
        </div>

        {feed.stale && <p className="instagram-feed-status">Mostrando la última copia disponible mientras Instagram vuelve a responder.</p>}
      </div>
    </section>,
    target,
  )
}

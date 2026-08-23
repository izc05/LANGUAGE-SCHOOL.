import { useEffect, useRef, useState } from 'react'
import { normalizeInstagramPublicPostUrl } from '../utils/instagram'
import '../styles/instagram-blog-embed.css'

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process: () => void
      }
    }
  }
}

const INSTAGRAM_EMBED_SCRIPT_ID = 'language-school-instagram-embed-script'

function ensureInstagramEmbedScript(): Promise<void> {
  if (window.instgrm?.Embeds?.process) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const currentScript = document.getElementById(INSTAGRAM_EMBED_SCRIPT_ID) as HTMLScriptElement | null
    if (currentScript) {
      currentScript.addEventListener('load', () => resolve(), { once: true })
      currentScript.addEventListener('error', () => reject(new Error('Instagram embed script failed.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = INSTAGRAM_EMBED_SCRIPT_ID
    script.src = 'https://www.instagram.com/embed.js'
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Instagram embed script failed.')), { once: true })
    document.body.appendChild(script)
  })
}

type InstagramBlogEmbedProps = {
  url: string
  title?: string
}

export default function InstagramBlogEmbed({ url, title = 'Publicación de Instagram' }: InstagramBlogEmbedProps) {
  const normalizedUrl = normalizeInstagramPublicPostUrl(url)
  const [enabled, setEnabled] = useState(false)
  const [failed, setFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled || !normalizedUrl) return

    let active = true
    setFailed(false)

    ensureInstagramEmbedScript()
      .then(() => {
        if (!active) return
        window.instgrm?.Embeds?.process()
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
    }
  }, [enabled, normalizedUrl])

  if (!normalizedUrl) return null

  if (!enabled || failed) {
    return (
      <section className="instagram-blog-consent" aria-label="Contenido de Instagram">
        <div className="instagram-blog-consent-mark" aria-hidden="true">◎</div>
        <div>
          <span className="eyebrow">INSTAGRAM</span>
          <h2>{failed ? 'No se ha podido cargar la publicación.' : 'Publicación original de Instagram'}</h2>
          <p>
            {failed
              ? 'Puedes abrirla directamente en Instagram.'
              : 'Para proteger tu privacidad, Language School solo conecta con Instagram cuando decides cargar este contenido.'}
          </p>
          <div className="instagram-blog-consent-actions">
            {!failed && <button className="button button-primary" type="button" onClick={() => setEnabled(true)}>Ver publicación aquí</button>}
            <a className="button button-ghost" href={normalizedUrl} target="_blank" rel="noreferrer">Abrir en Instagram ↗</a>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="instagram-blog-embed" ref={containerRef}>
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={normalizedUrl}
        data-instgrm-version="14"
        style={{ margin: '0 auto', width: '100%', minWidth: 0 }}
      >
        <a href={normalizedUrl} target="_blank" rel="noreferrer">{title}</a>
      </blockquote>
    </div>
  )
}

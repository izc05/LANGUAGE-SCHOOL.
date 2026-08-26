import { useEffect, useState } from 'react'
import IntroOrbitArtwork from './premium/IntroOrbitArtwork'
import './premium/premium-intro.css'
import './premium/intro-orbit-refresh.css'

type IntroPageProps = {
  onEnter: () => void
  transitioning: boolean
}

export default function IntroPage({ onEnter, transitioning }: IntroPageProps) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    document.title = 'Language School · Rocío Ruiz'
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  function enterAcademy() {
    if (transitioning) return
    onEnter()
  }

  const classes = [
    'premium-intro',
    'intro-orbit-refresh',
    'brand-visible',
    'actions-visible',
    'settled',
    reducedMotion ? 'reduced-motion' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={classes}>
      <div className="intro-orbit-ambient" aria-hidden="true" />
      <IntroOrbitArtwork />

      <div className="premium-entry-actions intro-orbit-actions">
        <p className="premium-instruction">Bienvenido a Language School</p>
        <button
          className="premium-enter-button intro-enter-button"
          type="button"
          onClick={enterAcademy}
          disabled={transitioning}
        >
          <span>{transitioning ? 'ENTRANDO…' : 'ENTRAR'}</span>
          {!transitioning && <span aria-hidden="true" className="premium-enter-arrow">↗</span>}
        </button>
      </div>
    </main>
  )
}

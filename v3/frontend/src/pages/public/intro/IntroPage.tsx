import { useEffect, useState } from 'react'
import IntroOrbitArtwork from './premium/IntroOrbitArtwork'
import './premium/premium-intro.css'
import './premium/intro-orbit-refresh.css'

const ENTER_TRANSITION_MS = 520

type IntroPageProps = {
  onEnter: () => void
}

export default function IntroPage({ onEnter }: IntroPageProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [transitioning, setTransitioning] = useState(false)

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

    if (reducedMotion) {
      onEnter()
      return
    }

    setTransitioning(true)
    window.setTimeout(onEnter, ENTER_TRANSITION_MS)
  }

  const classes = [
    'premium-intro',
    'intro-orbit-refresh',
    'brand-visible',
    'actions-visible',
    'settled',
    reducedMotion ? 'reduced-motion' : '',
    transitioning ? 'is-transitioning' : '',
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

      <div className="intro-orbit-transition" aria-hidden="true" />
    </main>
  )
}

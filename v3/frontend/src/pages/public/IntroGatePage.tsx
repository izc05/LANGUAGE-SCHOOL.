import { lazy, Suspense, useState } from 'react'
import HomePage from './HomePage'
import IntroSceneErrorBoundary from './intro/premium/IntroSceneErrorBoundary'
import IntroOrbitArtwork from './intro/premium/IntroOrbitArtwork'
import './intro/premium/premium-intro.css'
import './intro/premium/intro-orbit-refresh.css'

const IntroPage = lazy(() => import('./intro/IntroPage'))
const INTRO_SESSION_KEY = 'language-school:intro-completed'
const SAFE_ENTER_TRANSITION_MS = 520

function introAlreadyCompleted(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

function StaticIntroFallback({ onEnter }: { onEnter: () => void }) {
  const [transitioning, setTransitioning] = useState(false)

  function startEnter() {
    if (transitioning) return
    setTransitioning(true)
    window.setTimeout(onEnter, SAFE_ENTER_TRANSITION_MS)
  }

  const classes = [
    'premium-intro',
    'intro-orbit-refresh',
    'brand-visible',
    'actions-visible',
    'settled',
    transitioning ? 'is-transitioning' : '',
  ].filter(Boolean).join(' ')

  return (
    <main className={classes}>
      <div className="intro-orbit-ambient" aria-hidden="true" />
      <IntroOrbitArtwork withPlane={false} />

      <div className="premium-entry-actions intro-orbit-actions">
        <p className="premium-instruction">Bienvenido a Language School</p>
        <button
          className="premium-enter-button intro-enter-button"
          type="button"
          onClick={startEnter}
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

export default function IntroGatePage() {
  const [completed, setCompleted] = useState(introAlreadyCompleted)

  function enterAcademy() {
    try {
      window.sessionStorage.setItem(INTRO_SESSION_KEY, 'true')
    } catch {
      // La portada sigue accesible aunque el navegador bloquee sessionStorage.
    }
    window.scrollTo({ top: 0, left: 0 })
    setCompleted(true)
  }

  if (completed) return <HomePage />

  return (
    <IntroSceneErrorBoundary fallback={<StaticIntroFallback onEnter={enterAcademy} />}>
      <Suspense fallback={<div className="intro-loading" role="status">Preparando la entrada…</div>}>
        <IntroPage onEnter={enterAcademy} />
      </Suspense>
    </IntroSceneErrorBoundary>
  )
}

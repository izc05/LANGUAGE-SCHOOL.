import { lazy, Suspense, useState } from 'react'
import HomePage from './HomePage'
import IntroSceneErrorBoundary from './intro/premium/IntroSceneErrorBoundary'
import StaticIntroSky from './intro/premium/StaticIntroSky'
import './intro/premium/premium-intro.css'
import './intro/premium/bubble-globe.css'
import './intro/premium/intro-final-tuning.css'

const IntroPage = lazy(() => import('./intro/IntroPage'))
const INTRO_SESSION_KEY = 'language-school:intro-completed'
const SAFE_CLOUD_TRANSITION_MS = 1200

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
    window.setTimeout(onEnter, SAFE_CLOUD_TRANSITION_MS)
  }

  return (
    <main className="premium-intro brand-visible actions-visible settled">
      <div className="premium-static-globe" aria-hidden="true" />
      <StaticIntroSky transitioning={transitioning} />
      <div className="premium-intro-glow" aria-hidden="true" />
      <div className="premium-intro-vignette" aria-hidden="true" />
      <div className="premium-intro-ui">
        <section className="premium-brand-lockup" aria-label="Language School Rocío Ruiz">
          <span className="premium-brand-language">LANGUAGE</span>
          <strong className="premium-brand-school">School</strong>
          <div className="premium-brand-divider" aria-hidden="true" />
          <span className="premium-brand-rocio">ROCÍO RUIZ</span>
        </section>
        <div className="premium-entry-actions">
          <p className="premium-instruction">Bienvenido a Language School</p>
          <button className="premium-enter-button intro-enter-button" type="button" onClick={startEnter} disabled={transitioning}>
            <span>{transitioning ? 'ENTRANDO…' : 'ENTRAR'}</span>
            {!transitioning && <span aria-hidden="true" className="premium-enter-arrow">↗</span>}
          </button>
        </div>
      </div>
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

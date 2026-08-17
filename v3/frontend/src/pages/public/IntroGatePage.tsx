import { lazy, Suspense, useState } from 'react'
import HomePage from './HomePage'
import IntroSceneErrorBoundary from './intro/premium/IntroSceneErrorBoundary'
import './intro/premium/premium-intro.css'

const IntroPage = lazy(() => import('./intro/IntroPage'))
const INTRO_SESSION_KEY = 'language-school:intro-completed'

function introAlreadyCompleted(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === 'true'
  } catch {
    return false
  }
}

function StaticIntroFallback({ onEnter }: { onEnter: () => void }) {
  return (
    <main className="premium-intro reduced-motion brand-visible actions-visible settled">
      <div className="premium-static-globe" aria-hidden="true" />
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
          <button className="premium-enter-button intro-enter-button" type="button" onClick={onEnter}>
            <span>ENTRAR</span>
            <span aria-hidden="true" className="premium-enter-arrow">↗</span>
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

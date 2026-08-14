import { lazy, Suspense, useState } from 'react'
import HomePage from './HomePage'

const IntroPage = lazy(() => import('./intro/IntroPage'))
const INTRO_SESSION_KEY = 'language-school:intro-completed'

function introAlreadyCompleted(): boolean {
  try {
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === 'true'
  } catch {
    return false
  }
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
    <Suspense fallback={<div className="intro-loading" role="status">Preparando la entrada…</div>}>
      <IntroPage onEnter={enterAcademy} />
    </Suspense>
  )
}

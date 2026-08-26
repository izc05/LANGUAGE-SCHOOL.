import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import '../styles/student-campus-entry-progress.css'

type ProgressPhase = 'idle' | 'starting' | 'advancing' | 'finishing'

const START_MS = 110
const ADVANCE_MS = 470
const FINISH_MS = 180
const CLEAR_MS = 120

function isStudentCampusPath(pathname: string) {
  return /^\/alumno(?:\/|$)/.test(pathname)
}

export default function StudentCampusEntryProgress() {
  const { pathname } = useLocation()
  const previousPathRef = useRef<string | null>(null)
  const timersRef = useRef<number[]>([])
  const [phase, setPhase] = useState<ProgressPhase>('idle')

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer))
      timersRef.current = []
    }
  }, [])

  useEffect(() => {
    const previousPath = previousPathRef.current
    previousPathRef.current = pathname

    const enteringCampus = isStudentCampusPath(pathname) &&
      (previousPath === null || !isStudentCampusPath(previousPath))

    if (!enteringCampus) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []

    setPhase('starting')

    const advanceTimer = window.setTimeout(() => setPhase('advancing'), START_MS)
    const finishTimer = window.setTimeout(() => setPhase('finishing'), START_MS + ADVANCE_MS)
    const clearTimer = window.setTimeout(
      () => setPhase('idle'),
      START_MS + ADVANCE_MS + FINISH_MS + CLEAR_MS,
    )

    timersRef.current.push(advanceTimer, finishTimer, clearTimer)
  }, [pathname])

  return (
    <div
      className={`student-campus-entry-progress student-campus-entry-progress--${phase}`}
      aria-hidden="true"
      data-testid="student-campus-entry-progress"
    >
      <div className="student-campus-entry-progress__track">
        <div className="student-campus-entry-progress__bar">
          <span className="student-campus-entry-progress__glow" />
        </div>
      </div>
      <div className="student-campus-entry-progress__label">Preparando tu campus</div>
    </div>
  )
}

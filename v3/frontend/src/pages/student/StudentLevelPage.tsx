import { useEffect, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PlacementAudioPlayer from '../../components/PlacementAudioPlayer'
import { isDemoMode } from '../../config/environment'
import {
  answerCampusPlacementQuestion,
  finishCampusPlacementTest,
  getCampusLevelSummary,
  getNextCampusPlacementQuestion,
  startCampusPlacementTest,
  type CampusLevelSummary,
  type CampusPlacementQuestion,
  type CampusPlacementResult,
  type CampusPlacementSession,
} from '../../services/pocketbase/studentLevel'
import type { CefrLevel, PlacementSkill } from '../../services/pocketbase/placementTest'
import { studentNav } from './studentNav'

const skillLabels: Record<PlacementSkill, string> = {
  GRAMMAR: 'Gramática',
  VOCABULARY: 'Vocabulario',
  READING: 'Comprensión lectora',
  LISTENING: 'Comprensión oral',
}

const skillOrder: PlacementSkill[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING']

const levelCopy: Record<CefrLevel, string> = {
  A1: 'Base inicial',
  A2: 'Base funcional',
  B1: 'Intermedio',
  B2: 'Intermedio alto',
  C1: 'Avanzado',
  C2: 'Dominio muy avanzado',
}

const demoSummary: CampusLevelSummary = {
  currentLevel: 'B1',
  currentLevelSource: 'AUTOMATIC',
  latestAttempt: {
    attemptId: 'demo-level-attempt', mode: 'CAMPUS', status: 'COMPLETED', algorithmVersion: 'cefr-v1',
    estimatedLevel: 'B1', rawScore: 19, maxScore: 30, scorePercent: 63.33,
    skillScores: {
      GRAMMAR: { correct: 7, total: 10, percent: 70 },
      VOCABULARY: { correct: 6, total: 10, percent: 60 },
      READING: { correct: 6, total: 10, percent: 60 },
    },
    completedAt: '2026-07-18T10:00:00Z', notice: 'Resultado orientativo basado en el MCER; la academia puede validarlo posteriormente.',
  },
  latestAssessment: null,
  history: [],
  activeAttempt: null,
  retake: { allowed: true, days: 30, nextAvailableAt: '' },
  campusQuestionCount: 30,
}

function toPlainText(value: string): string {
  if (!value) return ''
  const documentValue = new DOMParser().parseFromString(value, 'text/html')
  return documentValue.body.textContent?.trim() || ''
}

function formatDate(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function sourceLabel(source: CampusLevelSummary['currentLevelSource']): string {
  if (source === 'VALIDATED') return 'Nivel validado por la academia'
  if (source === 'AUTOMATIC') return 'Última estimación automática'
  return 'Pendiente de evaluación'
}

function resultSkills(result: CampusPlacementResult | null | undefined): PlacementSkill[] {
  return skillOrder.filter((skill) => Boolean(result?.skillScores[skill]))
}

export default function StudentLevelPage() {
  const [summary, setSummary] = useState<CampusLevelSummary | null>(isDemoMode ? demoSummary : null)
  const [session, setSession] = useState<CampusPlacementSession | null>(null)
  const [question, setQuestion] = useState<CampusPlacementQuestion | null>(null)
  const [selectedOption, setSelectedOption] = useState('')
  const [completedResult, setCompletedResult] = useState<CampusPlacementResult | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const loadSummary = async () => {
    if (isDemoMode) return
    setLoading(true)
    setError('')
    try {
      setSummary(await getCampusLevelSummary())
    } catch {
      setError('No hemos podido cargar tu nivel ahora mismo. Prueba de nuevo en unos segundos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadSummary() }, [])

  const beginOrResume = async () => {
    if (busy || isDemoMode) return
    setBusy(true)
    setError('')
    setCompletedResult(null)
    try {
      const nextSession = await startCampusPlacementTest()
      const nextQuestion = await getNextCampusPlacementQuestion(nextSession)
      if (nextQuestion.complete) throw new Error('No hay una pregunta disponible en este intento.')
      setSession(nextSession)
      setQuestion(nextQuestion)
      setSelectedOption('')
    } catch {
      setError('No hemos podido abrir la evaluación. Revisa la fecha de repetición o vuelve a intentarlo.')
      await loadSummary()
    } finally {
      setBusy(false)
    }
  }

  const submitAnswer = async () => {
    if (!session || !question || !selectedOption || busy) return
    setBusy(true)
    setError('')
    try {
      await answerCampusPlacementQuestion(session, question.question.id, selectedOption)
      const next = await getNextCampusPlacementQuestion(session)
      if (next.complete) {
        const result = await finishCampusPlacementTest(session)
        setCompletedResult(result)
        setSession(null)
        setQuestion(null)
        await loadSummary()
      } else {
        setQuestion(next)
      }
      setSelectedOption('')
    } catch {
      setError('No hemos podido guardar la respuesta. Inténtalo de nuevo antes de continuar.')
    } finally {
      setBusy(false)
    }
  }

  const currentLevel = summary?.currentLevel || ''
  const progress = question ? Math.round((question.position / question.total) * 100) : 0
  const canStart = Boolean(summary && !summary.activeAttempt && summary.retake.allowed)
  const canResume = Boolean(summary?.activeAttempt)
  const nextRetake = summary?.retake.nextAvailableAt ? formatDate(summary.retake.nextAvailableAt) : ''
  const hasListening = Boolean(summary && (summary.campusQuestionCount > 30 || summary.latestAttempt?.skillScores.LISTENING))
  const competenceCount = hasListening ? 4 : 3

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-level-page">
        <header className="student-level-heading">
          <div>
            <span className="eyebrow">CAMPUS · MI NIVEL</span>
            <h2>Tu evolución en inglés, con <em>histórico real.</em></h2>
            <p>Consulta tu última evaluación, revisa cada competencia y repite el test cuando vuelva a estar disponible.</p>
          </div>
          <div className={`student-level-current source-${(summary?.currentLevelSource || 'NONE').toLowerCase()}`}>
            <small>{sourceLabel(summary?.currentLevelSource || 'NONE')}</small>
            <strong>{currentLevel || '—'}</strong>
            <span>{currentLevel ? levelCopy[currentLevel] : 'Aún no tienes un nivel evaluado'}</span>
          </div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando tu historial de nivel…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {!loading && summary && !question && (
          <>
            <section className="student-level-overview">
              <article className="panel student-level-action-card">
                <div>
                  <span className="eyebrow">EVALUACIÓN CAMPUS</span>
                  <h3>{canResume ? 'Tienes una evaluación empezada.' : summary.latestAttempt ? 'Tu evaluación está al día.' : 'Haz tu primera evaluación completa.'}</h3>
                  <p>{canResume
                    ? `Has respondido ${summary.activeAttempt?.answered || 0} de ${summary.activeAttempt?.totalQuestions || summary.campusQuestionCount} preguntas. Puedes continuar exactamente donde lo dejaste.`
                    : `La evaluación Campus utiliza ${summary.campusQuestionCount} preguntas de gramática, vocabulario, comprensión lectora${hasListening ? ' y comprensión oral diagnóstica' : ''}.`}</p>
                </div>
                <div className="student-level-action-meta">
                  <span><strong>{summary.campusQuestionCount}</strong> preguntas</span>
                  <span><strong>{competenceCount}</strong> competencias</span>
                  <span><strong>A1–C2</strong> estimación</span>
                </div>
                {canResume && <button className="button button-primary" type="button" onClick={() => void beginOrResume()} disabled={busy}>{busy ? 'Abriendo…' : 'Continuar evaluación'}</button>}
                {canStart && <button className="button button-primary" type="button" onClick={() => void beginOrResume()} disabled={busy}>{busy ? 'Preparando…' : summary.latestAttempt ? 'Repetir evaluación' : 'Empezar evaluación'}</button>}
                {!canResume && !summary.retake.allowed && <div className="student-level-retake"><strong>Próxima repetición</strong><span>{nextRetake}</span><small>La academia ha configurado un intervalo de {summary.retake.days} días entre evaluaciones Campus.</small></div>}
                {isDemoMode && <small className="muted">Modo demo: la evaluación interactiva está disponible en el Campus conectado.</small>}
              </article>

              <article className="panel student-level-latest">
                <div className="panel-heading"><div><span className="eyebrow">ÚLTIMA EVALUACIÓN</span><h3>{summary.latestAttempt ? formatDate(summary.latestAttempt.completedAt) : 'Sin evaluaciones'}</h3></div>{summary.latestAttempt && <span className="status info">{summary.latestAttempt.estimatedLevel}</span>}</div>
                {summary.latestAttempt ? (
                  <>
                    <div className="student-level-score"><strong>{Math.round(summary.latestAttempt.scorePercent)}%</strong><span>{summary.latestAttempt.rawScore} de {summary.latestAttempt.maxScore} respuestas correctas</span></div>
                    <div className="student-level-skill-list">
                      {resultSkills(summary.latestAttempt).map((skill) => {
                        const score = summary.latestAttempt?.skillScores[skill]
                        if (!score) return null
                        return <div className={score.diagnosticOnly ? 'is-diagnostic' : ''} key={skill}><span>{skillLabels[skill]}{score.diagnosticOnly ? ' · diagnóstico' : ''}</span><div className="student-level-skill-track"><i style={{ width: `${score.percent}%` }} /></div><strong>{Math.round(score.percent)}%</strong></div>
                      })}
                    </div>
                  </>
                ) : <p className="muted">Cuando completes tu primera evaluación, aquí aparecerán el nivel estimado y el detalle por competencias.</p>}
              </article>
            </section>

            {summary.latestAssessment && (
              <section className="panel student-level-validation">
                <div><span className="eyebrow">VALORACIÓN ACADÉMICA</span><h3>Nivel validado: {summary.latestAssessment.validatedLevel}</h3><p>Valoración registrada el {formatDate(summary.latestAssessment.assessedAt)}. La validación docente prevalece como referencia académica sin borrar tus resultados automáticos.</p></div>
                <div className="student-level-validation-values"><span>Automático <strong>{summary.latestAssessment.automaticLevel || '—'}</strong></span><span>Speaking <strong>{summary.latestAssessment.speakingLevel || '—'}</strong></span><span>Validado <strong>{summary.latestAssessment.validatedLevel}</strong></span></div>
              </section>
            )}

            {completedResult && <div className="student-level-complete" role="status"><strong>Evaluación completada · {completedResult.estimatedLevel}</strong><span>{Math.round(completedResult.scorePercent)}% de puntuación global. El resultado ya forma parte de tu histórico.{completedResult.skillScores.LISTENING ? ' Listening queda registrado como diagnóstico complementario.' : ''}</span></div>}

            <section className="student-level-history" aria-labelledby="student-level-history-title">
              <div className="student-level-history-heading"><div><span className="eyebrow">HISTÓRICO</span><h3 id="student-level-history-title">Tus evaluaciones Campus</h3></div><p>Los intentos completados se conservan; una nueva evaluación nunca sobrescribe la anterior.</p></div>
              {summary.history.length === 0 && <div className="panel student-level-empty">Todavía no hay evaluaciones completadas.</div>}
              {summary.history.length > 0 && <div className="student-level-history-list">{summary.history.map((attempt) => (
                <article className="panel" key={attempt.attemptId}>
                  <div><small>{formatDate(attempt.completedAt)}</small><strong>{attempt.estimatedLevel}</strong><span>{Math.round(attempt.scorePercent)}%</span></div>
                  <div>{resultSkills(attempt).map((skill) => {
                    const score = attempt.skillScores[skill]
                    if (!score) return null
                    return <span className={score.diagnosticOnly ? 'is-diagnostic' : ''} key={skill}>{skillLabels[skill]} <strong>{Math.round(score.percent)}%</strong>{score.diagnosticOnly ? ' · diagnóstico' : ''}</span>
                  })}</div>
                </article>
              ))}</div>}
            </section>
          </>
        )}

        {question && session && (
          <section className="student-level-run" aria-labelledby="student-level-question-title">
            <div className="student-level-progress-head"><div><span className="eyebrow">{skillLabels[question.question.skill]}</span><strong aria-live="polite">Pregunta {question.position} de {question.total}</strong></div><span>{progress}%</span></div>
            <div className="student-level-progress" role="progressbar" aria-label="Progreso de la evaluación Campus" aria-valuemin={1} aria-valuemax={question.total} aria-valuenow={question.position}><span style={{ width: `${progress}%` }} /></div>
            <article className="panel student-level-question-card">
              {question.question.hasAudio && <PlacementAudioPlayer attemptId={session.attemptId} questionId={question.question.id} />}
              {question.question.passage && <div className="student-level-passage"><span>LEE ESTE TEXTO</span><p>{toPlainText(question.question.passage)}</p></div>}
              <form onSubmit={(event) => { event.preventDefault(); void submitAnswer() }}>
                <fieldset disabled={busy}>
                  <legend id="student-level-question-title">{toPlainText(question.question.prompt)}</legend>
                  <div className="student-level-options">{question.question.options.map((option, index) => (
                    <label className={selectedOption === option.id ? 'is-selected' : ''} key={option.id}>
                      <input type="radio" name="campus-level-answer" value={option.id} checked={selectedOption === option.id} onChange={() => setSelectedOption(option.id)} aria-label={`Option ${String.fromCharCode(65 + index)}`} />
                      <span aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                      <strong>{toPlainText(option.label)}</strong>
                    </label>
                  ))}</div>
                </fieldset>
                <div className="student-level-question-actions"><p>Tu respuesta se guarda al continuar y no mostramos la corrección durante la evaluación.</p><button className="button button-primary" type="submit" disabled={!selectedOption || busy}>{busy ? 'Guardando…' : question.position === question.total ? 'Finalizar evaluación' : 'Confirmar respuesta'}</button></div>
              </form>
            </article>
          </section>
        )}
      </div>
    </DashboardShell>
  )
}
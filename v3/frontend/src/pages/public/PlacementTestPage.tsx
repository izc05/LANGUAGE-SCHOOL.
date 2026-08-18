import { useState } from 'react'
import SiteShell from '../../components/SiteShell'
import {
  answerPublicPlacementQuestion,
  finishPublicPlacementTest,
  getNextPublicPlacementQuestion,
  startPublicPlacementTest,
  type CefrLevel,
  type PlacementSkill,
  type PublicPlacementQuestion,
  type PublicPlacementResult,
  type PublicPlacementSession,
} from '../../services/pocketbase/placementTest'

const skillLabels: Record<PlacementSkill, string> = {
  GRAMMAR: 'Gramática',
  VOCABULARY: 'Vocabulario',
  READING: 'Comprensión lectora',
}

const levelCopy: Record<CefrLevel, { title: string; description: string }> = {
  A1: { title: 'Primeros pasos', description: 'Tienes una base inicial sobre la que podemos construir vocabulario, estructuras y confianza.' },
  A2: { title: 'Base funcional', description: 'Ya manejas situaciones habituales y estructuras frecuentes. El siguiente salto es ganar precisión y soltura.' },
  B1: { title: 'Nivel intermedio', description: 'Puedes desenvolverte en muchas situaciones cotidianas. Conviene reforzar precisión, comprensión y fluidez.' },
  B2: { title: 'Intermedio alto', description: 'Tienes una base sólida para comunicarte con bastante autonomía y abordar contenidos más exigentes.' },
  C1: { title: 'Nivel avanzado', description: 'Comprendes y utilizas el inglés con soltura en contextos variados. El trabajo se centra en matices y precisión.' },
  C2: { title: 'Dominio muy avanzado', description: 'Tu rendimiento en este test es muy alto. Una valoración docente puede afinar especialmente la expresión oral.' },
}

const skillOrder: PlacementSkill[] = ['GRAMMAR', 'VOCABULARY', 'READING']

function toPlainText(value: string): string {
  if (!value) return ''
  const documentValue = new DOMParser().parseFromString(value, 'text/html')
  return documentValue.body.textContent?.trim() || ''
}

export default function PlacementTestPage() {
  const [session, setSession] = useState<PublicPlacementSession | null>(null)
  const [question, setQuestion] = useState<PublicPlacementQuestion | null>(null)
  const [result, setResult] = useState<PublicPlacementResult | null>(null)
  const [selectedOption, setSelectedOption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const begin = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    setQuestion(null)
    setSelectedOption('')
    try {
      const nextSession = await startPublicPlacementTest()
      const nextQuestion = await getNextPublicPlacementQuestion(nextSession)
      if (nextQuestion.complete) throw new Error('El test publicado no contiene una pregunta disponible.')
      setSession(nextSession)
      setQuestion(nextQuestion)
    } catch {
      setSession(null)
      setError('No hemos podido iniciar el test ahora mismo. Puedes volver a intentarlo sin perder ningún dato personal.')
    } finally {
      setBusy(false)
    }
  }

  const submitAnswer = async () => {
    if (!session || !question || !selectedOption || busy) return
    setBusy(true)
    setError('')
    try {
      await answerPublicPlacementQuestion(session, question.question.id, selectedOption)
      const nextQuestion = await getNextPublicPlacementQuestion(session)
      if (nextQuestion.complete) {
        const finalResult = await finishPublicPlacementTest(session)
        setResult(finalResult)
        setQuestion(null)
      } else {
        setQuestion(nextQuestion)
      }
      setSelectedOption('')
    } catch {
      setError('No hemos podido guardar esta respuesta. Comprueba la conexión e inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const restart = () => {
    setSession(null)
    setQuestion(null)
    setResult(null)
    setSelectedOption('')
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const progress = question ? Math.round((question.position / question.total) * 100) : 0
  const resultCopy = result ? levelCopy[result.estimatedLevel] : null

  return (
    <SiteShell>
      <div className="placement-test-page">
        {!session && !result && (
          <section className="placement-test-intro" aria-labelledby="placement-test-title">
            <div className="container placement-test-intro-grid">
              <div className="placement-test-intro-copy">
                <span className="eyebrow">TEST DE NIVEL · 5–8 MINUTOS</span>
                <h1 id="placement-test-title">Descubre tu punto de partida en <em>inglés.</em></h1>
                <p className="placement-test-lead">15 preguntas breves para estimar tu nivel MCER de A1 a C2. No necesitas registrarte ni dejar tus datos para conocer el resultado.</p>
                <div className="placement-test-facts" aria-label="Características del test">
                  <span><strong>15</strong> preguntas</span>
                  <span><strong>3</strong> competencias</span>
                  <span><strong>A1–C2</strong> resultado orientativo</span>
                </div>
                <button className="button button-primary placement-test-start" type="button" onClick={() => void begin()} disabled={busy}>
                  {busy ? 'Preparando test…' : 'Empezar test'}
                </button>
                {error && <p className="placement-test-error" role="alert">{error}</p>}
              </div>

              <aside className="placement-test-intro-card" aria-label="Qué vamos a evaluar">
                <div className="placement-test-card-mark" aria-hidden="true">A1 <span>→</span> C2</div>
                <h2>Un test breve, sin convertirlo en un examen.</h2>
                <p>El motor combina preguntas de distinta dificultad y calcula el resultado únicamente cuando has terminado.</p>
                <ul>
                  <li><span aria-hidden="true">01</span><div><strong>Grammar</strong><small>Estructuras y uso del idioma</small></div></li>
                  <li><span aria-hidden="true">02</span><div><strong>Vocabulary</strong><small>Vocabulario en contexto</small></div></li>
                  <li><span aria-hidden="true">03</span><div><strong>Reading</strong><small>Comprensión de textos</small></div></li>
                </ul>
                <small className="placement-test-privacy-note">Sin nombre · sin email · sin registro previo</small>
              </aside>
            </div>
          </section>
        )}

        {session && question && !result && (
          <section className="placement-test-run" aria-labelledby="placement-question-title">
            <div className="container placement-test-run-shell">
              <div className="placement-test-progress-head">
                <div>
                  <span className="eyebrow">{skillLabels[question.question.skill]}</span>
                  <strong aria-live="polite">Pregunta {question.position} de {question.total}</strong>
                </div>
                <span aria-hidden="true">{progress}%</span>
              </div>
              <div
                className="placement-test-progress"
                role="progressbar"
                aria-label="Progreso del test"
                aria-valuemin={1}
                aria-valuemax={question.total}
                aria-valuenow={question.position}
              >
                <span style={{ width: `${progress}%` }} />
              </div>

              <article className="placement-question-card">
                {question.question.passage && (
                  <div className="placement-question-passage">
                    <span>LEE ESTE TEXTO</span>
                    <p>{toPlainText(question.question.passage)}</p>
                  </div>
                )}

                <form onSubmit={(event) => { event.preventDefault(); void submitAnswer() }}>
                  <fieldset disabled={busy}>
                    <legend id="placement-question-title">{toPlainText(question.question.prompt)}</legend>
                    <div className="placement-option-list">
                      {question.question.options.map((option, index) => (
                        <label className={`placement-option${selectedOption === option.id ? ' is-selected' : ''}`} key={option.id}>
                          <input
                            type="radio"
                            name="placement-answer"
                            value={option.id}
                            checked={selectedOption === option.id}
                            onChange={() => setSelectedOption(option.id)}
                          />
                          <span className="placement-option-key" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                          <span>{toPlainText(option.label)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div className="placement-question-actions">
                    <p>Elige una respuesta. Una vez confirmada pasaremos a la siguiente pregunta.</p>
                    <button className="button button-primary" type="submit" disabled={!selectedOption || busy}>
                      {busy ? 'Guardando…' : question.position === question.total ? 'Ver mi resultado' : 'Confirmar respuesta'}
                    </button>
                  </div>
                  {error && <p className="placement-test-error" role="alert">{error}</p>}
                </form>
              </article>
            </div>
          </section>
        )}

        {result && resultCopy && (
          <section className="placement-test-result" aria-labelledby="placement-result-title">
            <div className="container placement-result-shell">
              <div className="placement-result-summary">
                <span className="eyebrow">RESULTADO ORIENTATIVO · MCER</span>
                <div className="placement-result-level" aria-hidden="true">{result.estimatedLevel}</div>
                <h1 id="placement-result-title">Tu nivel estimado es {result.estimatedLevel}.</h1>
                <h2>{resultCopy.title}</h2>
                <p>{resultCopy.description}</p>
                <div className="placement-result-score"><strong>{Math.round(result.scorePercent)}%</strong><span>{result.rawScore} de {result.maxScore} respuestas correctas</span></div>
              </div>

              <div className="placement-result-detail">
                <div className="placement-result-skills">
                  {skillOrder.map((skill) => {
                    const score = result.skillScores[skill]
                    return (
                      <article key={skill}>
                        <div><span>{skillLabels[skill]}</span><strong>{Math.round(score?.percent ?? 0)}%</strong></div>
                        <div className="placement-skill-bar" aria-label={`${skillLabels[skill]} ${Math.round(score?.percent ?? 0)}%`}><span style={{ width: `${score?.percent ?? 0}%` }} /></div>
                        <small>{score?.correct ?? 0} de {score?.total ?? 0}</small>
                      </article>
                    )
                  })}
                </div>

                <div className="placement-result-notice">
                  <strong>¿Qué significa este resultado?</strong>
                  <p>{result.notice}</p>
                  <p>Esta prueba rápida evalúa gramática, vocabulario y comprensión lectora. No evalúa todavía speaking ni listening, así que no sustituye una valoración completa de la academia.</p>
                </div>

                <button className="button button-outline" type="button" onClick={restart}>Repetir el test</button>
              </div>
            </div>
          </section>
        )}
      </div>
    </SiteShell>
  )
}

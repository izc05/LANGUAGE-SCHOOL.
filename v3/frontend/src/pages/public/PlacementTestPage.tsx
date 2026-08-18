import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import {
  answerPublicPlacementQuestion,
  finishPublicPlacementTest,
  getNextPublicPlacementQuestion,
  getPublicPlacementRecommendations,
  startPublicPlacementTest,
  submitPublicPlacementContact,
  type CefrLevel,
  type PlacementSkill,
  type PublicPlacementQuestion,
  type PublicPlacementRecommendations,
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
  const [recommendations, setRecommendations] = useState<PublicPlacementRecommendations | null>(null)
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [recommendationError, setRecommendationError] = useState('')
  const [selectedOption, setSelectedOption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [contactOpen, setContactOpen] = useState(false)
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactMessage, setContactMessage] = useState('')
  const [contactSending, setContactSending] = useState(false)
  const [contactNotice, setContactNotice] = useState('')
  const [contactError, setContactError] = useState('')

  const resetConversion = () => {
    setRecommendations(null)
    setRecommendationsLoading(false)
    setRecommendationError('')
    setContactOpen(false)
    setContactName('')
    setContactEmail('')
    setContactPhone('')
    setContactMessage('')
    setContactSending(false)
    setContactNotice('')
    setContactError('')
  }

  const loadRecommendations = async (currentSession: PublicPlacementSession) => {
    setRecommendationsLoading(true)
    setRecommendationError('')
    try {
      setRecommendations(await getPublicPlacementRecommendations(currentSession))
    } catch {
      setRecommendations(null)
      setRecommendationError('No hemos podido cargar los programas recomendados ahora mismo. Tu resultado sigue siendo válido.')
    } finally {
      setRecommendationsLoading(false)
    }
  }

  const begin = async () => {
    setBusy(true)
    setError('')
    setResult(null)
    setQuestion(null)
    setSelectedOption('')
    resetConversion()
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
        void loadRecommendations(session)
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

  const submitContact = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session || !result || contactSending) return
    setContactError('')
    setContactNotice('')
    if (!contactName.trim() || !contactEmail.trim() || !contactMessage.trim()) {
      setContactError('Completa nombre, email y mensaje para que podamos orientarte.')
      return
    }
    setContactSending(true)
    try {
      await submitPublicPlacementContact(session, {
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        interest: `Orientación tras test ${result.estimatedLevel}`,
        message: contactMessage,
      })
      setContactNotice(`Solicitud enviada con tu resultado ${result.estimatedLevel}. La academia podrá orientarte con ese contexto.`)
      setContactOpen(false)
    } catch {
      setContactError('No hemos podido enviar la solicitud. Tu resultado no se pierde; puedes volver a intentarlo.')
    } finally {
      setContactSending(false)
    }
  }

  const restart = () => {
    setSession(null)
    setQuestion(null)
    setResult(null)
    setSelectedOption('')
    setError('')
    resetConversion()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
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

                <section className="placement-recommendations" aria-labelledby="placement-recommendations-title">
                  <div className="placement-recommendations-heading">
                    <div><span className="eyebrow">SIGUIENTE PASO</span><h2 id="placement-recommendations-title">Programas que encajan con tu {result.estimatedLevel}.</h2></div>
                    <small>La recomendación usa la compatibilidad MCER configurada por la academia.</small>
                  </div>

                  {recommendationsLoading && <p className="placement-recommendations-status" role="status">Buscando programas compatibles…</p>}
                  {recommendationError && <p className="placement-test-error" role="alert">{recommendationError}</p>}
                  {!recommendationsLoading && recommendations && recommendations.courses.length > 0 && (
                    <div className="placement-recommendation-grid">
                      {recommendations.courses.map((course) => (
                        <article className="placement-recommendation-card" key={course.id}>
                          <div><span>{course.cefrLevels.join(' · ')}</span><strong>{course.title}</strong></div>
                          <p>{course.description || 'Consulta el programa para conocer enfoque, grupos y disponibilidad.'}</p>
                          <div className="placement-recommendation-actions">
                            <small>Nivel visible: {course.level || 'por confirmar'}</small>
                            <Link to={`/programas/${course.slug}`}>Ver programa →</Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  {!recommendationsLoading && recommendations && recommendations.courses.length === 0 && (
                    <div className="placement-recommendations-empty">
                      <strong>Tu nivel necesita una orientación más personalizada.</strong>
                      <p>Ahora mismo no hay un programa público marcado específicamente para {result.estimatedLevel}. Podemos revisar contigo el objetivo, edad, speaking y disponibilidad.</p>
                    </div>
                  )}
                </section>

                <div className="placement-conversion-actions">
                  <button className="button button-primary" type="button" onClick={() => { setContactOpen((value) => !value); setContactError(''); setContactNotice('') }}>
                    {contactOpen ? 'Cerrar solicitud' : 'Quiero que me orientéis'}
                  </button>
                  <button className="button button-outline" type="button" onClick={restart}>Repetir el test</button>
                </div>

                <p className="placement-contact-privacy">Tus datos siguen siendo opcionales: solo los pedimos si decides solicitar orientación. El nivel y la puntuación se adjuntan desde el servidor, no desde el navegador.</p>
                {contactNotice && <div className="placement-contact-success" role="status">{contactNotice}</div>}

                {contactOpen && (
                  <form className="placement-contact-form" aria-labelledby="placement-contact-title" onSubmit={submitContact}>
                    <div className="placement-contact-heading">
                      <span className="eyebrow">ORIENTACIÓN PERSONAL</span>
                      <h2 id="placement-contact-title">Cuéntanos qué quieres conseguir.</h2>
                      <p>La academia recibirá tu resultado {result.estimatedLevel} junto a este mensaje para poder orientarte mejor.</p>
                    </div>
                    <div className="placement-contact-fields">
                      <label><span>Nombre</span><input value={contactName} onChange={(event) => setContactName(event.target.value)} required /></label>
                      <label><span>Email</span><input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} required /></label>
                      <label><span>Teléfono <small>opcional</small></span><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} /></label>
                      <label className="placement-contact-message"><span>¿Qué necesitas?</span><textarea rows={4} value={contactMessage} onChange={(event) => setContactMessage(event.target.value)} placeholder="Quiero mejorar conversación, preparar un examen, conocer horarios…" required /></label>
                    </div>
                    {contactError && <p className="placement-test-error" role="alert">{contactError}</p>}
                    <div className="placement-contact-submit">
                      <p>Al enviar, usaremos estos datos únicamente para atender tu consulta y orientarte sobre los servicios solicitados.</p>
                      <button className="button button-primary" type="submit" disabled={contactSending}>{contactSending ? 'Enviando…' : 'Enviar solicitud con mi resultado'}</button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </SiteShell>
  )
}

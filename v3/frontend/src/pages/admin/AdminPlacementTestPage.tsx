import { type FormEvent, useEffect, useMemo, useState } from 'react'
import AdminPlacementListeningPanel from '../../components/AdminPlacementListeningPanel'
import AdminPlacementListeningSetup from '../../components/AdminPlacementListeningSetup'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createPlacementAdminDraft,
  createPlacementAdminQuestion,
  deletePlacementAdminDraft,
  deletePlacementAdminQuestion,
  listPlacementAdminQuestions,
  listPlacementAdminTests,
  publishPlacementAdminTest,
  updatePlacementAdminDraft,
  updatePlacementAdminQuestion,
  type PlacementAdminQuestion,
  type PlacementAdminTest,
} from '../../services/pocketbase/placementAdmin'
import type { CefrLevel, PlacementSkill } from '../../services/pocketbase/placementTest'
import { adminNav } from './adminNav'

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const CORE_SKILLS: Array<{ value: Exclude<PlacementSkill, 'LISTENING'>; label: string }> = [
  { value: 'GRAMMAR', label: 'Gramática' },
  { value: 'VOCABULARY', label: 'Vocabulario' },
  { value: 'READING', label: 'Comprensión lectora' },
]

const demoTest: PlacementAdminTest = {
  id: 'demo-test', name: 'Test de nivel Language School', version: 'demo-v1', status: 'PUBLISHED', algorithmVersion: 'cefr-v1',
  publicQuestionCount: 15, campusQuestionCount: 30, campusRetakeDays: 30, publishedAt: '2026-08-18T10:00:00Z',
  createdAt: '2026-08-18T10:00:00Z', canEdit: false,
  validation: { ready: true, errors: [], requirements: [], questionCount: 30, activeQuestionCount: 30 },
}

function messageFrom(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message || '')
    if (message) return message
  }
  return 'No se ha podido completar la operación.'
}

function dateLabel(value: string): string {
  if (!value) return 'Sin publicar'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function skillLabel(value: PlacementSkill): string {
  if (value === 'LISTENING') return 'Comprensión oral'
  return CORE_SKILLS.find((item) => item.value === value)?.label || value
}

function emptyOptions() { return { a: '', b: '', c: '', d: '' } }

export default function AdminPlacementTestPage() {
  const { isDemoMode } = useAuth()
  const [tests, setTests] = useState<PlacementAdminTest[]>(isDemoMode ? [demoTest] : [])
  const [selectedId, setSelectedId] = useState(isDemoMode ? demoTest.id : '')
  const [questions, setQuestions] = useState<PlacementAdminQuestion[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const [newName, setNewName] = useState('Test de nivel Language School')
  const [newVersion, setNewVersion] = useState('')
  const [cloneSourceId, setCloneSourceId] = useState('')
  const [editName, setEditName] = useState('')
  const [editVersion, setEditVersion] = useState('')
  const [retakeDays, setRetakeDays] = useState(30)

  const [editingQuestionId, setEditingQuestionId] = useState('')
  const [qCode, setQCode] = useState('')
  const [qSkill, setQSkill] = useState<Exclude<PlacementSkill, 'LISTENING'>>('GRAMMAR')
  const [qLevel, setQLevel] = useState<CefrLevel>('A1')
  const [qPrompt, setQPrompt] = useState('')
  const [qPassage, setQPassage] = useState('')
  const [qOptions, setQOptions] = useState(emptyOptions)
  const [qCorrect, setQCorrect] = useState('a')
  const [qExplanation, setQExplanation] = useState('')
  const [qWeight, setQWeight] = useState(1)
  const [qOrder, setQOrder] = useState(0)
  const [qActive, setQActive] = useState(true)

  const selected = useMemo(() => tests.find((test) => test.id === selectedId) || null, [tests, selectedId])
  const genericSources = useMemo(() => tests.filter((test) => test.algorithmVersion === 'cefr-v1'), [tests])
  const selectedIsListening = selected?.algorithmVersion === 'cefr-v2-listening'

  async function refreshTests(preferredId?: string) {
    if (isDemoMode) return
    const records = await listPlacementAdminTests()
    setTests(records)
    const target = preferredId && records.some((record) => record.id === preferredId)
      ? preferredId
      : selectedId && records.some((record) => record.id === selectedId) ? selectedId : records[0]?.id || ''
    setSelectedId(target)
    const genericPublished = records.find((record) => record.status === 'PUBLISHED' && record.algorithmVersion === 'cefr-v1')
    if (!cloneSourceId || !records.some((record) => record.id === cloneSourceId && record.algorithmVersion === 'cefr-v1')) {
      setCloneSourceId(genericPublished?.id || records.find((record) => record.algorithmVersion === 'cefr-v1')?.id || '')
    }
  }

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    listPlacementAdminTests()
      .then((records) => {
        if (!mounted) return
        setTests(records)
        if (records[0]) setSelectedId(records[0].id)
        const published = records.find((record) => record.status === 'PUBLISHED' && record.algorithmVersion === 'cefr-v1')
        if (published) setCloneSourceId(published.id)
        else setCloneSourceId(records.find((record) => record.algorithmVersion === 'cefr-v1')?.id || '')
      })
      .catch((cause) => { if (mounted) setError(messageFrom(cause)) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  useEffect(() => {
    if (!selected) return
    setEditName(selected.name)
    setEditVersion(selected.version)
    setRetakeDays(selected.campusRetakeDays)
    setEditingQuestionId('')
  }, [selected])

  useEffect(() => {
    if (!selectedId || isDemoMode) { setQuestions([]); return }
    let mounted = true
    setQuestionsLoading(true)
    listPlacementAdminQuestions(selectedId)
      .then((result) => {
        if (!mounted) return
        setQuestions(result.questions)
        setTests((current) => current.map((record) => record.id === result.test.id ? result.test : record))
      })
      .catch((cause) => { if (mounted) setError(messageFrom(cause)) })
      .finally(() => { if (mounted) setQuestionsLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, selectedId])

  function clearQuestionForm() {
    setEditingQuestionId(''); setQCode(''); setQSkill('GRAMMAR'); setQLevel('A1'); setQPrompt(''); setQPassage('')
    setQOptions(emptyOptions()); setQCorrect('a'); setQExplanation(''); setQWeight(1); setQOrder(questions.length + 1); setQActive(true)
  }

  function editQuestion(question: PlacementAdminQuestion) {
    if (question.skill === 'LISTENING') return
    const options = emptyOptions()
    question.options.forEach((option) => { if (option.id in options) options[option.id as keyof typeof options] = option.label })
    setEditingQuestionId(question.id); setQCode(question.code); setQSkill(question.skill); setQLevel(question.cefrLevel)
    setQPrompt(question.prompt); setQPassage(question.passage); setQOptions(options); setQCorrect(question.correctOptionId)
    setQExplanation(question.internalExplanation); setQWeight(question.weight); setQOrder(question.adminOrder); setQActive(question.active)
    document.getElementById('placement-question-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function handleCreateVersion(event: FormEvent) {
    event.preventDefault()
    if (isDemoMode) return
    setBusy(true); setError(''); setMessage('')
    try {
      const created = await createPlacementAdminDraft({ name: newName, version: newVersion, sourceTestId: cloneSourceId || undefined })
      setNewVersion('')
      setMessage(cloneSourceId ? 'Nueva versión DRAFT creada con una copia del banco seleccionado.' : 'Nueva versión DRAFT creada.')
      await refreshTests(created.id)
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  async function handleSaveTest(event: FormEvent) {
    event.preventDefault()
    if (!selected?.canEdit || isDemoMode) return
    setBusy(true); setError(''); setMessage('')
    try {
      const updated = await updatePlacementAdminDraft(selected.id, { name: editName, version: editVersion, campusRetakeDays: retakeDays })
      setTests((current) => current.map((record) => record.id === updated.id ? updated : record))
      setMessage('Datos de la versión guardados.')
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  async function handleDeleteVersion() {
    if (!selected?.canEdit || isDemoMode || !window.confirm(`Eliminar la versión DRAFT ${selected.version}?`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      await deletePlacementAdminDraft(selected.id)
      setMessage('Versión DRAFT eliminada.'); setSelectedId(''); await refreshTests()
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  async function handlePublish() {
    if (!selected?.canEdit || selected.algorithmVersion !== 'cefr-v1' || !selected.validation.ready || isDemoMode) return
    if (!window.confirm(`Publicar ${selected.version}? La versión publicada anterior quedará archivada y esta versión pasará a ser inmutable.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      const published = await publishPlacementAdminTest(selected.id)
      setMessage(`Versión ${published.version} publicada. El contenido ha quedado congelado.`)
      await refreshTests(published.id)
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  async function handleSaveQuestion(event: FormEvent) {
    event.preventDefault()
    if (!selected?.canEdit || isDemoMode) return
    const options = Object.entries(qOptions).filter(([, label]) => label.trim()).map(([id, label]) => ({ id, label: label.trim() }))
    setBusy(true); setError(''); setMessage('')
    try {
      const payload = { code: qCode, skill: qSkill, cefrLevel: qLevel, prompt: qPrompt, passage: qPassage, options, correctOptionId: qCorrect, internalExplanation: qExplanation, weight: qWeight, active: qActive, adminOrder: qOrder }
      if (editingQuestionId) { await updatePlacementAdminQuestion(editingQuestionId, payload); setMessage('Pregunta actualizada.') }
      else { await createPlacementAdminQuestion(selected.id, payload); setMessage('Pregunta añadida al banco.') }
      clearQuestionForm()
      const result = await listPlacementAdminQuestions(selected.id)
      setQuestions(result.questions)
      setTests((current) => current.map((record) => record.id === result.test.id ? result.test : record))
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  async function handleDeleteQuestion(question: PlacementAdminQuestion) {
    if (question.skill === 'LISTENING') return
    if (!selected?.canEdit || isDemoMode || !window.confirm(`Eliminar ${question.code}?`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      await deletePlacementAdminQuestion(question.id)
      const result = await listPlacementAdminQuestions(selected.id)
      setQuestions(result.questions)
      setTests((current) => current.map((record) => record.id === result.test.id ? result.test : record))
      setMessage('Pregunta eliminada.')
      if (editingQuestionId === question.id) clearQuestionForm()
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page placement-admin-page">
        <header className="cms-page-heading"><div><span className="eyebrow">EVALUACIÓN · MCER</span><h2>Test de nivel</h2><p>Gestiona versiones, banco de preguntas y comprensión oral. Solo los borradores se pueden editar; una versión publicada queda congelada para conservar la trazabilidad de los resultados.</p></div></header>
        {loading && <div className="cms-notice" role="status">Cargando versiones…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="panel placement-admin-new-version">
          <div className="panel-heading"><div><span className="eyebrow">NUEVA REVISIÓN · MOTOR BASE</span><h3>Crear versión DRAFT cefr-v1</h3></div></div>
          <form onSubmit={(event) => void handleCreateVersion(event)}>
            <label>Nombre<input value={newName} onChange={(event) => setNewName(event.target.value)} required disabled={isDemoMode || busy} /></label>
            <label>Versión<input value={newVersion} onChange={(event) => setNewVersion(event.target.value)} placeholder="2026.09-v2" required disabled={isDemoMode || busy} /></label>
            <label>Partir de<select value={cloneSourceId} onChange={(event) => setCloneSourceId(event.target.value)} disabled={isDemoMode || busy}><option value="">Banco vacío</option>{genericSources.map((test) => <option key={test.id} value={test.id}>{test.version} · {test.status}</option>)}</select></label>
            <button className="button button-primary" type="submit" disabled={isDemoMode || busy}>Crear versión base</button>
          </form>
          <small className="muted">Este flujo mantiene el motor cefr-v1. Para comprensión oral usa el bloque Listening siguiente.</small>
        </section>

        <AdminPlacementListeningSetup tests={tests} disabled={isDemoMode} onCreated={async (testId) => { setMessage('Versión Listening creada. Añade los audios para poder publicarla.'); await refreshTests(testId) }} />

        <div className="placement-admin-layout">
          <aside className="panel placement-admin-versions">
            <div className="panel-heading"><div><span className="eyebrow">VERSIONES</span><h3>Histórico</h3></div><span className="status info">{tests.length}</span></div>
            <div className="placement-version-list">{tests.map((test) => <button key={test.id} type="button" className={selectedId === test.id ? 'active' : ''} onClick={() => setSelectedId(test.id)}><span><strong>{test.version}</strong><small>{test.name}{test.algorithmVersion === 'cefr-v2-listening' ? ' · Listening' : ''}</small></span><b className={`placement-status ${test.status.toLowerCase()}`}>{test.status}</b></button>)}</div>
          </aside>

          <main className="placement-admin-main">
            {!selected && !loading && <PortalEmptyState title="Sin versiones" description="Crea la primera versión DRAFT para empezar el banco de preguntas." />}
            {selected && <>
              <section className="panel placement-version-summary">
                <div className="panel-heading"><div><span className="eyebrow">VERSIÓN {selected.version}</span><h3>{selected.name}</h3><small>{selected.algorithmVersion === 'cefr-v2-listening' ? 'cefr-v2-listening · Listening diagnóstico' : 'cefr-v1 · Grammar + Vocabulary + Reading'}</small></div><span className={`placement-status ${selected.status.toLowerCase()}`}>{selected.status}</span></div>
                <div className="placement-summary-grid">
                  <div><small>Público</small><strong>{selected.publicQuestionCount}</strong><span>preguntas</span></div>
                  <div><small>Campus</small><strong>{selected.campusQuestionCount}</strong><span>preguntas</span></div>
                  <div><small>Banco activo</small><strong>{selected.validation.activeQuestionCount}</strong><span>de {selected.validation.questionCount}</span></div>
                  <div><small>Publicación</small><strong>{selectedIsListening ? 'Ver Listening' : selected.validation.ready ? 'Listo' : 'Incompleto'}</strong><span>{dateLabel(selected.publishedAt)}</span></div>
                </div>
                {selected.canEdit ? <form className="placement-version-edit" onSubmit={(event) => void handleSaveTest(event)}>
                  <label>Nombre<input value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
                  <label>Versión<input value={editVersion} onChange={(event) => setEditVersion(event.target.value)} /></label>
                  <label>Repetición Campus (días)<input type="number" min={0} max={3650} value={retakeDays} onChange={(event) => setRetakeDays(Number(event.target.value))} /></label>
                  <div className="placement-version-actions"><button className="button button-secondary" type="submit" disabled={busy}>Guardar datos</button><button className="button button-danger" type="button" onClick={() => void handleDeleteVersion()} disabled={busy}>Eliminar DRAFT</button></div>
                </form> : <div className="placement-immutable-note"><strong>Versión inmutable.</strong><span>Para cambiar cualquier contenido crea una nueva revisión DRAFT.</span></div>}

                {!selectedIsListening && <div className={`placement-validation ${selected.validation.ready ? 'ready' : 'pending'}`}>
                  <div><strong>{selected.validation.ready ? 'Banco preparado para publicar' : 'Faltan requisitos para publicar'}</strong><span>El servidor valida el blueprint antes de permitir la publicación.</span></div>
                  {!selected.validation.ready && <ul>{selected.validation.errors.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>}
                  {selected.canEdit && <button className="button button-primary" type="button" onClick={() => void handlePublish()} disabled={busy || !selected.validation.ready}>Publicar versión</button>}
                </div>}
                {selectedIsListening && <div className="placement-immutable-note"><strong>Publicación protegida por Listening.</strong><span>La disponibilidad real se calcula en el panel de comprensión oral y exige audio en las 24 preguntas del banco.</span></div>}
              </section>

              {selectedIsListening && <AdminPlacementListeningPanel testId={selected.id} canEdit={selected.canEdit && !isDemoMode} version={selected.version} onPublished={async () => { await refreshTests(selected.id) }} />}

              <section className="panel placement-question-bank">
                <div className="panel-heading"><div><span className="eyebrow">BANCO DE PREGUNTAS</span><h3>{questions.length} preguntas</h3></div></div>
                {questionsLoading && <div className="cms-notice" role="status">Cargando preguntas…</div>}
                <div className="placement-question-list">{questions.map((question) => <article key={question.id} className={!question.active ? 'inactive' : ''}>
                  <div className="placement-question-meta"><span>{skillLabel(question.skill)}</span><b>{question.cefrLevel}</b><small>#{question.adminOrder}</small></div>
                  <div><strong>{question.code}</strong><p>{question.prompt}</p><small>{question.options.length} opciones · correcta: {question.correctOptionId.toUpperCase()}{question.skill === 'LISTENING' ? ' · gestión en panel Listening' : ''}</small></div>
                  {selected.canEdit && question.skill !== 'LISTENING' && <div className="placement-question-actions"><button type="button" onClick={() => editQuestion(question)}>Editar</button><button type="button" onClick={() => void handleDeleteQuestion(question)}>Eliminar</button></div>}
                </article>)}{!questionsLoading && questions.length === 0 && <PortalEmptyState compact title="Banco vacío" description={selected.canEdit ? 'Añade preguntas para cubrir el blueprint público y Campus.' : 'Esta versión no contiene preguntas.'} />}</div>
              </section>

              {selected.canEdit && <section className="panel placement-question-editor" id="placement-question-editor">
                <div className="panel-heading"><div><span className="eyebrow">{editingQuestionId ? 'EDITAR PREGUNTA BASE' : 'NUEVA PREGUNTA BASE'}</span><h3>{editingQuestionId ? qCode : 'Añadir Grammar, Vocabulary o Reading'}</h3></div>{editingQuestionId && <button type="button" className="button button-secondary" onClick={clearQuestionForm}>Cancelar edición</button>}</div>
                <form onSubmit={(event) => void handleSaveQuestion(event)}>
                  <div className="placement-question-fields">
                    <label>Código<input value={qCode} onChange={(event) => setQCode(event.target.value)} placeholder="grammar-b1-01" required /></label>
                    <label>Competencia<select value={qSkill} onChange={(event) => setQSkill(event.target.value as Exclude<PlacementSkill, 'LISTENING'>)}>{CORE_SKILLS.map((skill) => <option key={skill.value} value={skill.value}>{skill.label}</option>)}</select></label>
                    <label>Nivel MCER<select value={qLevel} onChange={(event) => setQLevel(event.target.value as CefrLevel)}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
                    <label>Orden<input type="number" min={0} value={qOrder} onChange={(event) => setQOrder(Number(event.target.value))} /></label>
                    <label>Peso<input type="number" min={0.1} max={100} step={0.1} value={qWeight} onChange={(event) => setQWeight(Number(event.target.value))} /></label>
                    <label className="placement-active-check"><input type="checkbox" checked={qActive} onChange={(event) => setQActive(event.target.checked)} />Activa</label>
                  </div>
                  <label>Enunciado<textarea value={qPrompt} onChange={(event) => setQPrompt(event.target.value)} rows={3} required /></label>
                  <label>Texto de lectura <small>(opcional)</small><textarea value={qPassage} onChange={(event) => setQPassage(event.target.value)} rows={4} /></label>
                  <fieldset className="placement-options-editor"><legend>Opciones de respuesta</legend>{(['a', 'b', 'c', 'd'] as const).map((id) => <label key={id}><span>{id.toUpperCase()}</span><input value={qOptions[id]} onChange={(event) => setQOptions((current) => ({ ...current, [id]: event.target.value }))} placeholder={`Opción ${id.toUpperCase()}`} /></label>)}<label>Respuesta correcta<select value={qCorrect} onChange={(event) => setQCorrect(event.target.value)}>{(['a', 'b', 'c', 'd'] as const).map((id) => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label></fieldset>
                  <label>Explicación interna <small>(solo Administración)</small><textarea value={qExplanation} onChange={(event) => setQExplanation(event.target.value)} rows={3} /></label>
                  <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : editingQuestionId ? 'Guardar cambios' : 'Añadir pregunta'}</button>
                </form>
              </section>}
            </>}
          </main>
        </div>
      </div>
    </DashboardShell>
  )
}
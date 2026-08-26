import { type FormEvent, useEffect, useMemo, useState } from 'react'
import AdminPlacementListeningPanel from '../../components/AdminPlacementListeningPanel'
import AdminPlacementListeningSetup from '../../components/AdminPlacementListeningSetup'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import '../../styles/placement-admin-phase16f.css'
import {
  PROGRESSIVE_ALGORITHM_VERSION,
  createPlacementAdminQuestion,
  createPlacementProgressiveDraft,
  deletePlacementAdminDraft,
  deletePlacementAdminQuestion,
  getPlacementProgressiveStatus,
  listPlacementAdminQuestions,
  listPlacementAdminTests,
  publishPlacementAdminTest,
  publishPlacementProgressiveTest,
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
const LISTENING_ALGORITHM = 'cefr-v2-listening'
const LEGACY_ALGORITHM = 'cefr-v1'

const demoTest: PlacementAdminTest = {
  id: 'demo-test', name: 'Test de nivel Language School', version: 'demo-progressive', status: 'PUBLISHED', algorithmVersion: PROGRESSIVE_ALGORITHM_VERSION,
  publicQuestionCount: 12, campusQuestionCount: 30, campusRetakeDays: 30, publishedAt: '2026-08-19T10:00:00Z',
  createdAt: '2026-08-19T10:00:00Z', canEdit: false,
  validation: {
    ready: true, errors: [], questionCount: 72, activeQuestionCount: 72,
    requirements: CORE_SKILLS.flatMap((skill) => LEVELS.map((level) => ({ skill: skill.value, level, required: 2, available: 4, ready: true }))),
  },
}

type BankSkillFilter = 'ALL' | PlacementSkill
type BankLevelFilter = 'ALL' | CefrLevel
type BankStateFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'

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

function algorithmLabel(value: string): string {
  if (value === PROGRESSIVE_ALGORITHM_VERSION) return 'Motor progresivo'
  if (value === LISTENING_ALGORITHM) return 'Listening diagnóstico'
  if (value === LEGACY_ALGORITHM) return 'Histórico cefr-v1'
  return value
}

function algorithmDescription(test: PlacementAdminTest): string {
  if (test.algorithmVersion === PROGRESSIVE_ALGORITHM_VERSION) return `${PROGRESSIVE_ALGORITHM_VERSION} · 12 públicas progresivas · Campus completo`
  if (test.algorithmVersion === LISTENING_ALGORITHM) return `${LISTENING_ALGORITHM} · Listening diagnóstico`
  if (test.algorithmVersion === LEGACY_ALGORITHM) return `${LEGACY_ALGORITHM} · versión histórica Grammar + Vocabulary + Reading`
  return test.algorithmVersion
}

function isProgressive(test: PlacementAdminTest | null): boolean {
  return test?.algorithmVersion === PROGRESSIVE_ALGORITHM_VERSION
}

function isListening(test: PlacementAdminTest | null): boolean {
  return test?.algorithmVersion === LISTENING_ALGORITHM
}

function isProgressiveSource(test: PlacementAdminTest): boolean {
  return [LEGACY_ALGORITHM, LISTENING_ALGORITHM, PROGRESSIVE_ALGORITHM_VERSION].includes(test.algorithmVersion)
}

function emptyOptions() { return { a: '', b: '', c: '', d: '' } }

async function hydrateProgressiveTests(records: PlacementAdminTest[]): Promise<PlacementAdminTest[]> {
  return Promise.all(records.map(async (record) => {
    if (record.algorithmVersion !== PROGRESSIVE_ALGORITHM_VERSION) return record
    try {
      const status = await getPlacementProgressiveStatus(record.id)
      return { ...record, validation: status.validation }
    } catch {
      return record
    }
  }))
}

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

  const [bankQuery, setBankQuery] = useState('')
  const [bankSkill, setBankSkill] = useState<BankSkillFilter>('ALL')
  const [bankLevel, setBankLevel] = useState<BankLevelFilter>('ALL')
  const [bankState, setBankState] = useState<BankStateFilter>('ALL')

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
  const progressiveSources = useMemo(() => tests.filter(isProgressiveSource), [tests])
  const selectedIsListening = isListening(selected)
  const selectedIsProgressive = isProgressive(selected)

  const filteredQuestions = useMemo(() => {
    const normalized = bankQuery.trim().toLowerCase()
    return questions.filter((question) => {
      if (bankSkill !== 'ALL' && question.skill !== bankSkill) return false
      if (bankLevel !== 'ALL' && question.cefrLevel !== bankLevel) return false
      if (bankState === 'ACTIVE' && !question.active) return false
      if (bankState === 'INACTIVE' && question.active) return false
      if (!normalized) return true
      return `${question.code} ${question.prompt} ${question.passage} ${skillLabel(question.skill)} ${question.cefrLevel}`.toLowerCase().includes(normalized)
    })
  }, [bankLevel, bankQuery, bankSkill, bankState, questions])

  function preferredSource(records: PlacementAdminTest[]): string {
    const ranked = records.filter(isProgressiveSource).slice().sort((left, right) => {
      const coverageDifference = Number(right.validation.questionCount || 0) - Number(left.validation.questionCount || 0)
      if (coverageDifference !== 0) return coverageDifference
      if (left.status === 'PUBLISHED' && right.status !== 'PUBLISHED') return -1
      if (right.status === 'PUBLISHED' && left.status !== 'PUBLISHED') return 1
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
    })
    return ranked[0]?.id || ''
  }

  async function refreshTests(preferredId?: string) {
    if (isDemoMode) return
    const records = await hydrateProgressiveTests(await listPlacementAdminTests())
    setTests(records)
    const target = preferredId && records.some((record) => record.id === preferredId)
      ? preferredId
      : selectedId && records.some((record) => record.id === selectedId) ? selectedId : records[0]?.id || ''
    setSelectedId(target)
    if (!cloneSourceId || !records.some((record) => record.id === cloneSourceId && isProgressiveSource(record))) {
      setCloneSourceId(preferredSource(records))
    }
  }

  async function refreshQuestions(testId: string) {
    const result = await listPlacementAdminQuestions(testId)
    setQuestions(result.questions)
    let nextTest = result.test
    if (result.test.algorithmVersion === PROGRESSIVE_ALGORITHM_VERSION) {
      try {
        const status = await getPlacementProgressiveStatus(testId)
        nextTest = { ...result.test, validation: status.validation }
      } catch {
        // Keep the generic metadata visible if the dedicated status endpoint is temporarily unavailable.
      }
    }
    setTests((current) => current.map((record) => record.id === nextTest.id ? nextTest : record))
  }

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    listPlacementAdminTests()
      .then(hydrateProgressiveTests)
      .then((records) => {
        if (!mounted) return
        setTests(records)
        if (records[0]) setSelectedId(records[0].id)
        setCloneSourceId(preferredSource(records))
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
    setBankQuery('')
    setBankSkill('ALL')
    setBankLevel('ALL')
    setBankState('ALL')
  }, [selected?.id])

  useEffect(() => {
    if (!selectedId || isDemoMode) { setQuestions([]); return }
    let mounted = true
    setQuestionsLoading(true)
    listPlacementAdminQuestions(selectedId)
      .then(async (result) => {
        if (!mounted) return
        setQuestions(result.questions)
        let nextTest = result.test
        if (result.test.algorithmVersion === PROGRESSIVE_ALGORITHM_VERSION) {
          try {
            const status = await getPlacementProgressiveStatus(selectedId)
            nextTest = { ...result.test, validation: status.validation }
          } catch {
            // Preserve the list response as a safe fallback.
          }
        }
        if (mounted) setTests((current) => current.map((record) => record.id === nextTest.id ? nextTest : record))
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
    if (isDemoMode || !cloneSourceId) return
    setBusy(true); setError(''); setMessage('')
    try {
      const created = await createPlacementProgressiveDraft({ name: newName, version: newVersion, sourceTestId: cloneSourceId })
      setNewVersion('')
      setMessage('Nueva versión DRAFT creada con motor progresivo y copia del banco seleccionado.')
      await refreshTests(created.testId)
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  async function handleSaveTest(event: FormEvent) {
    event.preventDefault()
    if (!selected?.canEdit || isDemoMode) return
    setBusy(true); setError(''); setMessage('')
    try {
      const updated = await updatePlacementAdminDraft(selected.id, { name: editName, version: editVersion, campusRetakeDays: retakeDays })
      let next = updated
      if (updated.algorithmVersion === PROGRESSIVE_ALGORITHM_VERSION) {
        const status = await getPlacementProgressiveStatus(updated.id)
        next = { ...updated, validation: status.validation }
      }
      setTests((current) => current.map((record) => record.id === next.id ? next : record))
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
    if (!selected?.canEdit || selectedIsListening || !selected.validation.ready || isDemoMode) return
    if (!window.confirm(`Publicar ${selected.version}? La versión publicada anterior quedará archivada y esta versión pasará a ser inmutable.`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (selectedIsProgressive) await publishPlacementProgressiveTest(selected.id)
      else await publishPlacementAdminTest(selected.id)
      setMessage(`Versión ${selected.version} publicada. El contenido ha quedado congelado.`)
      await refreshTests(selected.id)
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
      await refreshQuestions(selected.id)
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  async function handleDeleteQuestion(question: PlacementAdminQuestion) {
    if (question.skill === 'LISTENING') return
    if (!selected?.canEdit || isDemoMode || !window.confirm(`Eliminar ${question.code}?`)) return
    setBusy(true); setError(''); setMessage('')
    try {
      await deletePlacementAdminQuestion(question.id)
      await refreshQuestions(selected.id)
      setMessage('Pregunta eliminada.')
      if (editingQuestionId === question.id) clearQuestionForm()
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  function resetFilters() {
    setBankQuery(''); setBankSkill('ALL'); setBankLevel('ALL'); setBankState('ALL')
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page placement-admin-page placement-admin-phase16f">
        <header className="cms-page-heading"><div><span className="eyebrow">EVALUACIÓN · MCER</span><h2>Test de nivel</h2><p>Gestiona el motor progresivo, el banco de preguntas y el histórico de versiones. Una versión publicada queda congelada para conservar la trazabilidad; cualquier mejora se prepara en una nueva revisión DRAFT.</p></div></header>
        {loading && <div className="cms-notice" role="status">Cargando versiones…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="panel placement-admin-new-version placement-progressive-create">
          <div className="panel-heading"><div><span className="eyebrow">NUEVA REVISIÓN · MOTOR PROGRESIVO</span><h3>Crear versión DRAFT progresiva</h3></div><span className="placement-algorithm-tag recommended">Recomendado</span></div>
          <form onSubmit={(event) => void handleCreateVersion(event)}>
            <label>Nombre<input value={newName} onChange={(event) => setNewName(event.target.value)} required disabled={isDemoMode || busy} /></label>
            <label>Versión<input value={newVersion} onChange={(event) => setNewVersion(event.target.value)} placeholder="2026.09-v3" required disabled={isDemoMode || busy} /></label>
            <label>Partir de<select value={cloneSourceId} onChange={(event) => setCloneSourceId(event.target.value)} required disabled={isDemoMode || busy}><option value="">Selecciona un banco de origen</option>{progressiveSources.map((test) => <option key={test.id} value={test.id}>{test.version} · {test.status} · {algorithmLabel(test.algorithmVersion)}</option>)}</select></label>
            <button className="button button-primary" type="submit" disabled={isDemoMode || busy || !cloneSourceId}>Crear versión</button>
          </form>
          <div className="placement-progressive-contract"><strong>Contrato actual</strong><span>12 preguntas públicas progresivas · A1–C2 · 3 competencias equilibradas · Campus conserva 30 preguntas.</span></div>
        </section>

        <AdminPlacementListeningSetup tests={tests} disabled={isDemoMode} onCreated={async (testId) => { setMessage('Versión Listening creada. Añade los audios para poder publicarla.'); await refreshTests(testId) }} />

        <div className="placement-admin-layout">
          <aside className="panel placement-admin-versions">
            <div className="panel-heading"><div><span className="eyebrow">VERSIONES</span><h3>Histórico</h3></div><span className="status info">{tests.length}</span></div>
            <div className="placement-version-list">{tests.map((test) => <button key={test.id} type="button" className={selectedId === test.id ? 'active' : ''} onClick={() => setSelectedId(test.id)}><span><strong>{test.version}</strong><small>{test.name}</small><em>{algorithmLabel(test.algorithmVersion)}</em></span><b className={`placement-status ${test.status.toLowerCase()}`}>{test.status}</b></button>)}</div>
          </aside>

          <main className="placement-admin-main">
            {!selected && !loading && <PortalEmptyState title="Sin versiones" description="Crea una revisión DRAFT progresiva a partir de un banco compatible." />}
            {selected && <>
              <section className="panel placement-version-summary">
                <div className="panel-heading"><div><span className="eyebrow">VERSIÓN {selected.version}</span><h3>{selected.name}</h3><small>{algorithmDescription(selected)}</small></div><div className="placement-version-badges"><span className={`placement-algorithm-tag${selectedIsProgressive ? ' recommended' : ''}`}>{algorithmLabel(selected.algorithmVersion)}</span><span className={`placement-status ${selected.status.toLowerCase()}`}>{selected.status}</span></div></div>
                <div className="placement-summary-grid">
                  <div><small>Público</small><strong>{selected.publicQuestionCount}</strong><span>{selectedIsProgressive ? 'ruta progresiva' : 'preguntas'}</span></div>
                  <div><small>Campus</small><strong>{selected.campusQuestionCount}</strong><span>preguntas</span></div>
                  <div><small>Banco activo</small><strong>{selected.validation.activeQuestionCount}</strong><span>de {selected.validation.questionCount}</span></div>
                  <div><small>Publicación</small><strong>{selectedIsListening ? 'Ver Listening' : selected.validation.ready ? 'Listo' : 'Incompleto'}</strong><span>{dateLabel(selected.publishedAt)}</span></div>
                </div>
                {selected.canEdit ? <form className="placement-version-edit" onSubmit={(event) => void handleSaveTest(event)}>
                  <label>Nombre<input value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
                  <label>Versión<input value={editVersion} onChange={(event) => setEditVersion(event.target.value)} /></label>
                  <label>Repetición Campus (días)<input type="number" min={0} max={3650} value={retakeDays} onChange={(event) => setRetakeDays(Number(event.target.value))} /></label>
                  <div className="placement-version-actions"><button className="button button-secondary" type="submit" disabled={busy}>Guardar datos</button><button className="button button-danger" type="button" onClick={() => void handleDeleteVersion()} disabled={busy}>Eliminar DRAFT</button></div>
                </form> : <div className="placement-immutable-note"><strong>Versión inmutable.</strong><span>Para cambiar cualquier contenido crea una nueva revisión DRAFT. No se modifica ni se despublica un histórico con resultados asociados.</span></div>}

                {!selectedIsListening && <div className={`placement-validation ${selected.validation.ready ? 'ready' : 'pending'}`}>
                  <div><strong>{selected.validation.ready ? 'Banco preparado para publicar' : 'Faltan requisitos para publicar'}</strong><span>{selectedIsProgressive ? 'El servidor valida la cobertura conjunta del recorrido progresivo y del Campus completo.' : 'El servidor valida el blueprint histórico antes de permitir la publicación.'}</span></div>
                  {!selected.validation.ready && <ul>{selected.validation.errors.slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>}
                  {selected.canEdit && <button className="button button-primary" type="button" onClick={() => void handlePublish()} disabled={busy || !selected.validation.ready}>Publicar versión</button>}
                </div>}
                {selectedIsListening && <div className="placement-immutable-note"><strong>Publicación protegida por Listening.</strong><span>La disponibilidad real se calcula en el panel de comprensión oral y exige audio en las 24 preguntas del banco.</span></div>}
              </section>

              {selectedIsListening && <AdminPlacementListeningPanel testId={selected.id} canEdit={selected.canEdit && !isDemoMode} version={selected.version} onPublished={async () => { await refreshTests(selected.id) }} />}

              {!selectedIsListening && selected.validation.requirements.length > 0 && <section className="panel placement-coverage-panel" aria-labelledby="placement-coverage-title">
                <div className="panel-heading"><div><span className="eyebrow">COBERTURA MCER</span><h3 id="placement-coverage-title">Cobertura del banco</h3><p>Disponible frente al mínimo requerido por el motor activo. Verde significa que esa celda puede formar parte de un recorrido válido.</p></div></div>
                <div className="placement-coverage-grid">
                  {CORE_SKILLS.map((skill) => <section className="placement-coverage-skill" key={skill.value} aria-label={skill.label}>
                    <strong>{skill.label}</strong>
                    <div>{LEVELS.map((level) => {
                      const requirement = selected.validation.requirements.find((item) => item.skill === skill.value && item.level === level)
                      return <article className={`placement-coverage-cell ${requirement?.ready ? 'ready' : 'missing'}`} key={level} aria-label={`${skill.label} ${level}`}>
                        <span>{level}</span><b>{requirement ? `${requirement.available}/${requirement.required}` : '—'}</b><small>{requirement?.ready ? 'Cubierto' : requirement ? 'Falta' : 'No exigido'}</small>
                      </article>
                    })}</div>
                  </section>)}
                </div>
              </section>}

              <section className="panel placement-question-bank">
                <div className="panel-heading"><div><span className="eyebrow">BANCO DE PREGUNTAS</span><h3>{filteredQuestions.length} de {questions.length} preguntas</h3></div>{(bankQuery || bankSkill !== 'ALL' || bankLevel !== 'ALL' || bankState !== 'ALL') && <button className="button button-secondary" type="button" onClick={resetFilters}>Limpiar filtros</button>}</div>
                <div className="placement-bank-filters" aria-label="Filtros del banco de preguntas">
                  <label>Buscar pregunta<input value={bankQuery} onChange={(event) => setBankQuery(event.target.value)} placeholder="Código o enunciado…" /></label>
                  <label>Filtrar competencia<select value={bankSkill} onChange={(event) => setBankSkill(event.target.value as BankSkillFilter)}><option value="ALL">Todas</option>{CORE_SKILLS.map((skill) => <option key={skill.value} value={skill.value}>{skill.label}</option>)}{selectedIsListening && <option value="LISTENING">Comprensión oral</option>}</select></label>
                  <label>Filtrar nivel MCER<select value={bankLevel} onChange={(event) => setBankLevel(event.target.value as BankLevelFilter)}><option value="ALL">Todos</option>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                  <label>Filtrar estado<select value={bankState} onChange={(event) => setBankState(event.target.value as BankStateFilter)}><option value="ALL">Todas</option><option value="ACTIVE">Activas</option><option value="INACTIVE">Inactivas</option></select></label>
                </div>
                {questionsLoading && <div className="cms-notice" role="status">Cargando preguntas…</div>}
                <div className="placement-question-list">{filteredQuestions.map((question) => <article key={question.id} className={!question.active ? 'inactive' : ''}>
                  <div className="placement-question-meta"><span>{skillLabel(question.skill)}</span><b>{question.cefrLevel}</b><small>#{question.adminOrder}</small></div>
                  <div><strong>{question.code}</strong><p>{question.prompt}</p><small>{question.options.length} opciones · correcta: {question.correctOptionId.toUpperCase()}{question.skill === 'LISTENING' ? ' · gestión en panel Listening' : ''}{!question.active ? ' · inactiva' : ''}</small></div>
                  {selected.canEdit && question.skill !== 'LISTENING' && <div className="placement-question-actions"><button type="button" onClick={() => editQuestion(question)}>Editar</button><button type="button" onClick={() => void handleDeleteQuestion(question)}>Eliminar</button></div>}
                </article>)}{!questionsLoading && filteredQuestions.length === 0 && <PortalEmptyState compact title={questions.length ? 'Sin coincidencias' : 'Banco vacío'} description={questions.length ? 'Ajusta o limpia los filtros para volver a ver preguntas.' : selected.canEdit ? 'Añade preguntas para cubrir el motor público y Campus.' : 'Esta versión no contiene preguntas.'} />}</div>
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

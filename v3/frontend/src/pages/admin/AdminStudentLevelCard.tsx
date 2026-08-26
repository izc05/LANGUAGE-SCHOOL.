import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { CefrLevel } from '../../services/pocketbase/placementTest'
import {
  createAdminStudentLevelAssessment,
  getAdminStudentLevelSummary,
  type AdminStudentLevelSummary,
} from '../../services/pocketbase/adminStudentLevel'
import './admin-student-level-phase15be.css'

type Props = {
  studentId: string
  targetLevel?: string
  groupName?: string
  isDemoMode?: boolean
  onCurrentLevelChange?: (
    currentLevel: AdminStudentLevelSummary['currentLevel'],
    currentLevelSource: AdminStudentLevelSummary['currentLevelSource'],
  ) => void
}

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

const demoSummary: AdminStudentLevelSummary = {
  student: { id: 'demo-1', name: 'Emma', surname: 'Martín', email: 'emma@example.com', status: 'ACTIVE' },
  currentLevel: 'B1',
  currentLevelSource: 'VALIDATED',
  latestAttempt: { id: 'demo-attempt', estimatedLevel: 'B1', scorePercent: 76, skillScores: {}, completedAt: '2026-08-01 12:00:00.000Z', algorithmVersion: 'demo' },
  latestAssessment: {
    id: 'demo-assessment', automaticLevel: 'B1', speakingLevel: 'B1', validatedLevel: 'B1', reason: 'INITIAL', notes: 'Valoración inicial de academia.', assessedAt: '2026-08-02 12:00:00.000Z', assessedBy: 'demo-admin', assessedByName: 'Administración', sourceAttemptId: 'demo-attempt',
  },
  assessmentHistory: [],
}
demoSummary.assessmentHistory = demoSummary.latestAssessment ? [demoSummary.latestAssessment] : []

function reasonLabel(reason: string): string {
  if (reason === 'INITIAL') return 'Inicial'
  if (reason === 'PROGRESS') return 'Progreso'
  if (reason === 'REVIEW') return 'Revisión'
  return 'Otra valoración'
}

function sourceLabel(source: AdminStudentLevelSummary['currentLevelSource']): string {
  if (source === 'VALIDATED') return 'Validado por academia'
  if (source === 'AUTOMATIC') return 'Estimado por test'
  return 'Sin evaluar'
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed)
}

export default function AdminStudentLevelCard({
  studentId,
  targetLevel = '',
  groupName = '',
  isDemoMode = false,
  onCurrentLevelChange,
}: Props) {
  const [summary, setSummary] = useState<AdminStudentLevelSummary | null>(isDemoMode ? demoSummary : null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [validatedLevel, setValidatedLevel] = useState<CefrLevel>('B1')
  const [speakingLevel, setSpeakingLevel] = useState<CefrLevel | ''>('')
  const [reason, setReason] = useState<'INITIAL' | 'REVIEW' | 'PROGRESS' | 'OTHER'>('REVIEW')
  const [notes, setNotes] = useState('')
  const [useAutomatic, setUseAutomatic] = useState(false)
  const [acknowledgeMismatch, setAcknowledgeMismatch] = useState(false)

  useEffect(() => {
    if (isDemoMode || !studentId) return
    let mounted = true
    setLoading(true)
    getAdminStudentLevelSummary(studentId)
      .then((loaded) => { if (mounted) setSummary(loaded) })
      .catch((loadError) => { if (mounted) setError(loadError instanceof Error ? loadError.message : 'No se ha podido cargar el nivel.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, studentId])

  const canInitial = Boolean(summary && summary.assessmentHistory.length === 0 && !summary.latestAttempt)
  const mismatch = Boolean(targetLevel && targetLevel !== 'MIXED' && validatedLevel && targetLevel !== validatedLevel)
  const history = summary?.assessmentHistory || []
  const latestAttempt = summary?.latestAttempt || null

  useEffect(() => {
    if (!summary) return
    const suggested = (summary.currentLevel || summary.latestAttempt?.estimatedLevel || 'B1') as CefrLevel
    setValidatedLevel(suggested)
    setReason(summary.assessmentHistory.length === 0 && !summary.latestAttempt ? 'INITIAL' : 'REVIEW')
    setUseAutomatic(Boolean(summary.latestAttempt && summary.assessmentHistory.length === 0))
    setAcknowledgeMismatch(false)
  }, [summary])

  const reasonOptions = useMemo(() => {
    const values: Array<{ value: 'INITIAL' | 'REVIEW' | 'PROGRESS' | 'OTHER'; label: string }> = []
    if (canInitial) values.push({ value: 'INITIAL', label: 'Valoración inicial' })
    values.push({ value: 'REVIEW', label: 'Revisión' }, { value: 'PROGRESS', label: 'Progreso' }, { value: 'OTHER', label: 'Otra valoración' })
    return values
  }, [canInitial])

  function openForm() {
    if (!summary) return
    const nextReason = canInitial ? 'INITIAL' : 'REVIEW'
    setValidatedLevel((summary.currentLevel || latestAttempt?.estimatedLevel || 'B1') as CefrLevel)
    setSpeakingLevel(summary.latestAssessment?.speakingLevel || '')
    setReason(nextReason)
    setNotes('')
    setUseAutomatic(Boolean(latestAttempt && nextReason !== 'INITIAL'))
    setAcknowledgeMismatch(false)
    setMessage(null)
    setError(null)
    setEditing(true)
  }

  async function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!summary) return
    if (mismatch && (!acknowledgeMismatch || !notes.trim())) {
      setError('Para registrar un nivel distinto al objetivo del grupo debes justificarlo y confirmar expresamente la diferencia.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      if (isDemoMode) {
        const now = new Date().toISOString()
        const automaticLevel: CefrLevel | '' = useAutomatic ? (latestAttempt?.estimatedLevel || '') : ''
        const assessment = {
          id: `demo-${Date.now()}`,
          automaticLevel,
          speakingLevel,
          validatedLevel,
          reason,
          notes,
          assessedAt: now,
          assessedBy: 'demo-admin',
          assessedByName: 'Administración',
          sourceAttemptId: useAutomatic ? latestAttempt?.id || '' : '',
        }
        const nextSummary: AdminStudentLevelSummary = {
          ...summary,
          currentLevel: validatedLevel,
          currentLevelSource: 'VALIDATED',
          latestAssessment: assessment,
          assessmentHistory: [assessment, ...summary.assessmentHistory],
        }
        setSummary(nextSummary)
        onCurrentLevelChange?.(nextSummary.currentLevel, nextSummary.currentLevelSource)
      } else {
        const result = await createAdminStudentLevelAssessment(studentId, {
          validatedLevel,
          speakingLevel,
          reason,
          notes: notes.trim(),
          sourceAttemptId: useAutomatic ? latestAttempt?.id || '' : '',
          acknowledgeLevelMismatch: mismatch ? acknowledgeMismatch : false,
        })
        setSummary(result.summary)
        onCurrentLevelChange?.(result.summary.currentLevel, result.summary.currentLevelSource)
      }
      setEditing(false)
      setAcknowledgeMismatch(false)
      setMessage(`Nivel ${validatedLevel} registrado sin modificar el histórico anterior.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido registrar la valoración.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="panel phase14-profile-card phase14-wide-card admin-student-level-card">
      <div className="panel-heading admin-student-level-heading">
        <div><span className="eyebrow">NIVEL</span><h3>Evaluación y progreso</h3></div>
        <button type="button" onClick={openForm} disabled={loading || !summary}>Registrar valoración</button>
      </div>

      {loading && <div className="cms-notice" role="status">Cargando nivel…</div>}
      {message && <div className="cms-notice success-notice" role="status">{message}</div>}
      {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

      {summary && <>
        <div className="admin-student-level-summary">
          <div className="admin-student-level-current"><span>Nivel actual</span><strong>{summary.currentLevel || '—'}</strong><small>{sourceLabel(summary.currentLevelSource)}</small></div>
          <div><span>Último test automático</span><strong>{latestAttempt?.estimatedLevel || 'Sin test'}</strong><small>{latestAttempt ? `${Math.round(latestAttempt.scorePercent)}% · ${formatDate(latestAttempt.completedAt)}` : 'El alumno puede realizarlo desde Campus → Mi nivel.'}</small></div>
          <div><span>Última valoración</span><strong>{summary.latestAssessment?.validatedLevel || 'Sin valoración'}</strong><small>{summary.latestAssessment ? `${reasonLabel(summary.latestAssessment.reason)} · ${summary.latestAssessment.assessedByName || 'Academia'} · ${formatDate(summary.latestAssessment.assessedAt)}` : 'Todavía no hay valoración manual.'}</small></div>
        </div>

        {targetLevel && targetLevel !== 'MIXED' && summary.currentLevel && targetLevel !== summary.currentLevel && <div className="admin-student-level-mismatch" role="note"><strong>Revisar encaje con el grupo</strong><span>El nivel actual es {summary.currentLevel} y {groupName ? `el grupo ${groupName}` : 'el grupo activo'} tiene objetivo {targetLevel}. El historial no se modifica automáticamente.</span></div>}

        <div className="admin-student-level-history">
          <div className="admin-student-level-subheading"><div><span className="eyebrow">HISTÓRICO</span><h4>Valoraciones conservadas</h4></div><Link to="/admin/test-de-nivel/resultados">Ver resultados de test</Link></div>
          {history.length === 0 && <p className="admin-student-level-empty">Sin valoraciones manuales. Si no hay test, la primera valoración de academia se registrará como INITIAL.</p>}
          {history.map((assessment) => <div className="admin-student-level-history-row" key={assessment.id}>
            <span className="admin-student-level-badge">{assessment.validatedLevel}</span>
            <div><strong>{reasonLabel(assessment.reason)}</strong><small>{assessment.assessedByName || 'Academia'} · {formatDate(assessment.assessedAt)}</small>{assessment.notes && <p>{assessment.notes}</p>}</div>
            <div className="admin-student-level-evidence"><small>Automático: {assessment.automaticLevel || '—'}</small><small>Speaking: {assessment.speakingLevel || '—'}</small></div>
          </div>)}
        </div>
      </>}

      {editing && summary && <form className="admin-student-level-form phase14-form-grid" onSubmit={saveAssessment}>
        <div className="admin-student-level-form-title phase14-wide"><strong>Nueva valoración de academia</strong><span>Crea una entrada nueva. Nunca reemplaza una valoración anterior ni el resultado automático.</span></div>
        <label>Nivel validado<select aria-label="Nivel validado por Administración" value={validatedLevel} onChange={(event) => { setValidatedLevel(event.target.value as CefrLevel); setAcknowledgeMismatch(false) }}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
        <label>Speaking<select aria-label="Speaking por Administración" value={speakingLevel} onChange={(event) => setSpeakingLevel(event.target.value as CefrLevel | '')}><option value="">Sin valorar</option>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
        <label>Motivo<select aria-label="Motivo de valoración por Administración" value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}>{reasonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label className="admin-student-level-source">Evidencia automática<select aria-label="Vincular último test automático" value={useAutomatic ? 'LATEST' : ''} disabled={!latestAttempt || reason === 'INITIAL'} onChange={(event) => setUseAutomatic(event.target.value === 'LATEST')}><option value="">No vincular</option>{latestAttempt && <option value="LATEST">{latestAttempt.estimatedLevel} · {Math.round(latestAttempt.scorePercent)}%</option>}</select></label>
        {mismatch && <div className="admin-student-level-form-warning phase14-wide" role="alert"><strong>Diferencia con el grupo</strong><span>Vas a registrar {validatedLevel}, mientras que {groupName ? `el grupo ${groupName}` : 'el grupo activo'} tiene nivel objetivo {targetLevel}. Justifica la decisión en observaciones y confírmala expresamente.</span><label className="admin-student-level-confirm"><input type="checkbox" aria-label="Confirmar desajuste entre nivel y grupo" checked={acknowledgeMismatch} onChange={(event) => setAcknowledgeMismatch(event.target.checked)} /><span>Confirmo que el nivel validado no coincide con el grupo actual y que la decisión queda justificada en observaciones.</span></label></div>}
        <label className="phase14-wide">Observaciones<textarea aria-label="Observaciones de nivel por Administración" rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Criterio académico, evolución, motivo del ajuste o justificación del encaje con el grupo…" /></label>
        <div className="phase14-form-actions"><button type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="button button-primary" disabled={saving || (mismatch && (!acknowledgeMismatch || !notes.trim()))}>{saving ? 'Guardando…' : 'Guardar nueva valoración'}</button></div>
      </form>}
    </article>
  )
}
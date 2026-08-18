import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { listMyTeacherEnrollments, type TeacherEnrollmentRecord } from '../../services/pocketbase/teacherPortal'
import {
  getTeacherStudentLevelSummary,
  validateTeacherStudentLevel,
  type TeacherStudentLevelSummary,
} from '../../services/pocketbase/teacherLevels'
import type { CefrLevel, PlacementSkill } from '../../services/pocketbase/placementTest'
import { teacherNav } from './teacherNav'

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const skillLabels: Record<PlacementSkill, string> = {
  GRAMMAR: 'Gramática',
  VOCABULARY: 'Vocabulario',
  READING: 'Comprensión lectora',
  LISTENING: 'Comprensión oral',
}
const skillOrder: PlacementSkill[] = ['GRAMMAR', 'VOCABULARY', 'READING', 'LISTENING']

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function studentName(enrollment: TeacherEnrollmentRecord): string {
  const student = enrollment.expand?.student
  return student ? [student.name, student.surname].filter(Boolean).join(' ') || student.email : 'Alumno'
}

export default function TeacherLevelsPage() {
  const { isDemoMode } = useAuth()
  const [enrollments, setEnrollments] = useState<TeacherEnrollmentRecord[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [summary, setSummary] = useState<TeacherStudentLevelSummary | null>(null)
  const [speakingLevel, setSpeakingLevel] = useState<CefrLevel | ''>('')
  const [validatedLevel, setValidatedLevel] = useState<CefrLevel>('B1')
  const [reason, setReason] = useState<'INITIAL' | 'REVIEW' | 'PROGRESS' | 'OTHER'>('REVIEW')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(!isDemoMode)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listMyTeacherEnrollments()
      .then((records) => {
        if (!mounted) return
        setEnrollments(records)
        if (records[0]) setSelectedId(records[0].student)
      })
      .catch(() => { if (mounted) setError('No se han podido cargar tus alumnos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const students = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; group: string }>()
    enrollments.forEach((enrollment) => {
      if (!seen.has(enrollment.student)) seen.set(enrollment.student, {
        id: enrollment.student,
        name: studentName(enrollment),
        group: enrollment.expand?.group?.name || 'Grupo',
      })
    })
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [enrollments])

  useEffect(() => {
    if (!selectedId || isDemoMode) return
    let mounted = true
    setDetailLoading(true); setError(''); setMessage('')
    getTeacherStudentLevelSummary(selectedId)
      .then((value) => {
        if (!mounted) return
        setSummary(value)
        setSpeakingLevel(value.latestAssessment?.speakingLevel || '')
        setValidatedLevel((value.currentLevel || value.latestAttempt?.estimatedLevel || 'B1') as CefrLevel)
        setNotes('')
      })
      .catch(() => { if (mounted) setError('No se ha podido consultar el nivel. Comprueba que el alumno siga en uno de tus grupos activos.') })
      .finally(() => { if (mounted) setDetailLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, selectedId])

  async function submitValidation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !summary || saving) return
    setSaving(true); setError(''); setMessage('')
    try {
      await validateTeacherStudentLevel(selectedId, {
        sourceAttemptId: summary.latestAttempt?.attemptId || '',
        speakingLevel,
        validatedLevel,
        notes,
        reason,
      })
      const refreshed = await getTeacherStudentLevelSummary(selectedId)
      setSummary(refreshed)
      setNotes('')
      setMessage(`Nivel ${validatedLevel} validado y añadido al histórico.`)
    } catch {
      setError('No se ha podido guardar la valoración. Comprueba que el alumno siga asignado y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-levels-page">
        <header className="teacher-page-heading">
          <div><span className="eyebrow">EVALUACIÓN ACADÉMICA</span><h2>Niveles de mis alumnos</h2><p>Revisa el test Campus, añade una valoración de speaking y registra un nivel validado sin sobrescribir el resultado automático.</p></div>
        </header>

        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="teacher-levels-grid">
          <section className="panel teacher-levels-students">
            <div className="panel-heading"><div><span className="eyebrow">ALUMNOS AUTORIZADOS</span><h3>Grupos activos</h3></div><span className="status info">{students.length}</span></div>
            {loading && <div className="cms-notice" role="status">Cargando alumnos…</div>}
            <div className="teacher-levels-picker">
              {students.map((student) => <button type="button" key={student.id} className={selectedId === student.id ? 'active' : ''} onClick={() => setSelectedId(student.id)}><strong>{student.name}</strong><small>{student.group}</small></button>)}
            </div>
            {!loading && students.length === 0 && <PortalEmptyState compact title="Sin alumnos asignados" description="Solo aparecen alumnos con matrícula activa en uno de tus grupos." />}
          </section>

          <section className="panel teacher-levels-detail">
            {!selectedId && <PortalEmptyState title="Selecciona un alumno" description="Aquí podrás revisar su evaluación Campus y registrar una valoración docente." />}
            {detailLoading && <div className="cms-notice" role="status">Cargando evaluación…</div>}
            {summary && !detailLoading && <>
              <div className="teacher-levels-current">
                <div><span className="eyebrow">NIVEL ACTUAL</span><strong>{summary.currentLevel || '—'}</strong><small>{summary.currentLevelSource === 'VALIDATED' ? 'Validado por profesor' : summary.currentLevelSource === 'AUTOMATIC' ? 'Estimación automática' : 'Sin evaluación'}</small></div>
                <div><span className="eyebrow">ALUMNO</span><h3>{[summary.student.name, summary.student.surname].filter(Boolean).join(' ') || summary.student.email}</h3><small>{summary.student.email}</small></div>
              </div>

              <article className="teacher-level-attempt">
                <div className="panel-heading"><div><span className="eyebrow">ÚLTIMO TEST CAMPUS</span><h3>{summary.latestAttempt ? `${summary.latestAttempt.estimatedLevel} · ${Math.round(summary.latestAttempt.scorePercent)}%` : 'Sin test completado'}</h3></div>{summary.latestAttempt && <small>{formatDate(summary.latestAttempt.completedAt)}</small>}</div>
                {summary.latestAttempt && <div className="teacher-level-skill-grid">{skillOrder.filter((skill) => Boolean(summary.latestAttempt?.skillScores[skill])).map((skill) => {
                  const score = summary.latestAttempt?.skillScores[skill]
                  if (!score) return null
                  return <div className={score.diagnosticOnly ? 'is-diagnostic' : ''} key={skill}><span>{skillLabels[skill]}{score.diagnosticOnly ? ' · diagnóstico' : ''}</span><strong>{Math.round(score.percent)}%</strong><small>{score.correct}/{score.total}</small></div>
                })}</div>}
              </article>

              <form className="teacher-level-validation" onSubmit={submitValidation}>
                <div className="panel-heading"><div><span className="eyebrow">VALORACIÓN DOCENTE</span><h3>Registrar una nueva validación</h3></div></div>
                <div className="teacher-level-form-grid">
                  <label className="field-stack"><span>Speaking</span><select value={speakingLevel} onChange={(event) => setSpeakingLevel(event.target.value as CefrLevel | '')}><option value="">Sin valorar</option>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                  <label className="field-stack"><span>Nivel validado</span><select value={validatedLevel} onChange={(event) => setValidatedLevel(event.target.value as CefrLevel)}>{LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
                  <label className="field-stack"><span>Motivo</span><select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}><option value="INITIAL">Valoración inicial</option><option value="REVIEW">Revisión</option><option value="PROGRESS">Progreso</option><option value="OTHER">Otro</option></select></label>
                  <label className="field-stack span-two"><span>Observaciones</span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Fluidez, comprensión oral, objetivos, matices…" /></label>
                </div>
                <p className="teacher-level-help">La nueva valoración se añadirá al histórico. El test automático original permanece intacto y seguirá siendo trazable.</p>
                <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar nivel validado'}</button>
              </form>

              <article className="teacher-level-history">
                <div className="panel-heading"><div><span className="eyebrow">HISTÓRICO DOCENTE</span><h3>Validaciones anteriores</h3></div><span className="status info">{summary.assessmentHistory.length}</span></div>
                <div className="teacher-level-history-list">{summary.assessmentHistory.map((assessment) => <div key={assessment.assessmentId}><strong>{assessment.validatedLevel}</strong><span>{formatDate(assessment.assessedAt)}</span><small>{assessment.speakingLevel ? `Speaking ${assessment.speakingLevel} · ` : ''}{assessment.reason}</small>{assessment.notes && <p>{assessment.notes}</p>}</div>)}</div>
                {summary.assessmentHistory.length === 0 && <PortalEmptyState compact title="Sin validaciones docentes" description="La primera valoración que guardes aparecerá aquí." />}
              </article>
            </>}
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  getTeacherSubmissionFileUrl,
  listMyTeacherAssignments,
  listMyTeacherEnrollments,
  listMyTeacherSubmissions,
  reviewTeacherSubmission,
  type TeacherEnrollmentRecord,
} from '../../services/pocketbase/teacherPortal'
import type { AssignmentRecord, SubmissionRecord } from '../../services/pocketbase/studentPortal'
import { teacherNav } from './teacherNav'

function formatDate(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function statusLabel(status: SubmissionRecord['status']): string {
  if (status === 'RETURNED') return 'Devuelta'
  if (status === 'REVIEWED') return 'Revisada'
  return 'Pendiente'
}

function statusPriority(status: SubmissionRecord['status']): number {
  if (status === 'SUBMITTED') return 0
  if (status === 'RETURNED') return 1
  return 2
}

function statusTone(status: SubmissionRecord['status']): 'warning' | 'info' | 'success' {
  if (status === 'SUBMITTED') return 'warning'
  if (status === 'RETURNED') return 'info'
  return 'success'
}

export default function TeacherCorrectionsPage() {
  const { isDemoMode } = useAuth()
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([])
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [enrollments, setEnrollments] = useState<TeacherEnrollmentRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [grade, setGrade] = useState('')
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadConnected() {
    const [submissionRecords, assignmentRecords, enrollmentRecords] = await Promise.all([
      listMyTeacherSubmissions(100), listMyTeacherAssignments(100), listMyTeacherEnrollments(),
    ])
    setSubmissions(submissionRecords)
    setAssignments(assignmentRecords)
    setEnrollments(enrollmentRecords)
  }

  useEffect(() => {
    if (isDemoMode) {
      const demoAssignment: AssignmentRecord = { id: 'a1', collectionId: '', collectionName: 'assignments', created: '', updated: '', expand: {}, title: 'Writing · My last trip', description: 'Write 120 words.', teacher: 'demo', group: 'g1', student: '', attachment: '', due_at: '2026-08-15T18:00:00Z', status: 'PUBLISHED' }
      const demoSubmission: SubmissionRecord = { id: 's1', collectionId: '', collectionName: 'assignment_submissions', created: '', updated: '', expand: {}, assignment: 'a1', student: 'st1', file: 'my-last-trip.docx', text_answer: 'Last summer I travelled to...', submitted_at: '2026-08-12T17:00:00Z', teacher_feedback: '', grade_text: '', status: 'SUBMITTED' }
      setAssignments([demoAssignment])
      setSubmissions([demoSubmission])
      setSelectedId('s1')
      return
    }
    let mounted = true
    loadConnected()
      .catch(() => { if (mounted) setError('No se han podido cargar las entregas. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const assignmentMap = useMemo(() => new Map(assignments.map((item) => [item.id, item])), [assignments])
  const studentMap = useMemo(() => new Map(enrollments.map((item) => {
    const student = item.expand?.student
    return [item.student, student ? [student.name, student.surname].filter(Boolean).join(' ') : 'Alumno']
  })), [enrollments])
  const orderedSubmissions = useMemo(() => [...submissions].sort((a, b) => {
    const priority = statusPriority(a.status) - statusPriority(b.status)
    if (priority !== 0) return priority
    return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
  }), [submissions])
  const selected = submissions.find((item) => item.id === selectedId) || null

  function selectSubmission(record: SubmissionRecord) {
    setSelectedId(record.id)
    setFeedback(record.teacher_feedback || '')
    setGrade(record.grade_text || '')
    setMessage(null)
    setError(null)
  }

  useEffect(() => {
    if (orderedSubmissions.length === 0) {
      if (selectedId) setSelectedId(null)
      return
    }
    if (!selectedId || !submissions.some((item) => item.id === selectedId)) {
      const first = orderedSubmissions[0]
      setSelectedId(first.id)
      setFeedback(first.teacher_feedback || '')
      setGrade(first.grade_text || '')
    }
  }, [orderedSubmissions, selectedId, submissions])

  async function openFile(record: SubmissionRecord) {
    if (!record.file) return
    if (isDemoMode) {
      setMessage('La descarga real no está disponible en la demostración.')
      return
    }
    try {
      window.open(await getTeacherSubmissionFileUrl(record), '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se ha podido abrir el archivo entregado.')
    }
  }

  async function saveReview(status: 'REVIEWED' | 'RETURNED') {
    if (!selected) return
    if (isDemoMode) {
      setSubmissions((current) => current.map((item) => item.id === selected.id ? { ...item, teacher_feedback: feedback, grade_text: grade, status } : item))
      setMessage(status === 'REVIEWED' ? 'Corrección preparada en la demostración.' : 'Entrega marcada como devuelta en la demostración.')
      return
    }
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const updated = await reviewTeacherSubmission(selected, { feedback, grade, status })
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage(status === 'REVIEWED' ? 'Corrección guardada.' : 'Entrega devuelta al alumno.')
    } catch {
      setError('No se ha podido guardar la corrección. Comprueba que la entrega siga vinculada a una tarea de tus grupos y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void saveReview('REVIEWED')
  }

  const pending = submissions.filter((item) => item.status === 'SUBMITTED').length

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-portal-page teacher-corrections-page">
        <header className="teacher-page-heading">
          <div><span className="eyebrow">SEGUIMIENTO</span><h2>Correcciones</h2><p>Revisa primero lo que necesita respuesta y devuelve al alumno una valoración clara, útil y trazable.</p></div>
          <div className="private-space-badge"><strong>{pending}</strong><span>{pending === 1 ? 'pendiente' : 'pendientes'}</span></div>
        </header>
        {loading && <div className="cms-notice" role="status">Cargando entregas…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
        <div className="teacher-corrections-grid teacher-corrections-workspace">
          <section className="panel teacher-correction-list">
            <div className="panel-heading"><div><span className="eyebrow">COLA DE REVISIÓN</span><h3>{submissions.length} entregas</h3></div></div>
            <div className="teacher-correction-items">
              {orderedSubmissions.map((record) => {
                const task = assignmentMap.get(record.assignment)
                const studentName = studentMap.get(record.student) || 'Alumno'
                return (
                  <button
                    key={record.id}
                    className={`${selectedId === record.id ? 'active ' : ''}correction-${record.status.toLowerCase()}`}
                    type="button"
                    onClick={() => selectSubmission(record)}
                  >
                    <span className="avatar-mini">{studentName.charAt(0).toUpperCase()}</span>
                    <span><strong>{studentName}</strong><small>{task?.title || 'Tarea'} · {formatDate(record.submitted_at)}</small></span>
                    <em className={`status ${statusTone(record.status)}`}>{statusLabel(record.status)}</em>
                  </button>
                )
              })}
              {!loading && submissions.length === 0 && <PortalEmptyState compact title="No tienes entregas pendientes" description="Cuando un alumno entregue una tarea creada por ti, aparecerá aquí para su revisión." action={{ label: 'Ver tareas', to: '/profesor/tareas' }} />}
            </div>
          </section>
          <section className="panel teacher-correction-detail">
            {!selected && <PortalEmptyState title={submissions.length === 0 ? 'Sin entregas para revisar' : 'Selecciona una entrega'} description={submissions.length === 0 ? 'Puedes revisar tus tareas publicadas mientras llegan nuevas entregas.' : 'Aquí podrás leer la respuesta, abrir el archivo entregado y añadir feedback.'} />}
            {selected && <form onSubmit={submitReview}>
              <div className="student-task-header teacher-correction-context">
                <div><span className="eyebrow">{studentMap.get(selected.student) || 'Alumno'}</span><h3>{assignmentMap.get(selected.assignment)?.title || 'Tarea'}</h3><p>{assignmentMap.get(selected.assignment)?.description || 'Sin instrucciones adicionales.'}</p></div>
                <span className={`status ${statusTone(selected.status)}`}>{statusLabel(selected.status)}</span>
              </div>
              <section className="teacher-correction-evidence" aria-label="Entrega del alumno">
                <div className="teacher-answer-box"><span className="eyebrow">RESPUESTA DEL ALUMNO</span>{selected.text_answer ? <p>{selected.text_answer}</p> : <p className="muted">La entrega no incluye respuesta escrita.</p>}</div>
                {selected.file && <button className="button button-ghost button-small" type="button" onClick={() => void openFile(selected)}>Abrir archivo entregado</button>}
              </section>
              <div className="teacher-feedback-editor">
                <div className="teacher-feedback-heading"><span className="eyebrow">VALORACIÓN DOCENTE</span><strong>Feedback para el alumno</strong></div>
                <label className="field-stack"><span>Feedback</span><textarea rows={6} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Comentarios para el alumno..." /></label>
                <label className="field-stack"><span>Calificación / valoración</span><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Ej. Muy bien · 8/10 · A mejorar" /></label>
                <div className="cms-form-actions teacher-review-actions">
                  <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Marcar revisada'}</button>
                  <button className="button button-ghost" type="button" disabled={saving} onClick={() => void saveReview('RETURNED')}>Devolver al alumno</button>
                </div>
              </div>
            </form>}
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

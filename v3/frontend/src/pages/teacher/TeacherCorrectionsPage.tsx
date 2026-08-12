import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
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
    setSubmissions(submissionRecords); setAssignments(assignmentRecords); setEnrollments(enrollmentRecords)
  }

  useEffect(() => {
    if (isDemoMode) {
      const demoAssignment: AssignmentRecord = { id: 'a1', collectionId: '', collectionName: 'assignments', created: '', updated: '', expand: {}, title: 'Writing · My last trip', description: 'Write 120 words.', teacher: 'demo', group: 'g1', student: '', attachment: '', due_at: '2026-08-15T18:00:00Z', status: 'PUBLISHED' }
      const demoSubmission: SubmissionRecord = { id: 's1', collectionId: '', collectionName: 'assignment_submissions', created: '', updated: '', expand: {}, assignment: 'a1', student: 'st1', file: 'my-last-trip.docx', text_answer: 'Last summer I travelled to...', submitted_at: '2026-08-12T17:00:00Z', teacher_feedback: '', grade_text: '', status: 'SUBMITTED' }
      setAssignments([demoAssignment]); setSubmissions([demoSubmission]); setSelectedId('s1')
      return
    }
    let mounted = true
    loadConnected().catch(() => { if (mounted) setError('No se han podido cargar las entregas de tus tareas.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const assignmentMap = useMemo(() => new Map(assignments.map((item) => [item.id, item])), [assignments])
  const studentMap = useMemo(() => new Map(enrollments.map((item) => {
    const student = item.expand?.student
    return [item.student, student ? [student.name, student.surname].filter(Boolean).join(' ') : 'Alumno']
  })), [enrollments])
  const selected = submissions.find((item) => item.id === selectedId) || null

  function selectSubmission(record: SubmissionRecord) {
    setSelectedId(record.id); setFeedback(record.teacher_feedback || ''); setGrade(record.grade_text || ''); setMessage(null); setError(null)
  }

  async function openFile(record: SubmissionRecord) {
    if (!record.file) return
    if (isDemoMode) { setMessage('Descarga protegida disponible en modo connected.'); return }
    try { window.open(await getTeacherSubmissionFileUrl(record), '_blank', 'noopener,noreferrer') } catch { setError('No se ha podido abrir el archivo entregado.') }
  }

  async function saveReview(event: FormEvent<HTMLFormElement>, status: 'REVIEWED' | 'RETURNED') {
    event.preventDefault(); if (!selected) return
    if (isDemoMode) {
      setSubmissions((current) => current.map((item) => item.id === selected.id ? { ...item, teacher_feedback: feedback, grade_text: grade, status } : item))
      setMessage(status === 'REVIEWED' ? 'Corrección guardada en demo.' : 'Entrega devuelta en demo.')
      return
    }
    setSaving(true); setError(null); setMessage(null)
    try {
      const updated = await reviewTeacherSubmission(selected, { feedback, grade, status })
      setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage(status === 'REVIEWED' ? 'Corrección guardada.' : 'Entrega devuelta al alumno.')
    } catch { setError('No se ha podido guardar la corrección. El servidor solo permite revisar entregas de tus tareas.') }
    finally { setSaving(false) }
  }

  const pending = submissions.filter((item) => item.status === 'SUBMITTED').length

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-portal-page">
        <header className="teacher-page-heading"><div><span className="eyebrow">SEGUIMIENTO</span><h2>Correcciones</h2><p>Revisa únicamente las entregas vinculadas a tareas creadas por tu cuenta.</p></div><div className="private-space-badge"><strong>{pending}</strong><span>pendientes</span></div></header>
        {loading && <div className="cms-notice">Cargando entregas…</div>}{message && <div className="cms-notice success-notice">{message}</div>}{error && <div className="cms-notice auth-error">{error}</div>}
        <div className="teacher-corrections-grid">
          <section className="panel teacher-correction-list"><div className="panel-heading"><div><span className="eyebrow">ENTREGAS</span><h3>{submissions.length} recibidas</h3></div></div><div>{submissions.map((record) => { const task = assignmentMap.get(record.assignment); const studentName = studentMap.get(record.student) || 'Alumno'; return <button key={record.id} className={selectedId === record.id ? 'active' : ''} type="button" onClick={() => selectSubmission(record)}><span className="avatar-mini">{studentName.charAt(0).toUpperCase()}</span><span><strong>{studentName}</strong><small>{task?.title || 'Tarea'} · {formatDate(record.submitted_at)}</small></span><em className={`status ${record.status === 'SUBMITTED' ? 'warning' : 'success'}`}>{record.status === 'SUBMITTED' ? 'Pendiente' : record.status === 'RETURNED' ? 'Devuelta' : 'Revisada'}</em></button> })}{!loading && submissions.length === 0 && <p className="muted">No tienes entregas todavía.</p>}</div></section>
          <section className="panel teacher-correction-detail">
            {!selected && <div className="student-empty-detail"><span>CORRECCIONES</span><h3>Selecciona una entrega</h3><p>Aquí podrás leer la respuesta y añadir feedback.</p></div>}
            {selected && <form onSubmit={(event) => void saveReview(event, 'REVIEWED')}>
              <div className="student-task-header"><div><span className="eyebrow">{studentMap.get(selected.student) || 'Alumno'}</span><h3>{assignmentMap.get(selected.assignment)?.title || 'Tarea'}</h3><p>{assignmentMap.get(selected.assignment)?.description || 'Sin instrucciones adicionales.'}</p></div><span className={`status ${selected.status === 'SUBMITTED' ? 'warning' : 'success'}`}>{selected.status}</span></div>
              {selected.text_answer && <div className="teacher-answer-box"><span className="eyebrow">RESPUESTA</span><p>{selected.text_answer}</p></div>}
              {selected.file && <button className="button button-ghost button-small" type="button" onClick={() => void openFile(selected)}>Abrir archivo entregado</button>}
              <label className="field-stack"><span>Feedback</span><textarea rows={6} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Comentarios para el alumno..." /></label>
              <label className="field-stack"><span>Calificación / valoración</span><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="Ej. Muy bien · 8/10 · A mejorar" /></label>
              <div className="cms-form-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Marcar revisada'}</button><button className="button button-ghost" type="button" disabled={saving} onClick={(event) => void saveReview({ ...event, preventDefault: () => undefined } as unknown as FormEvent<HTMLFormElement>, 'RETURNED')}>Devolver al alumno</button></div>
            </form>}
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { getAssignmentAttachmentUrl, getSubmissionFileUrl } from '../../services/pocketbase/studentResources'
import {
  listMyAssignments,
  listMySubmissions,
  submitAssignment,
  type AssignmentRecord,
  type SubmissionRecord,
} from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

type TaskView = {
  id: string
  title: string
  description: string
  dueAt: string
  status: 'PUBLISHED' | 'CLOSED'
  attachment: string
  record?: AssignmentRecord
}

type SubmissionView = {
  assignment: string
  status: 'SUBMITTED' | 'REVIEWED' | 'RETURNED'
  textAnswer: string
  feedback: string
  grade: string
  file: string
  record?: SubmissionRecord
}

const demoTasks: TaskView[] = [
  { id: 'demo-1', title: 'Writing · My last trip', description: 'Escribe entre 120 y 150 palabras utilizando Past Simple y conectores.', dueAt: '2026-08-15T20:00:00Z', status: 'PUBLISHED', attachment: 'writing-template.pdf' },
  { id: 'demo-2', title: 'Speaking notes · Travel', description: 'Prepara cinco ideas para hablar durante dos minutos en clase.', dueAt: '2026-08-19T18:00:00Z', status: 'PUBLISHED', attachment: '' },
  { id: 'demo-3', title: 'Vocabulary review', description: 'Actividad ya revisada por el profesor.', dueAt: '2026-08-08T18:00:00Z', status: 'CLOSED', attachment: '' },
]

const demoSubmissions: SubmissionView[] = [
  { assignment: 'demo-3', status: 'REVIEWED', textAnswer: 'Completed', feedback: 'Buen trabajo. Revisa la diferencia entre journey y trip.', grade: 'Muy bien', file: '' },
]

function formatDue(value: string): string {
  if (!value) return 'Sin fecha límite'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha límite'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function submissionLabel(submission?: SubmissionView): string {
  if (!submission) return 'Pendiente'
  if (submission.status === 'REVIEWED') return 'Corregida'
  if (submission.status === 'RETURNED') return 'Devuelta'
  return 'Entregada'
}

function taskPriority(task: TaskView, submission?: SubmissionView): number {
  if (!submission && task.status !== 'CLOSED') return 0
  if (submission?.status === 'RETURNED') return 1
  if (submission?.status === 'SUBMITTED') return 2
  if (submission?.status === 'REVIEWED') return 3
  return 4
}

function taskStateTone(task: TaskView, submission?: SubmissionView): 'warning' | 'info' | 'success' | 'muted' {
  if (!submission && task.status !== 'CLOSED') return 'warning'
  if (submission?.status === 'RETURNED') return 'warning'
  if (submission?.status === 'SUBMITTED') return 'info'
  if (submission?.status === 'REVIEWED') return 'success'
  return 'muted'
}

function taskStateHelper(task: TaskView, submission?: SubmissionView): string {
  if (!submission && task.status !== 'CLOSED') return 'Necesita tu entrega'
  if (submission?.status === 'RETURNED') return 'Revisa la corrección'
  if (submission?.status === 'SUBMITTED') return 'Esperando al profesor'
  if (submission?.status === 'REVIEWED') return 'Feedback disponible'
  return 'Actividad cerrada'
}

export default function StudentAssignmentsPage() {
  const { isDemoMode } = useAuth()
  const [tasks, setTasks] = useState<TaskView[]>(isDemoMode ? demoTasks : [])
  const [submissions, setSubmissions] = useState<SubmissionView[]>(isDemoMode ? demoSubmissions : [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [textAnswer, setTextAnswer] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadConnected() {
    const [assignmentRecords, submissionRecords] = await Promise.all([listMyAssignments(100), listMySubmissions(100)])
    setTasks(assignmentRecords.map((record) => ({
      id: record.id,
      title: record.title,
      description: record.description,
      dueAt: record.due_at,
      status: record.status === 'CLOSED' ? 'CLOSED' : 'PUBLISHED',
      attachment: record.attachment,
      record,
    })))
    setSubmissions(submissionRecords.map((record) => ({
      assignment: record.assignment,
      status: record.status,
      textAnswer: record.text_answer,
      feedback: record.teacher_feedback,
      grade: record.grade_text,
      file: record.file,
      record,
    })))
  }

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    loadConnected()
      .catch(() => {
        if (mounted) setError('No se han podido cargar tus tareas y entregas. Inténtalo de nuevo en unos segundos.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [isDemoMode])

  const submissionMap = useMemo(() => new Map(submissions.map((item) => [item.assignment, item])), [submissions])
  const orderedTasks = useMemo(() => [...tasks].sort((a, b) => {
    const priorityDifference = taskPriority(a, submissionMap.get(a.id)) - taskPriority(b, submissionMap.get(b.id))
    if (priorityDifference !== 0) return priorityDifference
    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER
    return aDue - bDue
  }), [tasks, submissionMap])

  useEffect(() => {
    if (!selectedId && orderedTasks.length > 0) setSelectedId(orderedTasks[0].id)
  }, [orderedTasks, selectedId])

  const selectedTask = tasks.find((item) => item.id === selectedId) || null
  const selectedSubmission = selectedTask ? submissionMap.get(selectedTask.id) : undefined
  const pending = tasks.filter((item) => !submissionMap.has(item.id) && item.status !== 'CLOSED').length
  const returned = submissions.filter((item) => item.status === 'RETURNED').length
  const inReview = submissions.filter((item) => item.status === 'SUBMITTED').length
  const reviewed = submissions.filter((item) => item.status === 'REVIEWED').length
  const attention = pending + returned

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null
    setError(null)
    if (selected && selected.size > 20 * 1024 * 1024) {
      setError('La entrega supera el límite de 20 MB.')
      event.target.value = ''
      setFile(null)
      return
    }
    setFile(selected)
  }

  function openTask(task: TaskView) {
    setSelectedId(task.id)
    setTextAnswer('')
    setFile(null)
    setMessage(null)
    setError(null)
  }

  async function downloadInstructions(task: TaskView) {
    if (!task.attachment) return
    if (isDemoMode || !task.record) {
      setMessage('La descarga real no está disponible en la demostración.')
      return
    }
    try {
      const url = await getAssignmentAttachmentUrl(task.record)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se ha podido abrir el adjunto de la tarea.')
    }
  }

  async function downloadSubmission(submission: SubmissionView) {
    if (!submission.file || !submission.record) return
    try {
      const url = await getSubmissionFileUrl(submission.record)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se ha podido abrir tu archivo entregado.')
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask) return
    setError(null)
    setMessage(null)

    if (selectedSubmission) {
      setError('Esta tarea ya tiene una entrega registrada.')
      return
    }
    if (selectedTask.status === 'CLOSED') {
      setError('La tarea está cerrada y ya no admite nuevas entregas.')
      return
    }
    if (!textAnswer.trim() && !file) {
      setError('Escribe una respuesta o adjunta un archivo antes de entregar.')
      return
    }

    if (isDemoMode) {
      setSubmissions((current) => [...current, { assignment: selectedTask.id, status: 'SUBMITTED', textAnswer: textAnswer.trim(), feedback: '', grade: '', file: file?.name || '' }])
      setMessage('Entrega registrada en la demostración. No se ha enviado ningún archivo.')
      setTextAnswer('')
      setFile(null)
      return
    }

    setSubmitting(true)
    try {
      await submitAssignment({ assignmentId: selectedTask.id, textAnswer, file: file || undefined })
      await loadConnected()
      setMessage('Tarea entregada correctamente.')
      setTextAnswer('')
      setFile(null)
    } catch {
      setError('No se ha podido registrar la entrega. Comprueba que la tarea siga disponible y no exista una entrega anterior.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-files-page student-tasks-phase10c">
        <header className="student-page-heading student-tasks-heading10">
          <div><span className="eyebrow">TRABAJO PERSONAL</span><h2>Tareas y correcciones</h2><p>Primero lo que requiere acción. Después, tus entregas en revisión y las correcciones que ya puedes consultar.</p></div>
          <div className="private-space-badge"><strong>{attention}</strong><span>{attention === 1 ? 'acción pendiente' : 'acciones pendientes'}</span></div>
        </header>

        <section className="student-task-overview10" aria-label="Resumen de tareas">
          <div className={attention > 0 ? 'needs-attention' : 'is-clear'}><small>POR HACER / REVISAR</small><strong>{attention}</strong><span>{attention > 0 ? 'Necesita tu atención' : 'Todo al día'}</span></div>
          <div><small>EN REVISIÓN</small><strong>{inReview}</strong><span>Entregadas al profesor</span></div>
          <div><small>CORREGIDAS</small><strong>{reviewed}</strong><span>Con feedback disponible</span></div>
        </section>

        {loading && <div className="cms-notice" role="status">Cargando tareas…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="student-tasks-layout student-tasks-layout10">
          <section className="panel student-task-list-panel student-task-list-panel10">
            <div className="panel-heading"><div><span className="eyebrow">TU LISTA</span><h3>{tasks.length} actividades</h3></div></div>
            <div className="student-task-list student-task-list10">
              {orderedTasks.map((task) => {
                const submission = submissionMap.get(task.id)
                const tone = taskStateTone(task, submission)
                return (
                  <button key={task.id} type="button" className={`${selectedId === task.id ? 'active ' : ''}task-tone-${tone}`} onClick={() => openTask(task)}>
                    <span className="student-task-state">{submissionLabel(submission)}</span>
                    <span className="student-task-list-copy"><strong>{task.title}</strong><small>{taskStateHelper(task, submission)} · {formatDue(task.dueAt)}</small></span>
                    <b>→</b>
                  </button>
                )
              })}
              {!loading && tasks.length === 0 && (
                <PortalEmptyState
                  compact
                  title="Todo al día"
                  description="No tienes tareas asignadas ahora mismo. Cuando tu profesor publique una actividad aparecerá aquí."
                  action={{ label: 'Ver material', to: '/alumno/material' }}
                />
              )}
            </div>
          </section>

          <section className="panel student-task-detail student-task-detail10">
            {!selectedTask && (
              <PortalEmptyState
                title={tasks.length === 0 ? 'Sin tareas pendientes' : 'Selecciona una actividad'}
                description={tasks.length === 0 ? 'Puedes aprovechar para revisar el material publicado o consultar tus próximas clases.' : 'Aquí verás las instrucciones, tu entrega y la corrección del profesor.'}
              />
            )}

            {selectedTask && (
              <>
                <div className="student-task-header student-task-header10">
                  <div><span className="eyebrow">{submissionLabel(selectedSubmission)}</span><h3>{selectedTask.title}</h3><p>{selectedTask.description || 'Sin instrucciones adicionales.'}</p></div>
                  <div className="student-task-due10"><small>FECHA LÍMITE</small><strong>{formatDue(selectedTask.dueAt)}</strong></div>
                </div>

                {selectedTask.attachment && <button className="button button-ghost button-small" type="button" onClick={() => void downloadInstructions(selectedTask)}>Descargar adjunto</button>}

                {selectedSubmission ? (
                  <div className="student-submission-review student-submission-review10">
                    <section className="student-submission-copy10">
                      <span className="eyebrow">TU ENTREGA</span>
                      {selectedSubmission.textAnswer && <p>{selectedSubmission.textAnswer}</p>}
                      {selectedSubmission.file && <button type="button" className="text-link button-reset" onClick={() => void downloadSubmission(selectedSubmission)}>Abrir archivo entregado →</button>}
                      {!selectedSubmission.textAnswer && !selectedSubmission.file && <p className="muted">La entrega está registrada.</p>}
                    </section>
                    <div className={`student-feedback-box student-feedback-box10 feedback-${selectedSubmission.status.toLowerCase()}`}>
                      <div className="student-feedback-heading10"><span className="eyebrow">FEEDBACK DEL PROFESOR</span><span className={`status ${selectedSubmission.status === 'RETURNED' ? 'warning' : selectedSubmission.status === 'REVIEWED' ? 'success' : 'info'}`}>{submissionLabel(selectedSubmission)}</span></div>
                      <strong>{selectedSubmission.grade || (selectedSubmission.status === 'REVIEWED' ? 'Revisada' : selectedSubmission.status === 'RETURNED' ? 'Revisa los comentarios' : 'Pendiente de revisión')}</strong>
                      <p>{selectedSubmission.feedback || (selectedSubmission.status === 'SUBMITTED' ? 'Tu entrega está registrada. El feedback aparecerá aquí cuando el profesor la revise.' : 'Tu profesor todavía no ha añadido comentarios.')}</p>
                      {selectedSubmission.status === 'RETURNED' && <small>Esta entrega sigue registrada. El Campus no habilita una segunda entrega automática mientras no exista un flujo de reentrega autorizado.</small>}
                    </div>
                  </div>
                ) : (
                  <form className="student-submission-form student-submission-form10" onSubmit={submit}>
                    <div className="student-submission-callout10"><span className="eyebrow">TU SIGUIENTE PASO</span><strong>Prepara y entrega esta actividad</strong><p>Puedes escribir la respuesta, adjuntar un archivo o combinar ambas opciones cuando la tarea lo necesite.</p></div>
                    <label className="field-stack"><span>Respuesta</span><textarea rows={6} value={textAnswer} onChange={(event) => setTextAnswer(event.target.value)} placeholder="Escribe aquí tu respuesta si la actividad admite texto..." /></label>
                    <label className="upload-dropzone student-file-dropzone">
                      <input type="file" accept=".pdf,.doc,.docx,.mp3,.m4a,.jpg,.jpeg,.png,.webp" onChange={chooseFile} disabled={submitting || selectedTask.status === 'CLOSED'} />
                      <strong>{file ? file.name : 'Adjuntar archivo opcional'}</strong>
                      <small>PDF, documento, audio o imagen · máximo 20 MB</small>
                    </label>
                    <button className="button button-primary" type="submit" disabled={submitting || selectedTask.status === 'CLOSED'}>{submitting ? 'Entregando…' : selectedTask.status === 'CLOSED' ? 'Tarea cerrada' : 'Entregar tarea'}</button>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

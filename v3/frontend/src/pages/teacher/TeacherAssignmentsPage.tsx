import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createTeacherAssignment,
  deleteTeacherAssignment,
  getTeacherAssignmentAttachmentUrl,
  listMyTeacherAssignments,
  listMyTeacherEnrollments,
  listMyTeacherGroups,
  updateTeacherAssignmentStatus,
  type TeacherEnrollmentRecord,
  type TeacherGroupRecord,
  type TeacherTarget,
} from '../../services/pocketbase/teacherPortal'
import type { AssignmentRecord } from '../../services/pocketbase/studentPortal'
import { teacherNav } from './teacherNav'

type TargetOption = { key: string; type: TeacherTarget['type']; id: string; label: string }

function formatDue(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function statusLabel(status: AssignmentRecord['status']): string {
  if (status === 'DRAFT') return 'Borrador'
  if (status === 'CLOSED') return 'Cerrada'
  return 'Publicada'
}

export default function TeacherAssignmentsPage() {
  const { isDemoMode } = useAuth()
  const [groups, setGroups] = useState<TeacherGroupRecord[]>([])
  const [enrollments, setEnrollments] = useState<TeacherEnrollmentRecord[]>([])
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([])
  const [targetKey, setTargetKey] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [draft, setDraft] = useState(false)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const targets = useMemo<TargetOption[]>(() => {
    const groupTargets = groups.map((group) => ({ key: `GROUP:${group.id}`, type: 'GROUP' as const, id: group.id, label: `Grupo · ${group.name}` }))
    const seen = new Set<string>()
    const studentTargets = enrollments.flatMap((enrollment) => {
      if (seen.has(enrollment.student)) return []
      seen.add(enrollment.student)
      const student = enrollment.expand?.student
      const name = student ? [student.name, student.surname].filter(Boolean).join(' ') : 'Alumno'
      return [{ key: `STUDENT:${enrollment.student}`, type: 'STUDENT' as const, id: enrollment.student, label: `Alumno · ${name}` }]
    })
    return [...groupTargets, ...studentTargets]
  }, [enrollments, groups])

  async function loadConnected() {
    const [groupRecords, enrollmentRecords, assignmentRecords] = await Promise.all([
      listMyTeacherGroups(), listMyTeacherEnrollments(), listMyTeacherAssignments(100),
    ])
    setGroups(groupRecords)
    setEnrollments(enrollmentRecords)
    setAssignments(assignmentRecords)
    setTargetKey((current) => current || (groupRecords[0] ? `GROUP:${groupRecords[0].id}` : enrollmentRecords[0] ? `STUDENT:${enrollmentRecords[0].student}` : ''))
  }

  useEffect(() => {
    if (isDemoMode) {
      setGroups([{ id: 'g1', collectionId: '', collectionName: 'groups', created: '', updated: '', expand: {}, name: 'Adultos B1', course: 'c1', teacher: 'demo', academic_year: '2026/27', schedule_text: 'M/J 18:00', capacity: 8, status: 'ACTIVE' }])
      setTargetKey('GROUP:g1')
      return
    }
    let mounted = true
    loadConnected()
      .catch(() => { if (mounted) setError('No se han podido cargar tus tareas y destinos disponibles. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  function chooseAttachment(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] || null
    setError(null)
    if (selected && selected.size > 20 * 1024 * 1024) {
      setError('El adjunto supera el límite de 20 MB.')
      event.target.value = ''
      setAttachment(null)
      return
    }
    setAttachment(selected)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const target = targets.find((item) => item.key === targetKey)
    if (!target || !title.trim()) {
      setError(targets.length === 0 ? 'Todavía no tienes grupos o alumnos activos a los que asignar una tarea.' : 'Indica un título y selecciona un destino antes de guardar.')
      return
    }

    if (isDemoMode) {
      setMessage(draft ? 'Borrador preparado en la demostración.' : 'Tarea preparada en la demostración.')
      setTitle('')
      setDescription('')
      setDueAt('')
      setAttachment(null)
      return
    }

    setSaving(true)
    try {
      const record = await createTeacherAssignment({
        title,
        description,
        target: { type: target.type, id: target.id },
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        attachment: attachment || undefined,
        status: draft ? 'DRAFT' : 'PUBLISHED',
      })
      setAssignments((current) => [record, ...current])
      setMessage(draft ? 'Borrador guardado.' : 'Tarea publicada correctamente.')
      setTitle('')
      setDescription('')
      setDueAt('')
      setAttachment(null)
    } catch {
      setError('No se ha podido crear la tarea. Comprueba que el grupo o alumno siga asignado a tu cuenta y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  async function openAttachment(record: AssignmentRecord) {
    if (!record.attachment) return
    if (isDemoMode) {
      setMessage('La descarga real no está disponible en la demostración.')
      return
    }
    try {
      window.open(await getTeacherAssignmentAttachmentUrl(record), '_blank', 'noopener,noreferrer')
    } catch {
      setError('No se ha podido abrir el adjunto.')
    }
  }

  async function toggleClosed(record: AssignmentRecord) {
    if (isDemoMode) {
      setAssignments((current) => current.map((item) => item.id === record.id ? { ...item, status: item.status === 'CLOSED' ? 'PUBLISHED' : 'CLOSED' } : item))
      return
    }
    try {
      const updated = await updateTeacherAssignmentStatus(record, record.status === 'CLOSED' ? 'PUBLISHED' : 'CLOSED')
      setAssignments((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch {
      setError('No se ha podido cambiar el estado de la tarea.')
    }
  }

  async function remove(record: AssignmentRecord) {
    if (!window.confirm(`¿Eliminar "${record.title}"?`)) return
    if (isDemoMode) {
      setAssignments((current) => current.filter((item) => item.id !== record.id))
      return
    }
    try {
      await deleteTeacherAssignment(record)
      setAssignments((current) => current.filter((item) => item.id !== record.id))
      setMessage('Tarea eliminada.')
    } catch {
      setError('No se ha podido eliminar la tarea.')
    }
  }

  const noTargets = !loading && targets.length === 0

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-portal-page">
        <header className="teacher-page-heading"><div><span className="eyebrow">ACTIVIDADES</span><h2>Tareas</h2><p>Crea actividades para tus grupos o para un alumno concreto de tus grupos.</p></div><span className="status success">Ámbito protegido</span></header>
        {loading && <div className="cms-notice" role="status">Cargando tareas…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
        <div className="teacher-authoring-grid">
          <form className="panel teacher-authoring-form" onSubmit={submit}>
            <div className="panel-heading"><div><span className="eyebrow">NUEVA TAREA</span><h3>Crear actividad</h3></div></div>
            {noTargets && <PortalEmptyState compact title="Sin destinos disponibles" description="Necesitas al menos un grupo asignado o un alumno activo para crear una tarea." />}
            <label className="field-stack"><span>Destino</span><select value={targetKey} onChange={(e) => setTargetKey(e.target.value)} disabled={noTargets}>{noTargets && <option value="">Sin destinos disponibles</option>}{targets.map((target) => <option key={target.key} value={target.key}>{target.label}</option>)}</select></label>
            <label className="field-stack"><span>Título</span><input value={title} onChange={(e) => setTitle(e.target.value)} required disabled={noTargets} /></label>
            <label className="field-stack"><span>Instrucciones</span><textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} disabled={noTargets} /></label>
            <label className="field-stack"><span>Fecha límite</span><input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} disabled={noTargets} /></label>
            <label className="upload-dropzone"><input type="file" accept=".pdf,.doc,.docx,.mp3,.jpg,.jpeg,.png,.webp" onChange={chooseAttachment} disabled={noTargets} /><strong>{attachment?.name || 'Adjunto opcional'}</strong><small>Máximo 20 MB</small></label>
            <label className="teacher-check"><input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} disabled={noTargets} /><span>Guardar como borrador</span></label>
            <button className="button button-primary" type="submit" disabled={saving || noTargets}>{saving ? 'Guardando…' : draft ? 'Guardar borrador' : 'Publicar tarea'}</button>
          </form>
          <section className="panel teacher-record-list">
            <div className="panel-heading"><div><span className="eyebrow">MIS TAREAS</span><h3>{assignments.length} actividades</h3></div></div>
            <div>
              {assignments.map((record) => <article key={record.id}><span className="teacher-record-icon">T</span><div><strong>{record.title}</strong><small>{statusLabel(record.status)} · {formatDue(record.due_at)}</small></div><div className="teacher-record-actions">{record.attachment && <button type="button" onClick={() => void openAttachment(record)}>Adjunto</button>}<button type="button" onClick={() => void toggleClosed(record)}>{record.status === 'CLOSED' ? 'Reabrir' : 'Cerrar'}</button><button type="button" onClick={() => void remove(record)}>Eliminar</button></div></article>)}
              {!loading && assignments.length === 0 && <PortalEmptyState compact title="Todavía no has creado tareas" description="Las actividades que prepares aparecerán aquí con su estado y fecha límite." />}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

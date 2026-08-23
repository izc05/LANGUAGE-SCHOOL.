import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import type { AttendanceRecord, ClassDeliveryMode, ClassRecord } from '../../services/pocketbase/studentPortal'
import {
  createTeacherClass,
  listAttendanceForClass,
  listAuthorizedStudentsForClass,
  listMyTeacherClasses,
  setTeacherAttendance,
  updateTeacherClassStatus,
} from '../../services/pocketbase/teacherClasses'
import { listMyTeacherGroups, type TeacherEnrollmentRecord, type TeacherGroupRecord } from '../../services/pocketbase/teacherPortal'
import { teacherNav } from './teacherNav'

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function datetimeLocal(offsetMinutes: number): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000)
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

function statusLabel(status: ClassRecord['status']): string {
  if (status === 'COMPLETED') return 'Completada'
  if (status === 'CANCELLED') return 'Cancelada'
  return 'Programada'
}

function modeOf(record: ClassRecord): ClassDeliveryMode {
  return record.delivery_mode || 'IN_PERSON'
}

function modeLabel(mode: ClassDeliveryMode): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

function attendanceLabel(status?: AttendanceRecord['status']): string {
  if (status === 'PRESENT') return 'Presente'
  if (status === 'ABSENT') return 'Ausente'
  if (status === 'JUSTIFIED') return 'Justificada'
  return 'Sin registrar'
}

const demoGroup: TeacherGroupRecord = {
  id: 'demo-group', collectionId: '', collectionName: 'groups', created: '', updated: '', expand: {},
  name: 'Adultos B1', course: 'demo-course', teacher: 'demo-teacher', academic_year: '2026/27', schedule_text: 'Jueves 18:00', capacity: 8,
  target_level: 'B1', default_delivery_mode: 'HYBRID', status: 'ACTIVE',
}

const demoClass: ClassRecord = {
  id: 'demo-class', collectionId: '', collectionName: 'classes', created: '', updated: '',
  group: 'demo-group', teacher: 'demo-teacher', starts_at: '2026-08-13T18:00:00Z', ends_at: '2026-08-13T19:00:00Z',
  topic: 'Travel & experiences', description: 'Speaking + vocabulary', status: 'SCHEDULED', delivery_mode: 'HYBRID', location_text: 'Aula 2', online_join_url: 'https://example.com/demo-class',
  expand: { group: demoGroup },
}

const demoEnrollments: TeacherEnrollmentRecord[] = [
  {
    id: 'demo-enrollment-1', collectionId: '', collectionName: 'enrollments', created: '', updated: '',
    student: 'demo-student-1', group: 'demo-group', status: 'ACTIVE', joined_at: '', ended_at: '',
    expand: {
      group: demoGroup,
      student: { id: 'demo-student-1', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, name: 'Emma', surname: 'Rodríguez', email: 'emma@example.com', phone: '', role: 'STUDENT', status: 'ACTIVE' },
    },
  },
  {
    id: 'demo-enrollment-2', collectionId: '', collectionName: 'enrollments', created: '', updated: '',
    student: 'demo-student-2', group: 'demo-group', status: 'ACTIVE', joined_at: '', ended_at: '',
    expand: {
      group: demoGroup,
      student: { id: 'demo-student-2', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, name: 'Carlos', surname: 'Martín', email: 'carlos@example.com', phone: '', role: 'STUDENT', status: 'ACTIVE' },
    },
  },
]

export default function TeacherClassesPage() {
  const { isDemoMode } = useAuth()
  const [groups, setGroups] = useState<TeacherGroupRecord[]>(isDemoMode ? [demoGroup] : [])
  const [classes, setClasses] = useState<ClassRecord[]>(isDemoMode ? [demoClass] : [])
  const [selectedId, setSelectedId] = useState<string | null>(isDemoMode ? demoClass.id : null)
  const [enrollments, setEnrollments] = useState<TeacherEnrollmentRecord[]>(isDemoMode ? demoEnrollments : [])
  const [attendance, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [groupId, setGroupId] = useState(isDemoMode ? demoGroup.id : '')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState(datetimeLocal(60))
  const [endsAt, setEndsAt] = useState(datetimeLocal(120))
  const [deliveryMode, setDeliveryMode] = useState<ClassDeliveryMode>('IN_PERSON')
  const [locationText, setLocationText] = useState('')
  const [onlineJoinUrl, setOnlineJoinUrl] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    Promise.all([listMyTeacherGroups(), listMyTeacherClasses()])
      .then(([groupRecords, classRecords]) => {
        if (!mounted) return
        setGroups(groupRecords)
        setClasses(classRecords)
        if (groupRecords[0]) setGroupId(groupRecords[0].id)
        const next = [...classRecords]
          .filter((item) => item.status === 'SCHEDULED')
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] || classRecords[0]
        if (next) setSelectedId(next.id)
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar tu agenda. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const selectedClass = classes.find((item) => item.id === selectedId) || null

  useEffect(() => {
    if (!selectedClass || isDemoMode) return
    let mounted = true
    setDetailLoading(true)
    setError(null)
    Promise.all([listAuthorizedStudentsForClass(selectedClass), listAttendanceForClass(selectedClass)])
      .then(([studentRecords, attendanceRecords]) => {
        if (!mounted) return
        setEnrollments(studentRecords)
        setAttendanceRecords(attendanceRecords)
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar la asistencia de esta clase. Inténtalo de nuevo.') })
      .finally(() => { if (mounted) setDetailLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, selectedClass?.id])

  const orderedClasses = useMemo(() => [...classes].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()), [classes])
  const attendanceByStudent = useMemo(() => new Map(attendance.map((item) => [item.student, item])), [attendance])
  const noGroups = !loading && groups.length === 0

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (!groupId || !topic.trim()) {
      setError(noGroups ? 'Todavía no tienes grupos asignados en los que programar una clase.' : 'Selecciona un grupo y escribe el tema de la clase.')
      return
    }
    if (isDemoMode) {
      setMessage('Clase preparada en la demostración. No se ha guardado ningún cambio real.')
      return
    }
    setSaving(true)
    try {
      const record = await createTeacherClass({ groupId, startsAt, endsAt, topic, description, deliveryMode, locationText, onlineJoinUrl })
      setClasses((current) => [record, ...current])
      setSelectedId(record.id)
      setTopic('')
      setDescription('')
      setOnlineJoinUrl('')
      setMessage('Clase creada correctamente.')
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'No se ha podido crear la clase. Comprueba el grupo y el horario y vuelve a intentarlo.')
    } finally {
      setSaving(false)
    }
  }

  async function changeClassStatus(record: ClassRecord, status: ClassRecord['status']) {
    setError(null)
    setMessage(null)
    if (isDemoMode) {
      setClasses((current) => current.map((item) => item.id === record.id ? { ...item, status } : item))
      setMessage(`Clase marcada como ${statusLabel(status).toLowerCase()} en la demostración.`)
      return
    }
    try {
      const updated = await updateTeacherClassStatus(record, status)
      setClasses((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage(`Clase marcada como ${statusLabel(status).toLowerCase()}.`)
    } catch {
      setError('No se ha podido cambiar el estado de la clase.')
    }
  }

  async function registerAttendance(studentId: string, status: AttendanceRecord['status']) {
    if (!selectedClass) return
    setError(null)
    setMessage(null)
    if (isDemoMode) {
      const existing = attendanceByStudent.get(studentId)
      const next: AttendanceRecord = existing
        ? { ...existing, status }
        : { id: `demo-att-${studentId}`, collectionId: '', collectionName: 'attendance', created: '', updated: '', expand: {}, class: selectedClass.id, student: studentId, status, notes: '' }
      setAttendanceRecords((current) => [...current.filter((item) => item.student !== studentId), next])
      return
    }
    try {
      const updated = await setTeacherAttendance({ classRecord: selectedClass, studentId, status })
      setAttendanceRecords((current) => [...current.filter((item) => item.student !== studentId), updated])
    } catch (attendanceError) {
      setError(attendanceError instanceof Error ? attendanceError.message : 'No se ha podido registrar la asistencia.')
    }
  }

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-portal-page">
        <header className="teacher-page-heading">
          <div><span className="eyebrow">AGENDA DOCENTE</span><h2>Clases y asistencia</h2><p>Programa clases presenciales, online o híbridas y registra la asistencia de los alumnos con matrícula activa.</p></div>
          <div className="private-space-badge"><strong>{classes.length}</strong><span>clases registradas</span></div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando agenda…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="teacher-class-workspace">
          <section className="panel teacher-class-create">
            <div className="panel-heading"><div><span className="eyebrow">NUEVA CLASE</span><h3>Programar</h3></div></div>
            {noGroups && <PortalEmptyState compact title="Sin grupos asignados" description="Cuando Administración te asigne un grupo activo podrás programar clases desde aquí." />}
            <form onSubmit={handleCreate}>
              <label>Grupo</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} required disabled={noGroups}>
                <option value="">{noGroups ? 'Sin grupos disponibles' : 'Selecciona grupo'}</option>
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <label>Modalidad</label>
              <select value={deliveryMode} onChange={(e) => setDeliveryMode(e.target.value as ClassDeliveryMode)} disabled={noGroups}>
                <option value="IN_PERSON">Presencial</option>
                <option value="ONLINE">Online</option>
                <option value="HYBRID">Híbrida</option>
              </select>
              {deliveryMode !== 'ONLINE' && <><label>Lugar / aula</label><input value={locationText} onChange={(e) => setLocationText(e.target.value)} placeholder="Ej. Aula 2" disabled={noGroups} /></>}
              {deliveryMode !== 'IN_PERSON' && <><label>Enlace de videoclase</label><input type="url" value={onlineJoinUrl} onChange={(e) => setOnlineJoinUrl(e.target.value)} placeholder="https://meet.google.com/... (opcional)" disabled={noGroups} /><small className="muted">Si la sesión usa Google Meet, pega aquí su enlace. Si lo dejas vacío, Administración puede preparar Zoom de forma segura desde Language School.</small></>}
              <label>Tema</label>
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. Travel & experiences" required disabled={noGroups} />
              <label>Descripción</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Objetivos, material o notas de la sesión" disabled={noGroups} />
              <div className="teacher-date-grid">
                <div><label>Inicio</label><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required disabled={noGroups} /></div>
                <div><label>Fin</label><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required disabled={noGroups} /></div>
              </div>
              <button className="button button-primary button-full" type="submit" disabled={saving || noGroups}>{saving ? 'Guardando…' : 'Crear clase'}</button>
            </form>
          </section>

          <section className="panel teacher-class-agenda">
            <div className="panel-heading"><div><span className="eyebrow">MI AGENDA</span><h3>Clases</h3></div><span className="status info">{orderedClasses.length}</span></div>
            <div className="teacher-class-list">
              {orderedClasses.map((record) => (
                <button key={record.id} type="button" className={selectedId === record.id ? 'active' : ''} onClick={() => setSelectedId(record.id)}>
                  <time>{formatDateTime(record.starts_at)}</time>
                  <span><strong>{record.topic}</strong><small>{record.expand?.group?.name || 'Grupo'} · {modeLabel(modeOf(record))} · {statusLabel(record.status)}</small></span>
                  <b>→</b>
                </button>
              ))}
              {!loading && orderedClasses.length === 0 && <PortalEmptyState compact title="Todavía no hay clases programadas" description={noGroups ? 'Primero necesitas un grupo asignado por Administración.' : 'Crea tu primera clase desde el formulario y aparecerá aquí.'} />}
            </div>
          </section>
        </div>

        <section className="panel teacher-attendance-panel">
          {!selectedClass ? (
            <PortalEmptyState
              title={classes.length === 0 ? 'Sin clases para registrar asistencia' : 'Selecciona una clase'}
              description={classes.length === 0 ? 'Cuando programes una clase podrás registrar aquí la asistencia de sus alumnos.' : 'Al seleccionar una clase aparecerán los alumnos con matrícula activa en su grupo.'}
            />
          ) : <>
            <div className="teacher-class-detail-heading">
              <div>
                <span className="eyebrow">CLASE SELECCIONADA</span><h3>{selectedClass.topic}</h3>
                <p>{selectedClass.expand?.group?.name || 'Grupo'} · {formatDateTime(selectedClass.starts_at)} · {statusLabel(selectedClass.status)}</p>
                <div className="class-delivery-summary">
                  <span className={`class-mode class-mode-${modeOf(selectedClass).toLowerCase()}`}>{modeLabel(modeOf(selectedClass))}</span>
                  {selectedClass.location_text && <span>📍 {selectedClass.location_text}</span>}
                  {modeOf(selectedClass) !== 'IN_PERSON' && selectedClass.online_join_url && <a href={selectedClass.online_join_url} target="_blank" rel="noreferrer">Abrir videoclase ↗</a>}
                  {modeOf(selectedClass) !== 'IN_PERSON' && !selectedClass.online_join_url && <span>Acceso online pendiente</span>}
                </div>
              </div>
              <div className="teacher-class-status-actions">
                {selectedClass.status !== 'SCHEDULED' && <button type="button" onClick={() => void changeClassStatus(selectedClass, 'SCHEDULED')}>Reabrir</button>}
                {selectedClass.status !== 'COMPLETED' && <button type="button" onClick={() => void changeClassStatus(selectedClass, 'COMPLETED')}>Completar</button>}
                {selectedClass.status !== 'CANCELLED' && <button type="button" onClick={() => void changeClassStatus(selectedClass, 'CANCELLED')}>Cancelar</button>}
              </div>
            </div>

            {detailLoading ? <div className="cms-notice" role="status">Cargando alumnos y asistencia…</div> : <div className="teacher-attendance-list">
              {enrollments.map((enrollment) => {
                const student = enrollment.expand?.student
                const current = attendanceByStudent.get(enrollment.student)
                const name = student ? [student.name, student.surname].filter(Boolean).join(' ') : 'Alumno'
                return <article key={enrollment.id}>
                  <span className="avatar-mini">{name.charAt(0).toUpperCase()}</span>
                  <div><strong>{name}</strong><small>{student?.email || 'Alumno asignado'} · {attendanceLabel(current?.status)}</small></div>
                  <div className="teacher-attendance-actions">
                    <button className={current?.status === 'PRESENT' ? 'active' : ''} type="button" onClick={() => void registerAttendance(enrollment.student, 'PRESENT')}>Presente</button>
                    <button className={current?.status === 'ABSENT' ? 'active' : ''} type="button" onClick={() => void registerAttendance(enrollment.student, 'ABSENT')}>Ausente</button>
                    <button className={current?.status === 'JUSTIFIED' ? 'active' : ''} type="button" onClick={() => void registerAttendance(enrollment.student, 'JUSTIFIED')}>Justificada</button>
                  </div>
                </article>
              })}
              {enrollments.length === 0 && <PortalEmptyState compact title="Sin alumnos activos en este grupo" description="La asistencia se habilitará cuando el grupo tenga alumnos con matrícula activa." />}
            </div>}
          </>}
        </section>
      </div>
    </DashboardShell>
  )
}

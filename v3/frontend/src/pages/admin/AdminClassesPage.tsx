import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createAdminClass,
  listAdminAttendance,
  listAdminClasses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminUsers,
  updateAdminClass,
  upsertAdminAttendance,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import type { AttendanceRecord, ClassRecord, CourseRecord } from '../../services/pocketbase/studentPortal'
import type { AppUser } from '../../services/pocketbase/types'
import { adminNav } from './adminNav'

const demoTeacher: AppUser = { id: 'demo-t', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'laura@example.com', name: 'Laura', surname: 'García', role: 'TEACHER', status: 'ACTIVE', phone: '' }
const demoStudent: AppUser = { id: 'demo-s', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'emma@example.com', name: 'Emma', surname: 'Martín', role: 'STUDENT', status: 'ACTIVE', phone: '' }
const demoCourse: CourseRecord = { id: 'demo-c', collectionId: '', collectionName: 'courses', created: '', updated: '', expand: {}, title: 'Adultos', slug: 'adultos', level: 'B1', description: '', status: 'ACTIVE', public_visible: true }
const demoGroup: AdminGroupRecord = { id: 'demo-g', collectionId: '', collectionName: 'groups', created: '', updated: '', name: 'Adultos B1', course: 'demo-c', teacher: 'demo-t', academic_year: '2026/27', schedule_text: 'Martes y jueves · 18:00', capacity: 8, target_level: 'B1', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE', expand: { course: demoCourse, teacher: demoTeacher } }
const demoClass: ClassRecord = { id: 'demo-class', collectionId: '', collectionName: 'classes', created: '', updated: '', group: 'demo-g', teacher: 'demo-t', starts_at: '2026-08-13T18:00:00+02:00', ends_at: '2026-08-13T19:00:00+02:00', topic: 'Travel & experiences', description: 'Speaking y vocabulary', status: 'SCHEDULED', expand: { group: demoGroup } }
const demoEnrollment: AdminEnrollmentRecord = { id: 'demo-e', collectionId: '', collectionName: 'enrollments', created: '', updated: '', student: 'demo-s', group: 'demo-g', status: 'ACTIVE', joined_at: '', ended_at: '', expand: { student: demoStudent, group: demoGroup } }

function startOfWeek(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  const day = result.getDay()
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1))
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function datetimeLocal(offsetMinutes: number): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000)
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

function toDatetimeLocal(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return shifted.toISOString().slice(0, 16)
}

function userName(user?: AppUser | null): string {
  if (!user) return 'Sin profesor'
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email
}

function classStatusLabel(status: ClassRecord['status']): string {
  if (status === 'COMPLETED') return 'Completada'
  if (status === 'CANCELLED') return 'Cancelada'
  return 'Programada'
}

function attendanceLabel(status?: AttendanceRecord['status']): string {
  if (status === 'PRESENT') return 'Presente'
  if (status === 'ABSENT') return 'Ausente'
  if (status === 'JUSTIFIED') return 'Justificada'
  return 'Sin registrar'
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function AdminClassesPage() {
  const { isDemoMode } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedGroupId = searchParams.get('grupo') || ''
  const requestedClassId = searchParams.get('clase') || ''
  const [classes, setClasses] = useState<ClassRecord[]>(isDemoMode ? [demoClass] : [])
  const [groups, setGroups] = useState<AdminGroupRecord[]>(isDemoMode ? [demoGroup] : [])
  const [teachers, setTeachers] = useState<AppUser[]>(isDemoMode ? [demoTeacher] : [])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>(isDemoMode ? [demoEnrollment] : [])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()))
  const [teacherFilter, setTeacherFilter] = useState('ALL')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [selectedClassId, setSelectedClassId] = useState<string | null>(isDemoMode ? demoClass.id : null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(!isDemoMode)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [newGroupId, setNewGroupId] = useState(isDemoMode ? demoGroup.id : '')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [startsAt, setStartsAt] = useState(datetimeLocal(60))
  const [endsAt, setEndsAt] = useState(datetimeLocal(120))
  const [editGroupId, setEditGroupId] = useState('')
  const [editTopic, setEditTopic] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStartsAt, setEditStartsAt] = useState('')
  const [editEndsAt, setEditEndsAt] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    Promise.all([listAdminClasses(), listAdminGroups(), listAdminUsers('TEACHER'), listAdminEnrollments()])
      .then(([classRecords, groupRecords, teacherRecords, enrollmentRecords]) => {
        if (!mounted) return
        setClasses(classRecords)
        setGroups(groupRecords)
        setTeachers(teacherRecords)
        setEnrollments(enrollmentRecords)

        const requestedGroup = requestedGroupId ? groupRecords.find((group) => group.id === requestedGroupId) : undefined
        const firstActiveGroup = requestedGroup || groupRecords.find((group) => group.status === 'ACTIVE')
        if (firstActiveGroup) setNewGroupId(firstActiveGroup.id)
        setGroupFilter(requestedGroup ? requestedGroup.id : 'ALL')

        const requestedClass = requestedClassId
          ? classRecords.find((record) => record.id === requestedClassId && (!requestedGroup || record.group === requestedGroup.id))
          : undefined
        const candidateClasses = requestedGroup ? classRecords.filter((record) => record.group === requestedGroup.id) : classRecords
        const nextClass = requestedClass || [...candidateClasses]
          .filter((record) => record.status === 'SCHEDULED' && new Date(record.starts_at).getTime() >= Date.now())
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0] || candidateClasses[0]
        if (nextClass) {
          setSelectedClassId(nextClass.id)
          setWeekAnchor(startOfWeek(new Date(nextClass.starts_at)))
        } else {
          setSelectedClassId(null)
        }
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar el calendario académico. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, requestedClassId, requestedGroupId])

  const selectedClass = classes.find((record) => record.id === selectedClassId) || null

  useEffect(() => {
    if (!selectedClass || isDemoMode) return
    let mounted = true
    setDetailLoading(true)
    listAdminAttendance(selectedClass.id)
      .then((records) => { if (mounted) setAttendance(records) })
      .catch(() => { if (mounted) setError('No se ha podido cargar la asistencia de la clase.') })
      .finally(() => { if (mounted) setDetailLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, selectedClass?.id])

  const activeGroups = useMemo(() => groups.filter((group) => group.status === 'ACTIVE'), [groups])
  const filteredClasses = useMemo(() => classes.filter((record) => {
    const matchesTeacher = teacherFilter === 'ALL' || record.teacher === teacherFilter
    const matchesGroup = groupFilter === 'ALL' || record.group === groupFilter
    return matchesTeacher && matchesGroup
  }), [classes, groupFilter, teacherFilter])

  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor])
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart])
  const weekClasses = useMemo(() => filteredClasses.filter((record) => {
    const date = new Date(record.starts_at)
    return date >= weekStart && date < weekEnd
  }), [filteredClasses, weekEnd, weekStart])

  const today = new Date()
  const todayClasses = filteredClasses.filter((record) => sameLocalDay(new Date(record.starts_at), today))
  const scheduledCount = filteredClasses.filter((record) => record.status === 'SCHEDULED').length
  const weekHours = weekClasses.reduce((sum, record) => {
    const duration = new Date(record.ends_at).getTime() - new Date(record.starts_at).getTime()
    return sum + Math.max(0, duration / 3_600_000)
  }, 0)

  const selectedGroup = selectedClass ? groups.find((group) => group.id === selectedClass.group) : null
  const selectedTeacher = selectedClass ? teachers.find((teacher) => teacher.id === selectedClass.teacher) : null
  const classEnrollments = useMemo(() => selectedClass
    ? enrollments.filter((record) => record.group === selectedClass.group && record.status === 'ACTIVE')
    : [], [enrollments, selectedClass])
  const attendanceByStudent = useMemo(() => new Map(attendance.map((record) => [record.student, record])), [attendance])

  function groupForClass(record: ClassRecord): AdminGroupRecord | undefined {
    return groups.find((group) => group.id === record.group)
  }

  function teacherForClass(record: ClassRecord): AppUser | undefined {
    return teachers.find((teacher) => teacher.id === record.teacher)
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const formData = new FormData(event.currentTarget)
    const submittedStartsAt = String(formData.get('starts_at') || startsAt)
    const submittedEndsAt = String(formData.get('ends_at') || endsAt)
    const group = activeGroups.find((record) => record.id === newGroupId)
    if (!group) {
      setError(activeGroups.length === 0 ? 'Necesitas al menos un grupo activo antes de programar una clase.' : 'Selecciona un grupo válido.')
      return
    }
    if (!topic.trim()) {
      setError('Escribe el tema de la clase.')
      return
    }
    if (Number.isNaN(new Date(submittedStartsAt).getTime()) || Number.isNaN(new Date(submittedEndsAt).getTime()) || new Date(submittedEndsAt) <= new Date(submittedStartsAt)) {
      setError('La fecha final debe ser posterior al inicio.')
      return
    }
    if (isDemoMode) {
      setMessage('Clase preparada en la demostración. No se ha guardado ningún cambio real.')
      return
    }
    setSaving(true)
    try {
      const record = await createAdminClass({ groupId: group.id, teacherId: group.teacher, startsAt: submittedStartsAt, endsAt: submittedEndsAt, topic, description })
      setClasses((current) => [record, ...current])
      setSelectedClassId(record.id)
      setWeekAnchor(startOfWeek(new Date(record.starts_at)))
      setTopic('')
      setDescription('')
      setShowCreate(false)
      setMessage('Clase programada correctamente.')
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'No se ha podido programar la clase.')
    } finally {
      setSaving(false)
    }
  }

  async function changeClassStatus(record: ClassRecord, status: ClassRecord['status']) {
    setError(null)
    setMessage(null)
    if (status === 'CANCELLED' && !window.confirm(`¿Quieres cancelar la clase "${record.topic}"?`)) return
    if (isDemoMode) {
      setClasses((current) => current.map((item) => item.id === record.id ? { ...item, status } : item))
      setMessage(`Clase marcada como ${classStatusLabel(status).toLowerCase()} en la demostración.`)
      return
    }
    try {
      const updated = await updateAdminClass(record, { status })
      setClasses((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage(`Clase marcada como ${classStatusLabel(status).toLowerCase()}.`)
    } catch {
      setError('No se ha podido actualizar el estado de la clase.')
    }
  }

  function openClassEdit() {
    if (!selectedClass) return
    setEditGroupId(selectedClass.group)
    setEditTopic(selectedClass.topic)
    setEditDescription(selectedClass.description || '')
    setEditStartsAt(toDatetimeLocal(selectedClass.starts_at))
    setEditEndsAt(toDatetimeLocal(selectedClass.ends_at))
    setShowEdit(true)
  }

  async function saveClassEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedClass) return
    const group = activeGroups.find((item) => item.id === editGroupId)
    if (!group) { setError('Selecciona un grupo activo para la clase.'); return }
    if (!editTopic.trim() || !editStartsAt || !editEndsAt || new Date(editEndsAt) <= new Date(editStartsAt)) { setError('Revisa tema, inicio y fin de la clase.'); return }
    if (!window.confirm(`¿Guardar los cambios de la clase "${selectedClass.topic}"?`)) return
    setError(null); setMessage(null)
    if (isDemoMode) { setShowEdit(false); setMessage('Edición preparada en la demostración.'); return }
    setSaving(true)
    try {
      const updated = await updateAdminClass(selectedClass, { group: group.id, teacher: group.teacher, topic: editTopic.trim(), description: editDescription.trim(), starts_at: new Date(editStartsAt).toISOString(), ends_at: new Date(editEndsAt).toISOString() })
      setClasses((current) => current.map((item) => item.id === updated.id ? updated : item))
      setShowEdit(false)
      setMessage('Clase actualizada. El profesor se ha ajustado al profesor asignado al grupo.')
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'No se ha podido actualizar la clase.')
    } finally { setSaving(false) }
  }

  async function setStudentAttendance(studentId: string, status: AttendanceRecord['status']) {
    if (!selectedClass) return
    setError(null)
    setMessage(null)
    if (isDemoMode) {
      const existing = attendanceByStudent.get(studentId)
      const next: AttendanceRecord = existing
        ? { ...existing, status }
        : { id: `demo-att-${studentId}`, collectionId: '', collectionName: 'attendance', created: '', updated: '', expand: {}, class: selectedClass.id, student: studentId, status, notes: '' }
      setAttendance((current) => [...current.filter((item) => item.student !== studentId), next])
      return
    }
    try {
      const updated = await upsertAdminAttendance({ classId: selectedClass.id, studentId, status })
      setAttendance((current) => [...current.filter((item) => item.student !== studentId), updated])
    } catch {
      setError('No se ha podido actualizar la asistencia.')
    }
  }

  const filtersActive = teacherFilter !== 'ALL' || groupFilter !== 'ALL'

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">PLATAFORMA · CLASES</span>
            <h2>Agenda y asistencia global</h2>
            <p>Controla todas las clases de la academia, filtra por profesor o grupo y revisa la asistencia desde una única pantalla.</p>
          </div>
          <button className="button button-primary" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Cerrar formulario' : '+ Programar clase'}</button>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando calendario…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {showCreate && <section className="panel admin-inline-create">
          <div className="panel-heading"><div><span className="eyebrow">NUEVA CLASE</span><h3>Programar sesión</h3></div><span className="status info">Profesor según grupo</span></div>
          {activeGroups.length === 0 && !loading && <PortalEmptyState compact title="Sin grupos activos" description="Crea o reactiva un grupo antes de programar una clase." />}
          <form className="admin-create-grid" onSubmit={handleCreate}>
            <div><label>Grupo</label><select value={newGroupId} onChange={(e) => setNewGroupId(e.target.value)} required disabled={activeGroups.length === 0}><option value="">{activeGroups.length === 0 ? 'Sin grupos disponibles' : 'Selecciona grupo'}</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name} · {userName(group.expand?.teacher || teachers.find((teacher) => teacher.id === group.teacher))}</option>)}</select></div>
            <div><label>Tema</label><input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. Past perfect · review" required disabled={activeGroups.length === 0} /></div>
            <div><label>Inicio</label><input name="starts_at" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required disabled={activeGroups.length === 0} /></div>
            <div><label>Fin</label><input name="ends_at" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required disabled={activeGroups.length === 0} /></div>
            <div className="admin-create-wide"><label>Descripción</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} disabled={activeGroups.length === 0} /></div>
            <div className="admin-create-action"><button className="button button-primary" type="submit" disabled={saving || activeGroups.length === 0}>{saving ? 'Guardando…' : 'Programar clase'}</button></div>
          </form>
        </section>}

        <section className="metric-grid">
          <article><span>Esta semana</span><strong>{weekClasses.length}</strong><small>Con filtros actuales</small></article>
          <article><span>Hoy</span><strong>{todayClasses.length}</strong><small>Sesiones del día</small></article>
          <article><span>Programadas</span><strong>{scheduledCount}</strong><small>Pendientes de realizar</small></article>
          <article><span>Horas semana</span><strong>{weekHours.toFixed(1)} h</strong><small>Carga planificada</small></article>
        </section>

        <section className="panel admin-calendar-filters">
          <div><label>Profesor</label><select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}><option value="ALL">Todos</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{userName(teacher)}</option>)}</select></div>
          <div><label>Grupo</label><select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}><option value="ALL">Todos</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
          <button type="button" onClick={() => { setTeacherFilter('ALL'); setGroupFilter('ALL') }} disabled={!filtersActive}>Limpiar filtros</button>
        </section>

        <section className="panel calendar-admin-panel admin-real-calendar">
          <div className="panel-heading">
            <div><span className="eyebrow">SEMANA</span><h3>{new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long' }).format(weekStart)} – {new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long' }).format(addDays(weekEnd, -1))}</h3></div>
            <div className="calendar-actions"><button type="button" onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}>←</button><button type="button" onClick={() => setWeekAnchor(startOfWeek(new Date()))}>Hoy</button><button type="button" onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}>→</button></div>
          </div>

          {classes.length === 0 && !loading ? <PortalEmptyState title="Todavía no hay clases programadas" description="Programa la primera sesión para empezar a utilizar el calendario y la asistencia." /> : <div className="week-calendar">
            {weekDays.map((day) => {
              const dayClasses = weekClasses
                .filter((record) => sameLocalDay(new Date(record.starts_at), day))
                .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
              return <div className="calendar-day" key={day.toISOString()}>
                <div className="calendar-day-heading"><span>{new Intl.DateTimeFormat('es-ES', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong></div>
                <div className="calendar-day-body">
                  {dayClasses.map((record) => {
                    const group = groupForClass(record)
                    const teacher = teacherForClass(record)
                    return <button className={`calendar-class ${selectedClassId === record.id ? 'selected' : ''}`} type="button" key={record.id} onClick={() => setSelectedClassId(record.id)}>
                      <span>{formatTime(record.starts_at)}</span>
                      <strong>{record.topic}</strong>
                      <small>{group?.name || 'Grupo'} · {userName(teacher)}</small>
                      <small>{classStatusLabel(record.status)}</small>
                    </button>
                  })}
                  {dayClasses.length === 0 && <span className="admin-calendar-empty">Sin clases</span>}
                </div>
              </div>
            })}
          </div>}
        </section>

        <section className="panel admin-class-attendance">
          {!selectedClass ? <PortalEmptyState title={classes.length === 0 ? 'Sin clases para revisar' : 'Selecciona una clase'} description={classes.length === 0 ? 'La asistencia se habilitará cuando exista al menos una clase.' : 'Haz clic en una sesión del calendario para revisar alumnos y asistencia.'} /> : <>
            <div className="admin-class-detail-heading">
              <div><span className="eyebrow">CLASE SELECCIONADA</span><h3>{selectedClass.topic}</h3><p>{selectedGroup?.name || 'Grupo'} · {userName(selectedTeacher)} · {formatTime(selectedClass.starts_at)}–{formatTime(selectedClass.ends_at)} · {classStatusLabel(selectedClass.status)}</p></div>
              <div className="admin-class-status-actions">
                <button type="button" onClick={openClassEdit}>Editar clase</button>
                {selectedClass.status !== 'SCHEDULED' && <button type="button" onClick={() => void changeClassStatus(selectedClass, 'SCHEDULED')}>Reabrir</button>}
                {selectedClass.status !== 'COMPLETED' && <button type="button" onClick={() => void changeClassStatus(selectedClass, 'COMPLETED')}>Completar</button>}
                {selectedClass.status !== 'CANCELLED' && <button type="button" onClick={() => void changeClassStatus(selectedClass, 'CANCELLED')}>Cancelar</button>}
              </div>
            </div>
            {showEdit && <form className="admin-create-grid class-edit-form" onSubmit={saveClassEdit}>
              <div><label>Grupo</label><select value={editGroupId} onChange={(event) => setEditGroupId(event.target.value)} required>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name} · {userName(teachers.find((teacher) => teacher.id === group.teacher))}</option>)}</select></div>
              <div><label>Tema</label><input value={editTopic} onChange={(event) => setEditTopic(event.target.value)} required /></div>
              <div><label>Inicio</label><input type="datetime-local" value={editStartsAt} onChange={(event) => setEditStartsAt(event.target.value)} required /></div>
              <div><label>Fin</label><input type="datetime-local" value={editEndsAt} onChange={(event) => setEditEndsAt(event.target.value)} required /></div>
              <div className="admin-create-wide"><label>Descripción</label><textarea rows={3} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /></div>
              <p className="muted admin-create-wide">Al cambiar el grupo, la clase adopta automáticamente el profesor asignado a ese grupo. La asistencia existente se conserva y debe revisarse si el grupo cambia.</p>
              <div className="admin-create-action"><button type="button" onClick={() => setShowEdit(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
            </form>}

            {detailLoading ? <div className="cms-notice" role="status">Cargando asistencia…</div> : <div className="admin-attendance-list">
              {classEnrollments.map((enrollment) => {
                const student = enrollment.expand?.student
                const current = attendanceByStudent.get(enrollment.student)
                return <article key={enrollment.id}>
                  <span className="avatar-mini">{userName(student).charAt(0).toUpperCase()}</span>
                  <div><strong>{userName(student)}</strong><small>{student?.email || ''} · {attendanceLabel(current?.status)}</small></div>
                  <div className="admin-attendance-actions">
                    <button className={current?.status === 'PRESENT' ? 'active' : ''} type="button" onClick={() => void setStudentAttendance(enrollment.student, 'PRESENT')}>Presente</button>
                    <button className={current?.status === 'ABSENT' ? 'active' : ''} type="button" onClick={() => void setStudentAttendance(enrollment.student, 'ABSENT')}>Ausente</button>
                    <button className={current?.status === 'JUSTIFIED' ? 'active' : ''} type="button" onClick={() => void setStudentAttendance(enrollment.student, 'JUSTIFIED')}>Justificada</button>
                  </div>
                </article>
              })}
              {classEnrollments.length === 0 && <PortalEmptyState compact title="Sin alumnos activos para esta clase" description="La asistencia aparecerá cuando el grupo tenga matrículas activas." />}
            </div>}
          </>}
        </section>
      </div>
    </DashboardShell>
  )
}

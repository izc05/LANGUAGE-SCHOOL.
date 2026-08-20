import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import MonthlyClassCalendar, { monthForDateKey, todayKey } from '../../components/MonthlyClassCalendar'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { listAdminClasses, listAdminGroups, listAdminUsers, type AdminGroupRecord } from '../../services/pocketbase/adminAcademic'
import type { ClassRecord, CourseRecord } from '../../services/pocketbase/studentPortal'
import type { AppUser } from '../../services/pocketbase/types'
import { adminNav } from './adminNav'

const demoTeacher: AppUser = { id: 'agenda-demo-teacher', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'laura@example.com', name: 'Laura', surname: 'García', role: 'TEACHER', status: 'ACTIVE', phone: '' }
const demoCourse: CourseRecord = { id: 'agenda-demo-course', collectionId: '', collectionName: 'courses', created: '', updated: '', expand: {}, title: 'Adultos', slug: 'adultos', level: 'B1', description: '', status: 'ACTIVE', public_visible: true }
const demoGroup: AdminGroupRecord = { id: 'agenda-demo-group', collectionId: '', collectionName: 'groups', created: '', updated: '', name: 'Adultos B1', course: demoCourse.id, teacher: demoTeacher.id, academic_year: '2026/27', schedule_text: 'Martes y jueves · 18:00', capacity: 10, target_level: 'B1', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE', expand: { course: demoCourse, teacher: demoTeacher } }

function createDemoClasses(): ClassRecord[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const at = (day: number, hour: number) => new Date(year, month, day, hour, 0).toISOString()
  return [5, 7, 12, 14, 19, 21, 26, 28].map((day, index) => ({
    id: `agenda-admin-demo-${day}`, collectionId: '', collectionName: 'classes', created: '', updated: '',
    group: demoGroup.id, teacher: demoTeacher.id, starts_at: at(day, 18), ends_at: at(day, 19),
    topic: index % 2 ? 'Speaking & listening' : 'Grammar & vocabulary', description: '',
    status: index === 0 ? 'COMPLETED' : 'SCHEDULED', delivery_mode: index % 3 === 0 ? 'HYBRID' : 'IN_PERSON', location_text: 'Aula 2',
    expand: { group: demoGroup },
  }))
}

function keyForClass(record: ClassRecord): string {
  const date = new Date(record.starts_at)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function dayLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)
  const label = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function timeLabel(record: ClassRecord): string {
  const format = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })
  return `${format.format(new Date(record.starts_at))}–${format.format(new Date(record.ends_at))}`
}

function statusLabel(record: ClassRecord): string {
  if (record.status === 'COMPLETED') return 'Completada'
  if (record.status === 'CANCELLED') return 'Cancelada'
  return 'Programada'
}

function teacherName(user?: AppUser): string {
  return user ? [user.name, user.surname].filter(Boolean).join(' ') || user.email : 'Profesor'
}

export default function AdminAgendaPage() {
  const { isDemoMode } = useAuth()
  const [classes, setClasses] = useState<ClassRecord[]>(isDemoMode ? createDemoClasses() : [])
  const [groups, setGroups] = useState<AdminGroupRecord[]>(isDemoMode ? [demoGroup] : [])
  const [teachers, setTeachers] = useState<AppUser[]>(isDemoMode ? [demoTeacher] : [])
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [month, setMonth] = useState(monthForDateKey(todayKey()))
  const [teacherFilter, setTeacherFilter] = useState('ALL')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | ClassRecord['status']>('ALL')
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    Promise.all([listAdminClasses(750), listAdminGroups(), listAdminUsers('TEACHER')])
      .then(([classRecords, groupRecords, teacherRecords]) => {
        if (!mounted) return
        setClasses(classRecords)
        setGroups(groupRecords)
        setTeachers(teacherRecords)
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar la agenda global de la academia.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const filteredClasses = useMemo(() => classes.filter((record) => {
    const teacherMatches = teacherFilter === 'ALL' || record.teacher === teacherFilter
    const groupMatches = groupFilter === 'ALL' || record.group === groupFilter
    const statusMatches = statusFilter === 'ALL' || record.status === statusFilter
    return teacherMatches && groupMatches && statusMatches
  }), [classes, groupFilter, statusFilter, teacherFilter])

  const selectedClasses = useMemo(
    () => filteredClasses.filter((record) => keyForClass(record) === selectedDate).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [filteredClasses, selectedDate],
  )

  const monthClasses = useMemo(() => filteredClasses.filter((record) => {
    const date = new Date(record.starts_at)
    return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
  }), [filteredClasses, month])

  const groupName = (id: string) => groups.find((group) => group.id === id)?.name || 'Grupo'
  const teacherFor = (id: string) => teachers.find((teacher) => teacher.id === id)

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page agenda-page admin-agenda-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">ACADEMIA · CALENDARIO</span>
            <h2>Agenda mensual</h2>
            <p>Ve todos los días del mes y detecta rápidamente dónde hay clases, por profesor, grupo y estado.</p>
          </div>
          <div className="private-space-badge"><strong>{monthClasses.length}</strong><span>clases este mes</span></div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando agenda…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="admin-agenda-filters" aria-label="Filtros de agenda">
          <label>Profesor
            <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
              <option value="ALL">Todos los profesores</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacherName(teacher)}</option>)}
            </select>
          </label>
          <label>Grupo
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
              <option value="ALL">Todos los grupos</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
          <label>Estado
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="ALL">Todos los estados</option>
              <option value="SCHEDULED">Programadas</option>
              <option value="COMPLETED">Completadas</option>
              <option value="CANCELLED">Canceladas</option>
            </select>
          </label>
        </section>

        <MonthlyClassCalendar classes={filteredClasses} month={month} selectedDate={selectedDate} onMonthChange={setMonth} onSelectDate={setSelectedDate} />

        <section className="agenda-day-panel panel">
          <div className="panel-heading">
            <div><span className="eyebrow">DÍA SELECCIONADO</span><h3>{dayLabel(selectedDate)}</h3></div>
            <span className="status info">{selectedClasses.length}</span>
          </div>
          {selectedClasses.length ? (
            <div className="agenda-class-list">
              {selectedClasses.map((record) => (
                <article className="agenda-class-card" key={record.id}>
                  <time className="agenda-class-time">{timeLabel(record)}</time>
                  <div className="agenda-class-copy">
                    <strong>{record.topic}</strong>
                    <small>{groupName(record.group)} · {teacherName(teacherFor(record.teacher))}</small>
                  </div>
                  <span className={`agenda-class-status ${record.status.toLowerCase()}`}>{statusLabel(record)}</span>
                </article>
              ))}
            </div>
          ) : <PortalEmptyState compact title="Sin clases este día" description="Prueba otro día o cambia los filtros de profesor, grupo o estado." />}
        </section>
      </div>
    </DashboardShell>
  )
}

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createAdminStudent,
  listAdminClasses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminUsers,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import { getPlacementAdminOverview, type PlacementAdminStudentLevel } from '../../services/pocketbase/placementAdmin'
import type { AppUser } from '../../services/pocketbase/types'
import type { ClassDeliveryMode, ClassRecord } from '../../services/pocketbase/studentPortal'
import { adminNav } from './adminNav'

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE'
type ModeFilter = 'ALL' | ClassDeliveryMode

type StudentRow = {
  user: AppUser
  enrollment?: AdminEnrollmentRecord
  group?: AdminGroupRecord
  level: string
  levelSource: PlacementAdminStudentLevel['currentLevelSource']
  teacherName: string
  nextClass?: ClassRecord
  deliveryModes: Set<ClassDeliveryMode>
}

const demoUsers = [
  { id: 'demo-1', name: 'Emma', surname: 'Martín', email: 'emma@example.com', phone: '600 123 456', role: 'STUDENT', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
  { id: 'demo-2', name: 'Daniel', surname: 'López', email: 'daniel@example.com', phone: '', role: 'STUDENT', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
] as AppUser[]

const demoLevels: PlacementAdminStudentLevel[] = [
  { studentId: 'demo-1', studentName: 'Emma Martín', email: 'emma@example.com', status: 'ACTIVE', currentLevel: 'B1', currentLevelSource: 'VALIDATED', latestAttempt: null, latestAssessment: null, attemptCount: 2, assessmentCount: 1 },
]

function fullName(user: AppUser): string {
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email
}

function initials(user: AppUser): string {
  return `${user.name?.charAt(0) || ''}${user.surname?.charAt(0) || ''}`.toUpperCase() || 'AL'
}

function modeLabel(mode: ClassDeliveryMode): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

function sourceLabel(source: PlacementAdminStudentLevel['currentLevelSource']): string {
  if (source === 'VALIDATED') return 'validado'
  if (source === 'AUTOMATIC') return 'estimado'
  return 'sin evaluar'
}

function nextClassLabel(record?: ClassRecord): string {
  if (!record) return 'Sin programar'
  const date = new Date(record.starts_at)
  if (Number.isNaN(date.getTime())) return 'Sin programar'
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function AdminStudentsPhase14Page() {
  const { isDemoMode } = useAuth()
  const [users, setUsers] = useState<AppUser[]>(isDemoMode ? demoUsers : [])
  const [teachers, setTeachers] = useState<AppUser[]>([])
  const [groups, setGroups] = useState<AdminGroupRecord[]>([])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [levels, setLevels] = useState<PlacementAdminStudentLevel[]>(isDemoMode ? demoLevels : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [courseFilter, setCourseFilter] = useState('ALL')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [levelFilter, setLevelFilter] = useState('ALL')
  const [teacherFilter, setTeacherFilter] = useState('ALL')
  const [modeFilter, setModeFilter] = useState<ModeFilter>('ALL')

  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    Promise.all([listAdminUsers('STUDENT'), listAdminUsers('TEACHER'), listAdminGroups(), listAdminEnrollments(), listAdminClasses(), getPlacementAdminOverview()])
      .then(([studentUsers, teacherUsers, groupRecords, enrollmentRecords, classRecords, placement]) => {
        if (!mounted) return
        setUsers(studentUsers); setTeachers(teacherUsers); setGroups(groupRecords); setEnrollments(enrollmentRecords); setClasses(classRecords); setLevels(placement.studentLevels)
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar el directorio de alumnos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const rows = useMemo<StudentRow[]>(() => users.map((user) => {
    const enrollment = enrollments.find((item) => item.student === user.id && item.status === 'ACTIVE')
    const group = enrollment ? groups.find((item) => item.id === enrollment.group) || enrollment.expand?.group as AdminGroupRecord | undefined : undefined
    const levelSummary = levels.find((item) => item.studentId === user.id)
    const teacher = teachers.find((item) => item.id === group?.teacher) || group?.expand?.teacher
    const groupClasses = group ? classes.filter((item) => item.group === group.id) : []
    const nextClass = groupClasses.filter((item) => item.status === 'SCHEDULED' && new Date(item.starts_at).getTime() >= Date.now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
    const deliveryModes = new Set(groupClasses.map((item) => item.delivery_mode).filter((value): value is ClassDeliveryMode => value === 'IN_PERSON' || value === 'ONLINE' || value === 'HYBRID'))
    return {
      user,
      enrollment,
      group,
      level: levelSummary?.currentLevel || '—',
      levelSource: levelSummary?.currentLevelSource || 'NONE',
      teacherName: teacher ? fullName(teacher) : 'Sin profesor',
      nextClass,
      deliveryModes,
    }
  }), [classes, enrollments, groups, levels, teachers, users])

  const courses = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>()
    groups.forEach((group) => { if (group.expand?.course) map.set(group.expand.course.id, { id: group.expand.course.id, title: group.expand.course.title }) })
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title, 'es'))
  }, [groups])

  const levelOptions = useMemo(() => [...new Set(rows.map((row) => row.level).filter((value) => value !== '—'))].sort(), [rows])

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows.filter((row) => {
      const course = row.group?.expand?.course
      const text = `${fullName(row.user)} ${row.user.email} ${row.level} ${row.group?.name || ''} ${course?.title || ''} ${row.teacherName}`.toLowerCase()
      const statusOk = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? row.user.status === 'ACTIVE' : row.user.status !== 'ACTIVE')
      const courseOk = courseFilter === 'ALL' || course?.id === courseFilter
      const groupOk = groupFilter === 'ALL' || row.group?.id === groupFilter
      const levelOk = levelFilter === 'ALL' || row.level === levelFilter
      const teacherOk = teacherFilter === 'ALL' || row.group?.teacher === teacherFilter
      const modeOk = modeFilter === 'ALL' || row.deliveryModes.has(modeFilter)
      return (!normalized || text.includes(normalized)) && statusOk && courseOk && groupOk && levelOk && teacherOk && modeOk
    })
  }, [courseFilter, groupFilter, levelFilter, modeFilter, query, rows, statusFilter, teacherFilter])

  async function createStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null); setMessage(null)
    if (isDemoMode) { setMessage('Alta preparada en la demostración.'); setShowCreate(false); return }
    setSaving(true)
    try {
      const created = await createAdminStudent({ email, password, name, surname, phone, birthDate, guardianName, guardianPhone })
      setUsers((current) => [...current, created.user].sort((a, b) => fullName(a).localeCompare(fullName(b), 'es')))
      setName(''); setSurname(''); setEmail(''); setPhone(''); setPassword(''); setBirthDate(''); setGuardianName(''); setGuardianPhone(''); setShowCreate(false)
      setMessage('Alumno creado. Abre su ficha para completar matrícula, notas privadas y seguimiento.')
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'No se ha podido crear el alumno.')
    } finally { setSaving(false) }
  }

  const activeCount = rows.filter((row) => row.user.status === 'ACTIVE').length
  const enrolledCount = rows.filter((row) => row.enrollment).length
  const evaluatedCount = rows.filter((row) => row.level !== '—').length

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page admin-student-directory-phase14">
        <header className="cms-page-heading phase14-pink-heading">
          <div><span className="eyebrow">PLATAFORMA · ALUMNOS</span><h2>Directorio de alumnos</h2><p>Busca y filtra primero. La ficha completa se abre en una pantalla propia para que los datos académicos, personales y económicos se lean con claridad.</p></div>
          <button className="button button-primary" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Cerrar alta' : '+ Nuevo alumno'}</button>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando alumnos…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {showCreate && <section className="panel phase14-create-card"><div className="panel-heading"><div><span className="eyebrow">ALTA</span><h3>Nuevo alumno</h3></div></div><form className="phase14-form-grid" onSubmit={createStudent}>
          <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Apellidos<input value={surname} onChange={(event) => setSurname(event.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Teléfono<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label>Fecha de nacimiento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
          <label>Contraseña inicial<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label>Nombre tutor/a<input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
          <label>Teléfono tutor/a<input type="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></label>
          <div className="phase14-form-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear alumno'}</button></div>
        </form></section>}

        <section className="metric-grid student-metrics phase14-metrics">
          <article><span>Alumnos</span><strong>{rows.length}</strong><small>Total registrado</small></article>
          <article><span>Activos</span><strong>{activeCount}</strong><small>Cuentas habilitadas</small></article>
          <article><span>Matriculados</span><strong>{enrolledCount}</strong><small>Con grupo activo</small></article>
          <article><span>Evaluados</span><strong>{evaluatedCount}</strong><small>Con nivel registrado</small></article>
        </section>

        <section className="panel phase14-filter-panel" aria-label="Filtros de alumnos">
          <label className="phase14-search">Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, email, curso, grupo, nivel o profesor" /></label>
          <label>Curso<select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)}><option value="ALL">Todos</option>{courses.map((course) => <option value={course.id} key={course.id}>{course.title}</option>)}</select></label>
          <label>Grupo / aula<select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="ALL">Todos</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
          <label>Nivel<select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}><option value="ALL">Todos</option>{levelOptions.map((level) => <option value={level} key={level}>{level}</option>)}</select></label>
          <label>Profesor<select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}><option value="ALL">Todos</option>{teachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{fullName(teacher)}</option>)}</select></label>
          <label>Modalidad<select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as ModeFilter)}><option value="ALL">Todas</option><option value="IN_PERSON">Presencial</option><option value="ONLINE">Online</option><option value="HYBRID">Híbrida</option></select></label>
          <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="ALL">Todos</option><option value="ACTIVE">Activo</option><option value="INACTIVE">Pausado / inactivo</option></select></label>
          <button className="phase14-clear-filters" type="button" onClick={() => { setQuery(''); setCourseFilter('ALL'); setGroupFilter('ALL'); setLevelFilter('ALL'); setTeacherFilter('ALL'); setModeFilter('ALL'); setStatusFilter('ALL') }}>Limpiar filtros</button>
        </section>

        <section className="panel phase14-directory-list">
          <div className="phase14-directory-head"><div><span className="eyebrow">RESULTADOS</span><h3>{visibleRows.length} alumnos</h3></div><small>Pulsa una fila para abrir la ficha completa</small></div>
          <div className="phase14-student-table" role="table" aria-label="Directorio de alumnos">
            <div className="phase14-student-row phase14-student-header" role="row"><span>Alumno</span><span>Curso / grupo</span><span>Nivel</span><span>Profesor</span><span>Modalidad</span><span>Próxima clase</span><span>Estado</span></div>
            {visibleRows.map((row) => <Link className="phase14-student-row" role="row" to={`/admin/alumnos/${row.user.id}`} key={row.user.id}>
              <span className="phase14-person"><b>{initials(row.user)}</b><span><strong>{fullName(row.user)}</strong><small>{row.user.email}</small></span></span>
              <span><strong>{row.group?.expand?.course?.title || 'Sin curso'}</strong><small>{row.group?.name || 'Sin grupo'}</small></span>
              <span><strong>{row.level}</strong><small>{sourceLabel(row.levelSource)}</small></span>
              <span>{row.teacherName}</span>
              <span>{row.deliveryModes.size ? [...row.deliveryModes].map(modeLabel).join(' · ') : 'Sin definir'}</span>
              <span>{nextClassLabel(row.nextClass)}</span>
              <span><i className={`student-status ${row.user.status === 'ACTIVE' ? 'active' : 'paused'}`}>{row.user.status === 'ACTIVE' ? 'Activo' : 'Pausado'}</i></span>
            </Link>)}
            {!loading && visibleRows.length === 0 && <PortalEmptyState compact title="No hay alumnos con estos filtros" description="Prueba otra combinación o limpia los filtros." />}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

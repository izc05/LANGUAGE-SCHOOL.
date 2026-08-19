import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createAdminTeacher,
  listAdminClasses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminTeacherProfiles,
  listAdminUsers,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import type { AppUser } from '../../services/pocketbase/types'
import type { ClassRecord } from '../../services/pocketbase/studentPortal'
import type { TeacherProfileRecord } from '../../services/pocketbase/teacherPortal'
import { adminNav } from './adminNav'

const demoTeachers = [
  { id: 'demo-t1', name: 'Laura', surname: 'García', email: 'laura@example.com', phone: '600 111 222', role: 'TEACHER', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
  { id: 'demo-t2', name: 'Marta', surname: 'Sánchez', email: 'marta@example.com', phone: '', role: 'TEACHER', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
] as AppUser[]

function fullName(user: AppUser): string {
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email
}

function initials(user: AppUser): string {
  return `${user.name?.charAt(0) || ''}${user.surname?.charAt(0) || ''}`.toUpperCase() || 'PR'
}

function specialties(profile?: TeacherProfileRecord): string[] {
  if (!profile?.specialties) return []
  if (Array.isArray(profile.specialties)) return profile.specialties
  return String(profile.specialties).split(',').map((item) => item.trim()).filter(Boolean)
}

export default function AdminTeachersPhase14Page() {
  const { isDemoMode } = useAuth()
  const [teachers, setTeachers] = useState<AppUser[]>(isDemoMode ? demoTeachers : [])
  const [groups, setGroups] = useState<AdminGroupRecord[]>([])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [profiles, setProfiles] = useState<TeacherProfileRecord[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [specialtyText, setSpecialtyText] = useState('')
  const [bio, setBio] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    Promise.all([listAdminUsers('TEACHER'), listAdminGroups(), listAdminEnrollments(), listAdminClasses(), listAdminTeacherProfiles()])
      .then(([teacherUsers, groupRecords, enrollmentRecords, classRecords, profileRecords]) => {
        if (!mounted) return
        setTeachers(teacherUsers); setGroups(groupRecords); setEnrollments(enrollmentRecords); setClasses(classRecords); setProfiles(profileRecords)
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar el equipo docente.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const views = useMemo(() => teachers.map((teacher) => {
    const teacherGroups = groups.filter((group) => group.teacher === teacher.id && group.status === 'ACTIVE')
    const groupIds = new Set(teacherGroups.map((group) => group.id))
    const studentIds = new Set(enrollments.filter((enrollment) => enrollment.status === 'ACTIVE' && groupIds.has(enrollment.group)).map((enrollment) => enrollment.student))
    const teacherClasses = classes.filter((record) => record.teacher === teacher.id)
    const profile = profiles.find((item) => item.user === teacher.id)
    const courseNames = [...new Set(teacherGroups.map((group) => group.expand?.course?.title).filter((value): value is string => Boolean(value)))]
    return { teacher, teacherGroups, studentCount: studentIds.size, classCount: teacherClasses.length, profile, courseNames }
  }), [classes, enrollments, groups, profiles, teachers])

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return views.filter((view) => {
      const text = `${fullName(view.teacher)} ${view.teacher.email} ${view.courseNames.join(' ')} ${view.teacherGroups.map((group) => group.name).join(' ')} ${specialties(view.profile).join(' ')}`.toLowerCase()
      const statusOk = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? view.teacher.status === 'ACTIVE' : view.teacher.status !== 'ACTIVE')
      return (!normalized || text.includes(normalized)) && statusOk
    })
  }, [query, statusFilter, views])

  async function createTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null); setMessage(null)
    if (isDemoMode) { setShowCreate(false); setMessage('Alta preparada en la demostración.'); return }
    setSaving(true)
    try {
      const created = await createAdminTeacher({ email, password, name, surname, phone, bio, specialties: specialtyText.split(',').map((item) => item.trim()).filter(Boolean), publicProfile: true })
      setTeachers((current) => [...current, created.user].sort((a, b) => fullName(a).localeCompare(fullName(b), 'es')))
      setProfiles((current) => [...current, created.profile])
      setName(''); setSurname(''); setEmail(''); setPhone(''); setPassword(''); setSpecialtyText(''); setBio(''); setShowCreate(false)
      setMessage('Profesor creado. Abre su ficha para completar el perfil y revisar sus grupos.')
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'No se ha podido crear el profesor.')
    } finally { setSaving(false) }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page admin-teacher-directory-phase14">
        <header className="cms-page-heading phase14-pink-heading"><div><span className="eyebrow">PLATAFORMA · PROFESORES</span><h2>Equipo docente</h2><p>Una vista limpia del equipo. Pulsa en cada profesor para abrir su ficha completa, editarla y revisar carga, grupos y alumnos.</p></div><button className="button button-primary" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Cerrar alta' : '+ Nuevo profesor'}</button></header>

        {loading && <div className="cms-notice" role="status">Cargando profesores…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {showCreate && <section className="panel phase14-create-card"><div className="panel-heading"><div><span className="eyebrow">ALTA</span><h3>Nuevo profesor</h3></div></div><form className="phase14-form-grid" onSubmit={createTeacher}>
          <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Apellidos<input value={surname} onChange={(event) => setSurname(event.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Teléfono<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label>Especialidades<input value={specialtyText} onChange={(event) => setSpecialtyText(event.target.value)} placeholder="B1, conversación, Kids" /></label><label>Contraseña inicial<input type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label className="phase14-wide">Bio docente<textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Trayectoria, enfoque, experiencia…" /></label><div className="phase14-form-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear profesor'}</button></div>
        </form></section>}

        <section className="metric-grid phase14-metrics"><article><span>Profesores</span><strong>{views.length}</strong><small>Total registrado</small></article><article><span>Activos</span><strong>{views.filter((view) => view.teacher.status === 'ACTIVE').length}</strong><small>Cuentas habilitadas</small></article><article><span>Alumnos</span><strong>{new Set(enrollments.filter((item) => item.status === 'ACTIVE').map((item) => item.student)).size}</strong><small>Asignados a grupos</small></article><article><span>Grupos activos</span><strong>{groups.filter((item) => item.status === 'ACTIVE').length}</strong><small>En funcionamiento</small></article></section>

        <section className="panel phase14-teacher-toolbar"><label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Profesor, email, grupo, curso o especialidad" /></label><label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="ALL">Todos</option><option value="ACTIVE">Activos</option><option value="INACTIVE">Pausados / inactivos</option></select></label></section>

        <section className="phase14-teacher-grid">
          {visible.map((view) => <Link className="panel phase14-teacher-card" to={`/admin/profesores/${view.teacher.id}`} key={view.teacher.id}>
            <div className="phase14-teacher-card-head"><span className="teacher-avatar">{initials(view.teacher)}</span><div><span className="eyebrow">PROFESOR</span><h3>{fullName(view.teacher)}</h3><p>{view.teacher.email}</p></div><span className={`status ${view.teacher.status === 'ACTIVE' ? 'success' : 'warning'}`}>{view.teacher.status === 'ACTIVE' ? 'Activo' : 'Pausado'}</span></div>
            <div className="phase14-teacher-kpis"><div><span>Alumnos</span><strong>{view.studentCount}</strong></div><div><span>Clases</span><strong>{view.classCount}</strong></div><div><span>Grupos</span><strong>{view.teacherGroups.length}</strong></div></div>
            <div className="phase14-teacher-meta"><div><span>Cursos</span><strong>{view.courseNames.length ? view.courseNames.join(' · ') : 'Sin asignar'}</strong></div><div><span>Grupos</span><strong>{view.teacherGroups.length ? view.teacherGroups.map((group) => group.name).join(' · ') : 'Sin asignar'}</strong></div><div><span>Especialidades</span><strong>{specialties(view.profile).length ? specialties(view.profile).join(' · ') : 'Sin completar'}</strong></div></div>
            <span className="phase14-open-profile">Abrir ficha completa →</span>
          </Link>)}
          {!loading && visible.length === 0 && <PortalEmptyState title="No hay profesores con estos filtros" description="Prueba otra búsqueda o cambia el estado." />}
        </section>
      </div>
    </DashboardShell>
  )
}

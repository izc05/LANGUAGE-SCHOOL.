import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createAdminTeacher,
  deleteAdminTeacher,
  listAdminClasses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminUsers,
  updateAdminUser,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import type { AppUser } from '../../services/pocketbase/types'
import type { ClassRecord } from '../../services/pocketbase/studentPortal'
import { adminNav } from './adminNav'

type TeacherView = {
  user: AppUser
  initials: string
  name: string
  courses: string[]
  groups: AdminGroupRecord[]
  students: number
  classes: number
  status: 'Activo' | 'Pausado'
}

const demoTeachers = [
  { id: 'demo-t1', name: 'Laura', surname: 'García', email: 'laura@example.com', phone: '', role: 'TEACHER', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
  { id: 'demo-t2', name: 'Marta', surname: 'Sánchez', email: 'marta@example.com', phone: '', role: 'TEACHER', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
] as AppUser[]

function initials(user: AppUser): string {
  return `${user.name?.charAt(0) || ''}${user.surname?.charAt(0) || ''}`.toUpperCase() || 'PR'
}

export default function AdminTeachersPage() {
  const { isDemoMode } = useAuth()
  const [teachers, setTeachers] = useState<AppUser[]>(isDemoMode ? demoTeachers : [])
  const [groups, setGroups] = useState<AdminGroupRecord[]>([])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [specialties, setSpecialties] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    Promise.all([listAdminUsers('TEACHER'), listAdminGroups(), listAdminEnrollments(), listAdminClasses()])
      .then(([teacherUsers, groupRecords, enrollmentRecords, classRecords]) => {
        if (!mounted) return
        setTeachers(teacherUsers)
        setGroups(groupRecords)
        setEnrollments(enrollmentRecords)
        setClasses(classRecords)
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar el equipo docente. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const views = useMemo<TeacherView[]>(() => teachers.map((teacher) => {
    const teacherGroups = groups.filter((group) => group.teacher === teacher.id && group.status === 'ACTIVE')
    const groupIds = new Set(teacherGroups.map((group) => group.id))
    const studentIds = new Set(enrollments.filter((item) => item.status === 'ACTIVE' && groupIds.has(item.group)).map((item) => item.student))
    const teacherClasses = classes.filter((item) => item.teacher === teacher.id)
    const courseNames = [...new Set(teacherGroups.map((group) => group.expand?.course?.title).filter((value): value is string => Boolean(value)))]
    return {
      user: teacher,
      initials: initials(teacher),
      name: [teacher.name, teacher.surname].filter(Boolean).join(' ') || teacher.email,
      courses: courseNames,
      groups: teacherGroups,
      students: studentIds.size,
      classes: teacherClasses.length,
      status: teacher.status === 'ACTIVE' ? 'Activo' : 'Pausado',
    }
  }), [classes, enrollments, groups, teachers])

  const activeCount = views.filter((item) => item.status === 'Activo').length
  const assignedStudents = new Set(enrollments.filter((item) => item.status === 'ACTIVE').map((item) => item.student)).size

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    if (isDemoMode) {
      setMessage('Alta preparada en la demostración. No se ha creado ninguna cuenta real.')
      return
    }
    setSaving(true)
    try {
      const specialtyList = specialties.split(',').map((value) => value.trim()).filter(Boolean)
      const created = await createAdminTeacher({ email, password, name, surname, phone, specialties: specialtyList, publicProfile: true })
      setTeachers((current) => [...current, created.user].sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'es')))
      setName('')
      setSurname('')
      setEmail('')
      setPhone('')
      setPassword('')
      setSpecialties('')
      setShowCreate(false)
      setMessage('Profesor creado correctamente. Ya puede iniciar sesión con su contraseña inicial.')
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'No se ha podido crear el profesor.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTeacher(record: TeacherView) {
    setError(null)
    setMessage(null)
    const nextStatus = record.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const actionLabel = nextStatus === 'ACTIVE' ? 'activar' : 'desactivar'
    if (!window.confirm(`¿Quieres ${actionLabel} la cuenta de ${record.name}?`)) return
    if (isDemoMode) {
      setMessage(`Cambio a ${nextStatus === 'ACTIVE' ? 'activo' : 'inactivo'} preparado en la demostración.`)
      return
    }
    try {
      const updated = await updateAdminUser(record.user, { status: nextStatus })
      setTeachers((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage(nextStatus === 'ACTIVE' ? 'Profesor activado.' : 'Profesor desactivado.')
    } catch {
      setError('No se ha podido cambiar el estado del profesor.')
    }
  }

  async function removeTeacher(record: TeacherView) {
    setError(null)
    setMessage(null)
    const confirmed = window.confirm(
      `¿Eliminar definitivamente a ${record.name}?\n\nSe borrarán su acceso y su perfil docente. Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    if (isDemoMode) {
      setTeachers((current) => current.filter((item) => item.id !== record.user.id))
      setMessage('Profesor eliminado en la demostración. No se ha modificado ningún dato real.')
      return
    }

    setDeletingId(record.user.id)
    try {
      await deleteAdminTeacher(record.user)
      setTeachers((current) => current.filter((item) => item.id !== record.user.id))
      setMessage('Profesor eliminado correctamente.')
    } catch (deletionError) {
      setError(deletionError instanceof Error ? deletionError.message : 'No se ha podido eliminar el profesor.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div><span className="eyebrow">PLATAFORMA · PROFESORES</span><h2>Equipo docente</h2><p>Gestiona profesores, grupos asignados, alumnos relacionados y carga docente desde un único lugar.</p></div>
          <button className="button button-primary" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Cerrar alta' : '+ Nuevo profesor'}</button>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando profesores…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {showCreate && <section className="panel admin-inline-create">
          <div className="panel-heading"><div><span className="eyebrow">ALTA</span><h3>Nuevo profesor</h3></div><span className="status info">Cuenta + perfil</span></div>
          <form onSubmit={handleCreate} className="admin-create-grid">
            <div><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><label>Apellidos</label><input value={surname} onChange={(e) => setSurname(e.target.value)} required /></div>
            <div><label>Email</label><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label>Teléfono</label><input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label>Especialidades</label><input value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Kids, B2, Speaking" /></div>
            <div><label>Contraseña inicial</label><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <div className="admin-create-action"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear profesor'}</button></div>
          </form>
        </section>}

        <section className="metric-grid">
          <article><span>Profesores</span><strong>{views.length}</strong><small>Total registrado</small></article>
          <article><span>Activos</span><strong>{activeCount}</strong><small>Cuentas habilitadas</small></article>
          <article><span>Alumnos asignados</span><strong>{assignedStudents}</strong><small>Matrículas activas</small></article>
          <article><span>Grupos activos</span><strong>{groups.filter((item) => item.status === 'ACTIVE').length}</strong><small>Con profesor asignado</small></article>
        </section>

        <section className="teacher-admin-grid">
          {views.map((teacher) => (
            <article className="panel teacher-admin-card" key={teacher.user.id}>
              <div className="teacher-card-heading">
                <span className="teacher-avatar">{teacher.initials}</span>
                <div>
                  <span className="eyebrow">PROFESOR</span>
                  <h3>{teacher.name}</h3>
                  <p className="teacher-card-email">{teacher.user.email}</p>
                  <p>{teacher.courses.length ? teacher.courses.join(' · ') : 'Sin grupos asignados'}</p>
                </div>
                <span className={`status ${teacher.status === 'Activo' ? 'success' : 'warning'}`}>{teacher.status}</span>
              </div>
              <div className="teacher-card-metrics"><div><span>Alumnos</span><strong>{teacher.students}</strong></div><div><span>Clases</span><strong>{teacher.classes}</strong></div></div>
              <div className="teacher-availability"><span>Grupos activos</span><strong>{teacher.groups.length ? teacher.groups.map((group) => group.name).join(' · ') : 'Sin asignar'}</strong></div>
              <div className="teacher-card-actions">
                <button type="button" disabled={deletingId === teacher.user.id} onClick={() => void toggleTeacher(teacher)}>{teacher.user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>
                <button className="button-danger-soft" type="button" disabled={deletingId === teacher.user.id} onClick={() => void removeTeacher(teacher)}>{deletingId === teacher.user.id ? 'Eliminando…' : 'Eliminar'}</button>
              </div>
            </article>
          ))}
          {!loading && views.length === 0 && <PortalEmptyState title="Todavía no hay profesores registrados" description="Crea el primer profesor para asignarle grupos, alumnos y clases." />}
        </section>
      </div>
    </DashboardShell>
  )
}

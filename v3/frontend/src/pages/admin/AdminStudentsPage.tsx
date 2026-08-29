import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  createAdminStudent,
  listAdminClasses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminUsers,
  moveAdminStudentToGroup,
  updateAdminUser,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import type { AppUser } from '../../services/pocketbase/types'
import type { ClassRecord } from '../../services/pocketbase/studentPortal'
import { adminNav } from './adminNav'

type StudentView = {
  user: AppUser
  initials: string
  name: string
  email: string
  level: string
  program: string
  group: string
  teacher: string
  status: 'Activo' | 'Pausado'
  nextClass: string
}

const demoUsers = [
  { id: 'demo-1', name: 'Emma', surname: 'Martín', email: 'emma@example.com', phone: '', role: 'STUDENT', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
  { id: 'demo-2', name: 'Daniel', surname: 'López', email: 'daniel@example.com', phone: '', role: 'STUDENT', status: 'ACTIVE', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {} },
] as AppUser[]

function formatNextClass(value?: string): string {
  if (!value) return 'Sin programar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin programar'
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function initials(user: AppUser): string {
  return `${user.name?.charAt(0) || ''}${user.surname?.charAt(0) || ''}`.toUpperCase() || 'AL'
}

export default function AdminStudentsPage() {
  const { isDemoMode } = useAuth()
  const [users, setUsers] = useState<AppUser[]>(isDemoMode ? demoUsers : [])
  const [teachers, setTeachers] = useState<AppUser[]>([])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [groups, setGroups] = useState<AdminGroupRecord[]>([])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'Todos' | StudentView['status']>('Todos')
  const [selectedId, setSelectedId] = useState<string | null>(isDemoMode ? demoUsers[0].id : null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [editName, setEditName] = useState('')
  const [editSurname, setEditSurname] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editGroupId, setEditGroupId] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    Promise.all([listAdminUsers('STUDENT'), listAdminUsers('TEACHER'), listAdminEnrollments(), listAdminClasses(), listAdminGroups()])
      .then(([studentUsers, teacherUsers, enrollmentRecords, classRecords, groupRecords]) => {
        if (!mounted) return
        setUsers(studentUsers)
        setTeachers(teacherUsers)
        setEnrollments(enrollmentRecords)
        setClasses(classRecords)
        setGroups(groupRecords)
        if (studentUsers[0]) setSelectedId(studentUsers[0].id)
      })
      .catch(() => { if (mounted) setError('No se han podido cargar los alumnos. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const studentViews = useMemo<StudentView[]>(() => users.map((user) => {
    const activeEnrollment = enrollments.find((item) => item.student === user.id && item.status === 'ACTIVE')
    const group = activeEnrollment?.expand?.group
    const course = group?.expand?.course
    const teacher = teachers.find((item) => item.id === group?.teacher)
    const next = classes
      .filter((item) => item.group === group?.id && item.status === 'SCHEDULED' && new Date(item.starts_at).getTime() >= Date.now())
      .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
    return {
      user,
      initials: initials(user),
      name: [user.name, user.surname].filter(Boolean).join(' ') || user.email,
      email: user.email,
      level: course?.level || '—',
      program: course?.title || 'Sin curso',
      group: group?.name || 'Sin grupo',
      teacher: teacher ? [teacher.name, teacher.surname].filter(Boolean).join(' ') : 'Sin profesor',
      status: user.status === 'ACTIVE' ? 'Activo' : 'Pausado',
      nextClass: formatNextClass(next?.starts_at),
    }
  }), [classes, enrollments, teachers, users])

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return studentViews.filter((student) => {
      const matchesText = !normalized || [student.name, student.email, student.level, student.program, student.teacher, student.group]
        .some((value) => value.toLowerCase().includes(normalized))
      const matchesStatus = status === 'Todos' || student.status === status
      return matchesText && matchesStatus
    })
  }, [query, status, studentViews])

  const selected = studentViews.find((student) => student.user.id === selectedId) || studentViews[0] || null
  const activeCount = studentViews.filter((student) => student.status === 'Activo').length
  const enrolledCount = new Set(enrollments.filter((item) => item.status === 'ACTIVE').map((item) => item.student)).size

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
      const created = await createAdminStudent({ email, password, name, surname, phone })
      setUsers((current) => [...current, created.user].sort((a, b) => `${a.name} ${a.surname}`.localeCompare(`${b.name} ${b.surname}`, 'es')))
      setSelectedId(created.user.id)
      setName('')
      setSurname('')
      setEmail('')
      setPhone('')
      setPassword('')
      setShowCreate(false)
      setMessage('Alumno creado correctamente. Ya puede iniciar sesión con su contraseña inicial.')
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'No se ha podido crear el alumno.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleSelectedStatus() {
    if (!selected) return
    setError(null)
    setMessage(null)
    const nextStatus = selected.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const actionLabel = nextStatus === 'ACTIVE' ? 'activar' : 'desactivar'
    if (!window.confirm(`¿Quieres ${actionLabel} la cuenta de ${selected.name}?`)) return
    if (isDemoMode) {
      setMessage(`Cambio a ${nextStatus === 'ACTIVE' ? 'activo' : 'inactivo'} preparado en la demostración.`)
      return
    }
    try {
      const updated = await updateAdminUser(selected.user, { status: nextStatus })
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item))
      setMessage(nextStatus === 'ACTIVE' ? 'Alumno activado.' : 'Alumno desactivado.')
    } catch {
      setError('No se ha podido cambiar el estado del alumno.')
    }
  }

  function openEdit() {
    if (!selected) return
    const enrollment = enrollments.find((item) => item.student === selected.user.id && item.status === 'ACTIVE')
    setEditName(selected.user.name)
    setEditSurname(selected.user.surname)
    setEditPhone(selected.user.phone || '')
    setEditGroupId(enrollment?.group || '')
    setShowEdit(true)
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setError(null); setMessage(null)
    const activeEnrollment = enrollments.find((item) => item.student === selected.user.id && item.status === 'ACTIVE')
    const target = groups.find((item) => item.id === editGroupId)
    if (editGroupId && !target) { setError('Selecciona un grupo válido.'); return }
    if (isDemoMode) { setShowEdit(false); setMessage('Edición preparada en la demostración.'); return }
    setSaving(true)
    try {
      const updatedUser = await updateAdminUser(selected.user, { name: editName.trim(), surname: editSurname.trim(), phone: editPhone.trim() })
      if (target && target.id !== activeEnrollment?.group) {
        const moved = await moveAdminStudentToGroup({ studentId: selected.user.id, currentEnrollment: activeEnrollment, targetGroup: target })
        setEnrollments((current) => [...current.filter((item) => item.id !== moved.current.id && item.id !== moved.previous?.id), ...(moved.previous ? [moved.previous] : []), moved.current])
      }
      setUsers((current) => current.map((item) => item.id === updatedUser.id ? updatedUser : item))
      setShowEdit(false)
      setMessage(target && target.id !== activeEnrollment?.group ? 'Ficha actualizada y matrícula trasladada; se conserva el historial anterior.' : 'Ficha del alumno actualizada.')
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'No se ha podido actualizar la ficha del alumno.')
    } finally { setSaving(false) }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">PLATAFORMA · ALUMNOS</span>
            <h2>Alumnos y espacio privado</h2>
            <p>Gestiona cuentas de alumno, estado de acceso, matrícula, grupo, profesor y próxima clase desde un único lugar.</p>
          </div>
          <button className="button button-primary" type="button" onClick={() => setShowCreate((value) => !value)}>{showCreate ? 'Cerrar alta' : '+ Nuevo alumno'}</button>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando alumnos…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {showCreate && <section className="panel admin-inline-create">
          <div className="panel-heading"><div><span className="eyebrow">ALTA</span><h3>Nuevo alumno</h3></div><span className="status info">Cuenta + perfil</span></div>
          <form onSubmit={handleCreate} className="admin-create-grid">
            <div><label>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            <div><label>Apellidos</label><input value={surname} onChange={(e) => setSurname(e.target.value)} required /></div>
            <div><label>Email</label><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label>Teléfono</label><input type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div><label>Contraseña inicial</label><input type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <div className="admin-create-action"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Creando…' : 'Crear alumno'}</button></div>
          </form>
        </section>}

        <section className="metric-grid student-metrics">
          <article><span>Alumnos</span><strong>{studentViews.length}</strong><small>Total registrado</small></article>
          <article><span>Activos</span><strong>{activeCount}</strong><small>Cuentas habilitadas</small></article>
          <article><span>Matriculados</span><strong>{enrolledCount}</strong><small>Con matrícula activa</small></article>
          <article><span>Sin grupo</span><strong>{Math.max(0, studentViews.length - enrolledCount)}</strong><small>Pendientes de matrícula</small></article>
        </section>

        <div className="students-admin-layout">
          <section className="panel students-list-panel">
            <div className="students-toolbar">
              <label className="student-search"><span>Buscar alumno</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, nivel, profesor..." /></label>
              <div className="filter-pills">
                {(['Todos', 'Activo', 'Pausado'] as const).map((option) => <button key={option} className={status === option ? 'active' : ''} type="button" onClick={() => setStatus(option)}>{option}</button>)}
              </div>
            </div>

            <div className="students-table" role="table" aria-label="Listado de alumnos">
              <div className="students-table-row students-table-header" role="row"><span>Alumno</span><span>Programa</span><span>Profesor</span><span>Próxima clase</span><span>Estado</span></div>
              {filteredStudents.map((student) => (
                <button className={`students-table-row ${selected?.user.id === student.user.id ? 'selected' : ''}`} role="row" type="button" key={student.user.id} onClick={() => setSelectedId(student.user.id)}>
                  <span className="student-identity"><b>{student.initials}</b><span><strong>{student.name}</strong><small>{student.email}</small></span></span>
                  <span><strong>{student.level}</strong><small>{student.program}</small></span>
                  <span>{student.teacher}</span><span>{student.nextClass}</span>
                  <span><i className={`student-status ${student.status === 'Activo' ? 'active' : 'paused'}`}>{student.status}</i></span>
                </button>
              ))}
              {!loading && filteredStudents.length === 0 && <PortalEmptyState compact title={query.trim() || status !== 'Todos' ? 'No hay alumnos con estos filtros' : 'Todavía no hay alumnos'} description={query.trim() || status !== 'Todos' ? 'Prueba con otra búsqueda o selecciona Todos.' : 'Crea el primer alumno para empezar a organizar matrículas y clases.'} />}
            </div>
          </section>

          <aside className="panel student-detail-panel">
            {!selected ? <PortalEmptyState title="Sin alumnos" description="Crea el primer alumno para empezar la gestión académica." /> : <>
              <div className="student-detail-heading"><span className="student-avatar-large">{selected.initials}</span><div><span className="eyebrow">FICHA DEL ALUMNO</span><h3>{selected.name}</h3><p>{selected.email}</p></div></div>
              <div className="student-detail-tags"><span>{selected.level}</span><span>{selected.program}</span><span>{selected.group}</span></div>
              <div className="student-detail-grid">
                <div><span>Próxima clase</span><strong>{selected.nextClass}</strong></div>
                <div><span>Profesor</span><strong>{selected.teacher}</strong></div>
                <div><span>Grupo</span><strong>{selected.group}</strong></div>
                <div><span>Estado</span><strong>{selected.status}</strong></div>
              </div>
              <div className="student-private-space">
                <div className="panel-heading"><div><span className="eyebrow">ESPACIO PRIVADO</span><h3>Acceso protegido</h3></div><span className="status success">Protegido</span></div>
                <p className="muted">Los archivos y recursos privados del alumno solo son accesibles para su cuenta y para el personal autorizado según su relación académica.</p>
              </div>
              <div className="student-detail-actions">
                <button type="button" onClick={openEdit}>Editar ficha</button>
                <button className="button button-primary" type="button" onClick={() => void toggleSelectedStatus()}>{selected.user.status === 'ACTIVE' ? 'Desactivar alumno' : 'Activar alumno'}</button>
              </div>
              {showEdit && <form className="admin-create-grid student-edit-form" onSubmit={saveEdit}>
                <div><label>Nombre</label><input value={editName} onChange={(event) => setEditName(event.target.value)} required /></div>
                <div><label>Apellidos</label><input value={editSurname} onChange={(event) => setEditSurname(event.target.value)} required /></div>
                <div><label>Teléfono</label><input type="tel" value={editPhone} onChange={(event) => setEditPhone(event.target.value)} /></div>
                <div><label>Grupo y nivel</label><select value={editGroupId} onChange={(event) => setEditGroupId(event.target.value)}><option value="">Sin grupo activo</option>{groups.filter((group) => group.status === 'ACTIVE').map((group) => <option key={group.id} value={group.id}>{group.expand?.course?.level || 'Sin nivel'} · {group.expand?.course?.title || 'Curso'} · {group.name}</option>)}</select></div>
                <p className="muted admin-create-wide">Cambiar de grupo finaliza la matrícula activa anterior y crea una nueva, sin borrar su historial ni clases anteriores.</p>
                <div className="admin-create-action"><button type="button" onClick={() => setShowEdit(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
              </form>}
            </>}
          </aside>
        </div>
      </div>
    </DashboardShell>
  )
}

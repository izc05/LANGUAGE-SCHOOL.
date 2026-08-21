import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import AdminAccountInvitationCard from '../../components/AdminAccountInvitationCard'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  deleteAdminTeacher,
  listAdminClasses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminUsers,
  updateAdminUser,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import { getAdminTeacherProfilePhase14, saveAdminTeacherProfilePhase14 } from '../../services/pocketbase/adminProfilesPhase14'
import type { AppUser } from '../../services/pocketbase/types'
import type { ClassDeliveryMode, ClassRecord } from '../../services/pocketbase/studentPortal'
import type { TeacherProfileRecord } from '../../services/pocketbase/teacherPortal'
import { adminNav } from './adminNav'

function fullName(user?: AppUser): string {
  if (!user) return 'Profesor'
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email
}

function initials(user?: AppUser): string {
  if (!user) return 'PR'
  return `${user.name?.charAt(0) || ''}${user.surname?.charAt(0) || ''}`.toUpperCase() || 'PR'
}

function accountStatusLabel(user?: AppUser): string {
  if (user?.status === 'ACTIVE') return 'Activo'
  if (user?.status === 'INVITED') return 'Invitado'
  if (user?.status === 'SUSPENDED') return 'Suspendido'
  return 'Pausado'
}

function profileSpecialties(profile?: TeacherProfileRecord | null): string[] {
  if (!profile?.specialties) return []
  if (Array.isArray(profile.specialties)) return profile.specialties
  return String(profile.specialties).split(',').map((item) => item.trim()).filter(Boolean)
}

function modeLabel(mode: ClassDeliveryMode): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

const demoTeacher: AppUser = { id: 'demo-t1', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'laura@example.com', name: 'Laura', surname: 'García', role: 'TEACHER', status: 'ACTIVE', phone: '600 111 222' }
const demoProfile = { id: 'demo-teacher-profile', collectionId: '', collectionName: 'teacher_profiles', created: '', updated: '', expand: {}, user: 'demo-t1', bio: 'Profesora especializada en aprendizaje comunicativo y acompañamiento de adultos.', specialties: ['B1', 'Conversación', 'Adultos'], public_photo: '', public_profile: true, active: true, display_name: 'Laura García', headline: 'Inglés práctico y conversación', sort_order: 1 } as TeacherProfileRecord

export default function AdminTeacherDetailPhase14Page() {
  const { teacherId = '' } = useParams()
  const navigate = useNavigate()
  const { isDemoMode } = useAuth()
  const [teacher, setTeacher] = useState<AppUser | null>(isDemoMode ? demoTeacher : null)
  const [profile, setProfile] = useState<TeacherProfileRecord | null>(isDemoMode ? demoProfile : null)
  const [groups, setGroups] = useState<AdminGroupRecord[]>([])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [students, setStudents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [headline, setHeadline] = useState('')
  const [specialtyText, setSpecialtyText] = useState('')
  const [bio, setBio] = useState('')
  const [publicProfile, setPublicProfile] = useState(true)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    Promise.all([listAdminUsers('TEACHER'), listAdminUsers('STUDENT'), listAdminGroups(), listAdminEnrollments(), listAdminClasses(), getAdminTeacherProfilePhase14(teacherId)])
      .then(([teachers, studentUsers, groupRecords, enrollmentRecords, classRecords, profileRecord]) => {
        if (!mounted) return
        const found = teachers.find((item) => item.id === teacherId) || null
        setTeacher(found); setStudents(studentUsers); setGroups(groupRecords.filter((item) => item.teacher === teacherId)); setEnrollments(enrollmentRecords); setClasses(classRecords.filter((item) => item.teacher === teacherId)); setProfile(profileRecord)
        if (!found) setError('No se ha encontrado este profesor.')
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar la ficha completa del profesor.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, teacherId])

  const activeGroups = groups.filter((group) => group.status === 'ACTIVE')
  const groupIds = new Set(activeGroups.map((group) => group.id))
  const assignedStudentIds = new Set(enrollments.filter((item) => item.status === 'ACTIVE' && groupIds.has(item.group)).map((item) => item.student))
  const assignedStudents = students.filter((student) => assignedStudentIds.has(student.id))
  const courseNames = [...new Set(activeGroups.map((group) => group.expand?.course?.title).filter((value): value is string => Boolean(value)))]
  const modes = useMemo(() => [...new Set(classes.map((record) => record.delivery_mode).filter((value): value is ClassDeliveryMode => value === 'IN_PERSON' || value === 'ONLINE' || value === 'HYBRID'))], [classes])
  const upcoming = classes.filter((record) => record.status === 'SCHEDULED' && new Date(record.starts_at).getTime() >= Date.now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 5)
  const completedCount = classes.filter((record) => record.status === 'COMPLETED').length

  function openEdit() {
    if (!teacher) return
    setName(teacher.name); setSurname(teacher.surname); setPhone(teacher.phone || ''); setDisplayName(profile?.display_name || fullName(teacher)); setHeadline(profile?.headline || ''); setSpecialtyText(profileSpecialties(profile).join(', ')); setBio(profile?.bio || ''); setPublicProfile(Boolean(profile?.public_profile)); setEditing(true); setMessage(null); setError(null)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!teacher) return
    setSaving(true); setError(null); setMessage(null)
    const specialties = specialtyText.split(',').map((item) => item.trim()).filter(Boolean)
    if (isDemoMode) {
      setTeacher({ ...teacher, name, surname, phone })
      setProfile({ ...(profile || demoProfile), display_name: displayName, headline, specialties, bio, public_profile: publicProfile, active: true })
      setEditing(false); setSaving(false); setMessage('Ficha actualizada en la demostración.'); return
    }
    try {
      const updatedUser = await updateAdminUser(teacher, { name: name.trim(), surname: surname.trim(), phone: phone.trim() })
      const updatedProfile = await saveAdminTeacherProfilePhase14(teacher.id, { bio, specialties, publicProfile, active: teacher.status === 'ACTIVE', displayName, headline })
      setTeacher(updatedUser); setProfile(updatedProfile); setEditing(false); setMessage('Ficha completa del profesor actualizada.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar la ficha del profesor.')
    } finally { setSaving(false) }
  }

  async function toggleStatus() {
    if (!teacher) return
    if (teacher.status === 'INVITED') {
      setError('La cuenta está pendiente de activación segura. El profesor debe completar la invitación para elegir su contraseña.')
      return
    }
    const next = teacher.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!window.confirm(`${next === 'ACTIVE' ? '¿Activar' : '¿Desactivar'} la cuenta de ${fullName(teacher)}?`)) return
    if (isDemoMode) { setTeacher({ ...teacher, status: next }); return }
    try { const updated = await updateAdminUser(teacher, { status: next }); setTeacher(updated); setMessage(next === 'ACTIVE' ? 'Profesor activado.' : 'Profesor desactivado.') } catch { setError('No se ha podido cambiar el estado.') }
  }

  async function removeTeacher() {
    if (!teacher) return
    if (!window.confirm(`¿Eliminar definitivamente a ${fullName(teacher)}? Solo será posible si no conserva datos vinculados.`)) return
    if (isDemoMode) { navigate('/admin/profesores'); return }
    setDeleting(true); setError(null)
    try { await deleteAdminTeacher(teacher); navigate('/admin/profesores') } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : 'No se ha podido eliminar el profesor.') } finally { setDeleting(false) }
  }

  if (!loading && !teacher) {
    return <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}><div className="dashboard-content"><PortalEmptyState title="Profesor no encontrado" description="Vuelve al directorio y selecciona otro profesor." /><button className="button" type="button" onClick={() => navigate('/admin/profesores')}>Volver a profesores</button></div></DashboardShell>
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page phase14-profile-page">
        <div className="phase14-back-row"><Link to="/admin/profesores">← Volver a profesores</Link></div>
        <header className="phase14-profile-hero phase14-pink-heading"><div className="phase14-profile-identity"><span className="phase14-profile-avatar">{initials(teacher || undefined)}</span><div><span className="eyebrow">FICHA DEL PROFESOR</span><h2>{profile?.display_name || fullName(teacher || undefined)}</h2><p>{profile?.headline || teacher?.email || 'Perfil docente'}{profile?.headline && teacher?.email ? ` · ${teacher.email}` : ''}</p></div></div><div className="phase14-profile-actions"><span className={`status ${teacher?.status === 'ACTIVE' ? 'success' : 'warning'}`}>{accountStatusLabel(teacher || undefined)}</span><button type="button" onClick={openEdit}>Editar ficha</button>{teacher?.status !== 'INVITED' && <button className="button button-primary" type="button" onClick={() => void toggleStatus()}>{teacher?.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>}</div></header>

        {loading && <div className="cms-notice" role="status">Cargando ficha…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="phase14-profile-grid">
          <article className="panel phase14-profile-card"><div className="panel-heading"><div><span className="eyebrow">DOCENCIA</span><h3>Carga académica</h3></div></div><div className="phase14-data-grid"><div><span>Alumnos</span><strong>{assignedStudentIds.size}</strong></div><div><span>Grupos activos</span><strong>{activeGroups.length}</strong></div><div><span>Clases totales</span><strong>{classes.length}</strong></div><div><span>Completadas</span><strong>{completedCount}</strong></div><div><span>Cursos</span><strong>{courseNames.length ? courseNames.join(' · ') : 'Sin asignar'}</strong></div><div><span>Modalidad</span><strong>{modes.length ? modes.map(modeLabel).join(' · ') : 'Sin definir'}</strong></div></div></article>

          <article className="panel phase14-profile-card"><div className="panel-heading"><div><span className="eyebrow">PERFIL</span><h3>Datos docentes</h3></div></div><div className="phase14-data-grid"><div><span>Email</span><strong>{teacher?.email || '—'}</strong></div><div><span>Teléfono</span><strong>{teacher?.phone || 'Sin teléfono'}</strong></div><div><span>Perfil público</span><strong>{profile?.public_profile ? 'Visible en la web' : 'Oculto'}</strong></div><div><span>Especialidades</span><strong>{profileSpecialties(profile).length ? profileSpecialties(profile).join(' · ') : 'Sin completar'}</strong></div></div><div className="phase14-bio"><span>Biografía</span><p>{profile?.bio || 'Sin biografía. Puedes completarla desde Editar ficha.'}</p></div></article>

          {teacher && <AdminAccountInvitationCard userId={teacher.id} accountStatus={teacher.status} isDemoMode={isDemoMode} />}

          <article className="panel phase14-profile-card"><div className="panel-heading"><div><span className="eyebrow">GRUPOS</span><h3>Grupos asignados</h3></div></div><div className="phase14-group-list">{activeGroups.map((group) => <div key={group.id}><span><strong>{group.name}</strong><small>{group.expand?.course?.title || 'Curso'} · {group.schedule_text || 'Sin horario'}</small></span><b>{enrollments.filter((item) => item.group === group.id && item.status === 'ACTIVE').length}/{group.capacity}</b></div>)}{activeGroups.length === 0 && <small>Sin grupos activos asignados.</small>}</div></article>

          <article className="panel phase14-profile-card"><div className="panel-heading"><div><span className="eyebrow">ALUMNOS</span><h3>Alumnos vinculados</h3></div></div><div className="phase14-compact-people">{assignedStudents.slice(0, 8).map((student) => <Link to={`/admin/alumnos/${student.id}`} key={student.id}><span>{initials(student)}</span><div><strong>{fullName(student)}</strong><small>{student.email}</small></div></Link>)}{assignedStudents.length === 0 && <small>Sin alumnos activos asignados.</small>}</div></article>

          <article className="panel phase14-profile-card phase14-wide-card"><div className="panel-heading"><div><span className="eyebrow">PRÓXIMAS CLASES</span><h3>Agenda próxima</h3></div></div><div className="phase14-upcoming-list">{upcoming.map((record) => <div key={record.id}><time>{new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(record.starts_at))}</time><span><strong>{record.topic || 'Clase'}</strong><small>{groups.find((group) => group.id === record.group)?.name || 'Grupo'} · {modeLabel(record.delivery_mode as ClassDeliveryMode)}</small></span></div>)}{upcoming.length === 0 && <small>Sin próximas clases programadas.</small>}</div></article>
        </section>

        {editing && <section className="panel phase14-edit-panel"><div className="panel-heading"><div><span className="eyebrow">EDITAR</span><h3>Completar ficha del profesor</h3></div><button type="button" onClick={() => setEditing(false)}>Cerrar</button></div><form className="phase14-form-grid" onSubmit={save}><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Apellidos<input value={surname} onChange={(event) => setSurname(event.target.value)} required /></label><label>Teléfono<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>Nombre público<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label><label className="phase14-wide">Titular público<input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="Ej. Inglés práctico y conversación" /></label><label className="phase14-wide">Especialidades<input value={specialtyText} onChange={(event) => setSpecialtyText(event.target.value)} placeholder="B1, conversación, Kids" /></label><label className="phase14-wide">Biografía<textarea rows={6} value={bio} onChange={(event) => setBio(event.target.value)} /></label><label className="phase14-checkbox"><input type="checkbox" checked={publicProfile} onChange={(event) => setPublicProfile(event.target.checked)} /> Mostrar perfil en la web pública</label><div className="phase14-form-actions"><button type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ficha'}</button></div></form></section>}

        <section className="phase14-danger-zone"><div><strong>Zona administrativa</strong><small>Eliminar solo cuando no existan datos vinculados. En caso contrario, desactiva la cuenta.</small></div><button type="button" disabled={deleting} onClick={() => void removeTeacher()}>{deleting ? 'Eliminando…' : 'Eliminar profesor'}</button></section>
      </div>
    </DashboardShell>
  )
}

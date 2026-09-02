import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import AdminAccountInvitationCard from '../../components/AdminAccountInvitationCard'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  listAdminClasses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminUsers,
  moveAdminStudentToGroup,
  updateAdminUser,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import { effectivePaymentStatus, listAdminPayments, paymentCoverageUntil, pendingAmountCents, type StudentPaymentRecord } from '../../services/pocketbase/adminPayments'
import { getAdminStudentProfilePhase14, saveAdminStudentProfilePhase14, type AdminStudentProfilePhase14 } from '../../services/pocketbase/adminProfilesPhase14'
import { getPlacementAdminOverview, type PlacementAdminStudentLevel } from '../../services/pocketbase/placementAdmin'
import { demoSiteSettings, getSiteSettings, type SiteSettingsRecord } from '../../services/pocketbase/siteManagement'
import type { AppUser } from '../../services/pocketbase/types'
import type { ClassDeliveryMode, ClassRecord } from '../../services/pocketbase/studentPortal'
import { downloadPaymentReceiptPdf, downloadPaymentsExcel, type PaymentReceiptAcademy } from '../../utils/paymentExcel'
import { formatLastAccess } from '../../utils/lastAccess'
import AdminStudentLevelCard from './AdminStudentLevelCard'
import { adminNav } from './adminNav'

const euro = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function fullName(user?: AppUser): string {
  if (!user) return 'Alumno'
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email
}

function initials(user?: AppUser): string {
  if (!user) return 'AL'
  return `${user.name?.charAt(0) || ''}${user.surname?.charAt(0) || ''}`.toUpperCase() || 'AL'
}

function accountStatusLabel(user?: AppUser): string {
  if (user?.status === 'ACTIVE') return 'Activo'
  if (user?.status === 'INVITED') return 'Invitado'
  if (user?.status === 'SUSPENDED') return 'Suspendido'
  return 'Pausado'
}

function accountStateLabel(user?: AppUser): string {
  if (user?.status === 'ACTIVE') return 'Habilitada'
  if (user?.status === 'INVITED') return 'Pendiente de activación'
  if (user?.status === 'SUSPENDED') return 'Suspendida'
  return 'No activa'
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const normalized = value.slice(0, 10)
  const date = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

function todayKey(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function modeLabel(mode?: ClassDeliveryMode | ''): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  if (mode === 'IN_PERSON') return 'Presencial'
  return 'Sin definir'
}

function levelSourceLabel(source?: PlacementAdminStudentLevel['currentLevelSource']): string {
  if (source === 'VALIDATED') return 'Nivel validado'
  if (source === 'AUTOMATIC') return 'Nivel estimado'
  return 'Sin evaluación'
}

function nextClassLabel(record?: ClassRecord): string {
  if (!record) return 'Sin programar'
  const date = new Date(record.starts_at)
  if (Number.isNaN(date.getTime())) return 'Sin programar'
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }).format(date)
}

function paymentStatusLabel(record: StudentPaymentRecord): string {
  const status = effectivePaymentStatus(record)
  if (status === 'PAID') return 'Pagado'
  if (status === 'OVERDUE') return 'Vencido'
  if (status === 'PENDING') return 'Pendiente'
  if (status === 'CANCELLED') return 'Cancelado'
  return 'Reembolsado'
}

const demoUser: AppUser = { id: 'demo-1', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'emma@example.com', name: 'Emma', surname: 'Martín', role: 'STUDENT', status: 'ACTIVE', phone: '600 123 456' }

export default function AdminStudentDetailPhase14Page() {
  const { studentId = '' } = useParams()
  const navigate = useNavigate()
  const { isDemoMode } = useAuth()
  const [student, setStudent] = useState<AppUser | null>(isDemoMode ? demoUser : null)
  const [teachers, setTeachers] = useState<AppUser[]>([])
  const [groups, setGroups] = useState<AdminGroupRecord[]>([])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>([])
  const [classes, setClasses] = useState<ClassRecord[]>([])
  const [payments, setPayments] = useState<StudentPaymentRecord[]>([])
  const [siteSettings, setSiteSettings] = useState<SiteSettingsRecord | null>(null)
  const [profile, setProfile] = useState<AdminStudentProfilePhase14 | null>(isDemoMode ? ({ id: 'demo-profile', collectionId: '', collectionName: 'student_profiles', created: '', updated: '', expand: {}, user: 'demo-1', birth_date: '2002-05-14', guardian_name: '', guardian_phone: '', notes_private: 'Prefiere grupos reducidos y práctica oral.', active: true } as AdminStudentProfilePhase14) : null)
  const [level, setLevel] = useState<PlacementAdminStudentLevel | null>(isDemoMode ? ({ studentId: 'demo-1', studentName: 'Emma Martín', email: 'emma@example.com', status: 'ACTIVE', currentLevel: 'B1', currentLevelSource: 'VALIDATED', latestAttempt: null, latestAssessment: null, attemptCount: 2, assessmentCount: 1 }) : null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showAllPayments, setShowAllPayments] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [groupId, setGroupId] = useState('')

  const handleLevelChange = useCallback((currentLevel: PlacementAdminStudentLevel['currentLevel'], currentLevelSource: PlacementAdminStudentLevel['currentLevelSource']) => {
    setLevel((current) => current ? { ...current, currentLevel, currentLevelSource } : current)
  }, [])

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    Promise.all([listAdminUsers('STUDENT'), listAdminUsers('TEACHER'), listAdminGroups(), listAdminEnrollments(), listAdminClasses(), listAdminPayments({ studentId }), getAdminStudentProfilePhase14(studentId), getPlacementAdminOverview()])
      .then(([students, teacherUsers, groupRecords, enrollmentRecords, classRecords, paymentRecords, profileRecord, placement]) => {
        if (!mounted) return
        const found = students.find((item) => item.id === studentId) || null
        setStudent(found); setTeachers(teacherUsers); setGroups(groupRecords); setEnrollments(enrollmentRecords.filter((item) => item.student === studentId)); setClasses(classRecords); setPayments(paymentRecords); setProfile(profileRecord); setLevel(placement.studentLevels.find((item) => item.studentId === studentId) || null)
        if (!found) setError('No se ha encontrado este alumno.')
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar la ficha completa del alumno.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, studentId])

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    void getSiteSettings()
      .then((settings) => { if (mounted) setSiteSettings(settings) })
      .catch(() => { /* El justificante mantiene su bloqueo seguro si falta identidad real. */ })
    return () => { mounted = false }
  }, [isDemoMode])

  const activeEnrollment = enrollments.find((item) => item.status === 'ACTIVE')
  const activeGroup = activeEnrollment ? groups.find((item) => item.id === activeEnrollment.group) || activeEnrollment.expand?.group as AdminGroupRecord | undefined : undefined
  const teacher = teachers.find((item) => item.id === activeGroup?.teacher) || activeGroup?.expand?.teacher
  const groupClasses = activeGroup ? classes.filter((item) => item.group === activeGroup.id) : []
  const nextClass = groupClasses.filter((item) => item.status === 'SCHEDULED' && new Date(item.starts_at).getTime() >= Date.now()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  const modes = useMemo(() => [...new Set(groupClasses.map((item) => item.delivery_mode).filter((value): value is ClassDeliveryMode => value === 'IN_PERSON' || value === 'ONLINE' || value === 'HYBRID'))], [groupClasses])
  const coverage = paymentCoverageUntil(payments)
  const pendingCents = pendingAmountCents(payments)
  const hasOverdue = payments.some((record) => effectivePaymentStatus(record) === 'OVERDUE')
  const hasPending = payments.some((record) => record.status === 'PENDING')
  const paymentState = hasOverdue ? 'Vencido' : hasPending ? 'Pendiente' : coverage >= todayKey() ? 'Al corriente' : payments.length ? 'Pendiente' : 'Sin cobros'
  const sortedPayments = useMemo(() => [...payments].sort((a, b) => (b.paid_at || b.due_date).localeCompare(a.paid_at || a.due_date)), [payments])
  const displayedPayments = showAllPayments ? sortedPayments : sortedPayments.slice(0, 6)
  const paidCents = payments.filter((record) => record.status === 'PAID').reduce((sum, record) => sum + record.amount_cents, 0)
  const overdueCents = payments.filter((record) => effectivePaymentStatus(record) === 'OVERDUE').reduce((sum, record) => sum + record.amount_cents, 0)
  const refundedCents = payments.filter((record) => record.status === 'REFUNDED').reduce((sum, record) => sum + record.amount_cents, 0)

  function receiptAcademy(): PaymentReceiptAcademy {
    const legal = siteSettings?.legal_texts || {}
    return {
      academyName: siteSettings?.academy_name || demoSiteSettings.academyName || 'Language School',
      legalOwnerName: legal.legal_owner_name || '',
      legalTaxId: legal.legal_tax_id || '',
      address: siteSettings?.address || (isDemoMode ? demoSiteSettings.address : ''),
      email: siteSettings?.email || (isDemoMode ? demoSiteSettings.email : ''),
      phone: siteSettings?.phone || (isDemoMode ? demoSiteSettings.phone : ''),
    }
  }

  function exportPaymentHistory() {
    if (!student || sortedPayments.length === 0) return
    downloadPaymentsExcel({
      records: sortedPayments,
      students: [student],
      enrollments,
      periodLabel: `historial-${fullName(student)}`,
    })
    setMessage(`Historial económico completo preparado con ${sortedPayments.length} ${sortedPayments.length === 1 ? 'movimiento' : 'movimientos'}.`)
  }

  function downloadReceipt(record: StudentPaymentRecord) {
    if (!student) return
    const enrollment = enrollments.find((item) => item.id === record.enrollment) || record.expand?.enrollment
    setError(null); setMessage(null)
    try {
      const filename = downloadPaymentReceiptPdf({ record, student, enrollment, academy: receiptAcademy() })
      setMessage(`Justificante PDF preparado: ${filename}`)
    } catch (receiptError) {
      setError(receiptError instanceof Error ? receiptError.message : 'No se ha podido generar el justificante PDF.')
    }
  }

  function openEdit() {
    if (!student) return
    setName(student.name); setSurname(student.surname); setPhone(student.phone || '')
    setBirthDate(profile?.birth_date?.slice(0, 10) || ''); setGuardianName(profile?.guardian_name || ''); setGuardianPhone(profile?.guardian_phone || ''); setNotes(profile?.notes_private || ''); setGroupId(activeEnrollment?.group || '')
    setEditing(true); setMessage(null); setError(null)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!student) return
    setSaving(true); setError(null); setMessage(null)
    const profileActive = student.status === 'ACTIVE'
    if (isDemoMode) {
      setStudent({ ...student, name, surname, phone })
      setProfile({ ...(profile || ({ id: 'demo-profile', collectionId: '', collectionName: 'student_profiles', created: '', updated: '', expand: {}, user: student.id } as AdminStudentProfilePhase14)), birth_date: birthDate, guardian_name: guardianName, guardian_phone: guardianPhone, notes_private: notes, active: profileActive })
      setEditing(false); setSaving(false); setMessage('Ficha actualizada en la demostración.'); return
    }
    try {
      const updatedUser = await updateAdminUser(student, { name: name.trim(), surname: surname.trim(), phone: phone.trim() })
      const updatedProfile = await saveAdminStudentProfilePhase14(student.id, { birthDate, guardianName, guardianPhone, notesPrivate: notes, active: profileActive })
      if (student.status === 'ACTIVE' && groupId && groupId !== activeEnrollment?.group) {
        const targetGroup = groups.find((item) => item.id === groupId)
        if (!targetGroup) throw new Error('Selecciona un grupo válido.')
        const moved = await moveAdminStudentToGroup({ studentId: student.id, currentEnrollment: activeEnrollment, targetGroup })
        setEnrollments((current) => [...current.filter((item) => item.id !== moved.current.id && item.id !== moved.previous?.id), ...(moved.previous ? [moved.previous] : []), moved.current])
      }
      setStudent(updatedUser); setProfile(updatedProfile); setEditing(false); setMessage('Ficha completa del alumno actualizada.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido guardar la ficha.')
    } finally { setSaving(false) }
  }

  async function toggleStatus() {
    if (!student) return
    if (student.status === 'INVITED') {
      setError('La cuenta está pendiente de activación segura. El alumno debe completar la invitación para elegir su contraseña.')
      return
    }
    const next = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    if (!window.confirm(`${next === 'ACTIVE' ? '¿Activar' : '¿Desactivar'} la cuenta de ${fullName(student)}?`)) return
    if (isDemoMode) { setStudent({ ...student, status: next }); return }
    try { const updated = await updateAdminUser(student, { status: next }); setStudent(updated); setMessage(next === 'ACTIVE' ? 'Alumno activado.' : 'Alumno desactivado.') } catch { setError('No se ha podido cambiar el estado.') }
  }

  if (!loading && !student) {
    return <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}><div className="dashboard-content"><PortalEmptyState title="Alumno no encontrado" description="Vuelve al directorio y selecciona otro alumno." /><button className="button" type="button" onClick={() => navigate('/admin/alumnos')}>Volver a alumnos</button></div></DashboardShell>
  }

  const groupContextPath = activeGroup ? `/admin/cursos?grupo=${encodeURIComponent(activeGroup.id)}` : ''
  const classContextPath = activeGroup
    ? nextClass
      ? `/admin/clases?grupo=${encodeURIComponent(activeGroup.id)}&clase=${encodeURIComponent(nextClass.id)}`
      : `/admin/clases?grupo=${encodeURIComponent(activeGroup.id)}`
    : ''

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page phase14-profile-page">
        <div className="phase14-back-row"><Link to="/admin/alumnos">← Volver a alumnos</Link></div>
        <header className="phase14-profile-hero phase14-pink-heading">
          <div className="phase14-profile-identity"><span className="phase14-profile-avatar">{initials(student || undefined)}</span><div><span className="eyebrow">FICHA DEL ALUMNO</span><h2>{fullName(student || undefined)}</h2><p>{student?.email || '—'}{student?.phone ? ` · ${student.phone}` : ''}</p></div></div>
          <div className="phase14-profile-actions"><span className={`status ${student?.status === 'ACTIVE' ? 'success' : 'warning'}`}>{accountStatusLabel(student || undefined)}</span><button type="button" onClick={openEdit}>Editar ficha</button>{student?.status !== 'INVITED' && <button className="button button-primary" type="button" onClick={() => void toggleStatus()}>{student?.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>}</div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando ficha…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="phase14-profile-grid">
          <article className="panel phase14-profile-card"><div className="panel-heading"><div><span className="eyebrow">ACADEMIA</span><h3>Matrícula y aprendizaje</h3></div></div><div className="phase14-data-grid">
            <div><span>Curso</span><strong>{activeGroup?.expand?.course?.title && groupContextPath ? <Link to={groupContextPath}>{activeGroup.expand.course.title}</Link> : 'Sin curso'}</strong></div><div><span>Grupo / aula</span><strong>{activeGroup && groupContextPath ? <Link to={groupContextPath}>{activeGroup.name}</Link> : 'Sin grupo'}</strong></div>
            <div><span>Nivel</span><strong>{level?.currentLevel || '—'}</strong><small>{levelSourceLabel(level?.currentLevelSource)}</small></div><div><span>Profesor</span><strong>{teacher ? <Link to={`/admin/profesores/${encodeURIComponent(teacher.id)}`}>{fullName(teacher)}</Link> : 'Sin profesor'}</strong></div>
            <div><span>Modalidad</span><strong>{modes.length ? modes.map(modeLabel).join(' · ') : 'Sin definir'}</strong></div><div><span>Próxima clase</span><strong>{activeGroup && classContextPath ? <Link to={classContextPath}>{nextClass ? nextClassLabel(nextClass) : 'Ver clases del grupo'}</Link> : 'Sin programar'}</strong></div>
            <div><span>Horario</span><strong>{activeGroup?.schedule_text || 'Sin horario'}</strong></div><div><span>Curso académico</span><strong>{activeGroup?.academic_year || '—'}</strong></div>
          </div></article>

          <article className="panel phase14-profile-card"><div className="panel-heading"><div><span className="eyebrow">CONTACTO</span><h3>Datos personales</h3></div></div><div className="phase14-data-grid">
            <div><span>Email</span><strong>{student?.email || '—'}</strong></div><div><span>Teléfono</span><strong>{student?.phone || 'Sin teléfono'}</strong></div>
            <div><span>Fecha de nacimiento</span><strong>{formatDate(profile?.birth_date)}</strong></div><div><span>Tutor/a</span><strong>{profile?.guardian_name || 'No indicado'}</strong></div>
            <div><span>Teléfono tutor/a</span><strong>{profile?.guardian_phone || 'No indicado'}</strong></div><div><span>Cuenta</span><strong>{accountStateLabel(student || undefined)}</strong></div>
            <div><span>Último acceso</span><strong>{formatLastAccess(student?.last_access_at)}</strong></div>
          </div></article>

          {student && <AdminAccountInvitationCard userId={student.id} accountStatus={student.status} isDemoMode={isDemoMode} />}

          {student && <AdminStudentLevelCard studentId={student.id} targetLevel={activeGroup?.target_level || ''} groupName={activeGroup?.name || ''} isDemoMode={isDemoMode} onCurrentLevelChange={handleLevelChange} />}

          <article className="panel phase14-profile-card phase14-payment-card">
            <div className="panel-heading">
              <div><span className="eyebrow">PAGOS</span><h3>Situación económica</h3></div>
              <div className="payment-heading-actions">
                <button className="button phase14-export-button" type="button" onClick={exportPaymentHistory} disabled={sortedPayments.length === 0}>Descargar historial</button>
                <Link className="student-payment-link" to={`/admin/pagos?alumno=${encodeURIComponent(student?.id || '')}`}>Gestionar pagos</Link>
              </div>
            </div>
            <div className="phase14-payment-summary" aria-label="Resumen económico del alumno">
              <div><span>Estado</span><strong>{paymentState}</strong></div>
              <div><span>Cubierto hasta</span><strong>{coverage ? formatDate(coverage) : 'Sin cobertura'}</strong></div>
              <div><span>Pendiente</span><strong>{euro.format(pendingCents / 100)}</strong></div>
              <div><span>Cobrado</span><strong data-testid="student-payment-paid">{euro.format(paidCents / 100)}</strong></div>
              <div><span>Vencido</span><strong data-testid="student-payment-overdue">{euro.format(overdueCents / 100)}</strong></div>
              <div><span>Reembolsado</span><strong data-testid="student-payment-refunded">{euro.format(refundedCents / 100)}</strong></div>
            </div>
            <div id="student-payment-history-list" className="phase14-payment-history" data-testid="student-payment-history">
              {displayedPayments.map((record) => {
                const enrollment = enrollments.find((item) => item.id === record.enrollment) || record.expand?.enrollment
                const group = enrollment?.expand?.group
                const effective = effectivePaymentStatus(record)
                return <div key={record.id}>
                  <span>
                    <strong>{record.billing_mode === 'INTENSIVE' ? 'Intensivo' : 'Mensual'}{group?.name ? ` · ${group.name}` : ''}</strong>
                    <small>{group?.expand?.course?.title ? `${group.expand.course.title} · ` : ''}{formatDate(record.period_start)} → {formatDate(record.period_end)}</small>
                  </span>
                  <b>{euro.format(record.amount_cents / 100)}</b>
                  <span className="payment-record-actions">
                    <i className={`payment-state ${effective.toLowerCase()}`}>{paymentStatusLabel(record)}</i>
                    {record.status === 'PAID' && <button type="button" onClick={() => downloadReceipt(record)} aria-label={`Justificante de ${formatDate(record.paid_at)} por ${euro.format(record.amount_cents / 100)}`}>Justificante</button>}
                  </span>
                </div>
              })}
              {displayedPayments.length === 0 && <small>Sin pagos registrados todavía.</small>}
            </div>
            {sortedPayments.length > 6 && <button className="button phase14-export-button" type="button" onClick={() => setShowAllPayments((current) => !current)} aria-expanded={showAllPayments} aria-controls="student-payment-history-list">
              {showAllPayments ? 'Mostrar los 6 más recientes' : `Ver historial completo (${sortedPayments.length})`}
            </button>}
          </article>

          <article className="panel phase14-profile-card"><div className="panel-heading"><div><span className="eyebrow">SEGUIMIENTO</span><h3>Notas privadas</h3></div></div><p className="phase14-private-notes">{profile?.notes_private || 'Sin observaciones privadas. Puedes añadirlas desde Editar ficha.'}</p></article>
        </section>

        {editing && <section className="panel phase14-edit-panel"><div className="panel-heading"><div><span className="eyebrow">EDITAR</span><h3>Completar ficha del alumno</h3></div><button type="button" onClick={() => setEditing(false)}>Cerrar</button></div><form className="phase14-form-grid" onSubmit={save}>
          <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Apellidos<input value={surname} onChange={(event) => setSurname(event.target.value)} required /></label>
          <label>Teléfono<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>Fecha de nacimiento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
          <label>Tutor/a<input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label><label>Teléfono tutor/a<input type="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></label>
          <label className="phase14-wide">Grupo / aula<select value={groupId} disabled={student?.status === 'INVITED'} onChange={(event) => setGroupId(event.target.value)}><option value="">Sin grupo activo</option>{groups.filter((group) => group.status === 'ACTIVE').map((group) => <option value={group.id} key={group.id}>{group.expand?.course?.title || 'Curso'} · {group.name} · {group.expand?.teacher ? fullName(group.expand.teacher) : 'Sin profesor'}</option>)}</select>{student?.status === 'INVITED' && <small>El grupo queda fijado hasta que el alumno complete la activación segura.</small>}</label>
          <label className="phase14-wide">Notas privadas<textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Seguimiento, necesidades, observaciones administrativas…" /></label>
          <div className="phase14-form-actions"><button type="button" onClick={() => setEditing(false)}>Cancelar</button><button className="button button-primary" disabled={saving}>{saving ? 'Guardando…' : 'Guardar ficha'}</button></div>
        </form></section>}
      </div>
    </DashboardShell>
  )
}

import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import AdminCourseEditForm from '../../components/AdminCourseEditForm'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { pb } from '../../services/pocketbase/client'
import {
  createAdminCourse,
  createAdminEnrollment,
  createAdminGroup,
  listAdminCourses,
  listAdminEnrollments,
  listAdminGroups,
  listAdminUsers,
  updateAdminCourse,
  updateAdminEnrollmentStatus,
  type AdminEnrollmentRecord,
  type AdminGroupRecord,
} from '../../services/pocketbase/adminAcademic'
import { updateAdminGroup } from '../../services/pocketbase/adminGroupManagement'
import type { CourseRecord, GroupDeliveryMode, GroupTargetLevel } from '../../services/pocketbase/studentPortal'
import type { AppUser } from '../../services/pocketbase/types'
import { adminNav } from './adminNav'

type CreateMode = 'COURSE' | 'GROUP' | 'ENROLLMENT' | null

const groupTargetLevels: GroupTargetLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'MIXED']
const groupDeliveryModes: Array<{ value: GroupDeliveryMode; label: string }> = [
  { value: 'IN_PERSON', label: 'Presencial' },
  { value: 'ONLINE', label: 'Online' },
  { value: 'HYBRID', label: 'Híbrida' },
]

const demoCourses: CourseRecord[] = [
  { id: 'demo-c1', collectionId: '', collectionName: 'courses', created: '', updated: '', expand: {}, title: 'Kids', slug: 'kids', level: 'A1 · A2', description: '', status: 'ACTIVE', public_visible: true },
  { id: 'demo-c2', collectionId: '', collectionName: 'courses', created: '', updated: '', expand: {}, title: 'Adultos', slug: 'adultos', level: 'A1 · A2 · B1', description: '', status: 'ACTIVE', public_visible: true },
]
const demoTeacher: AppUser = { id: 'demo-teacher', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'laura@example.com', name: 'Laura', surname: 'García', role: 'TEACHER', status: 'ACTIVE', phone: '' }
const demoStudent: AppUser = { id: 'demo-student', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'emma@example.com', name: 'Emma', surname: 'Martín', role: 'STUDENT', status: 'ACTIVE', phone: '' }
const demoGroups: AdminGroupRecord[] = [
  { id: 'demo-g1', collectionId: '', collectionName: 'groups', created: '', updated: '', name: 'Kids A2', course: 'demo-c1', teacher: 'demo-teacher', academic_year: '2026/27', schedule_text: 'Lunes y miércoles · 17:00', capacity: 6, target_level: 'A2', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE', expand: { course: demoCourses[0], teacher: demoTeacher } },
  { id: 'demo-g2', collectionId: '', collectionName: 'groups', created: '', updated: '', name: 'Adultos B1', course: 'demo-c2', teacher: 'demo-teacher', academic_year: '2026/27', schedule_text: 'Martes y jueves · 18:00', capacity: 8, target_level: 'B1', default_delivery_mode: 'IN_PERSON', status: 'ACTIVE', expand: { course: demoCourses[1], teacher: demoTeacher } },
]
const demoEnrollment: AdminEnrollmentRecord = { id: 'demo-e1', collectionId: '', collectionName: 'enrollments', created: '', updated: '', expand: { student: demoStudent, group: demoGroups[0] }, student: 'demo-student', group: 'demo-g1', status: 'ACTIVE', joined_at: '2026-08-01T00:00:00Z', ended_at: '' }

function slugify(value: string): string { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }
function userName(user?: AppUser): string { if (!user) return 'Sin asignar'; return [user.name, user.surname].filter(Boolean).join(' ') || user.email }
function groupStatusLabel(status: AdminGroupRecord['status']): string { if (status === 'PAUSED') return 'Pausado'; if (status === 'FINISHED') return 'Finalizado'; if (status === 'CANCELLED') return 'Cancelado'; return 'Activo' }
function courseStatusLabel(status: CourseRecord['status']): string { if (status === 'ARCHIVED') return 'Archivado'; if (status === 'DRAFT') return 'Borrador'; return 'Activo' }
function enrollmentStatusLabel(status: AdminEnrollmentRecord['status']): string { if (status === 'PAUSED') return 'Pausada'; if (status === 'FINISHED') return 'Finalizada'; if (status === 'CANCELLED') return 'Cancelada'; return 'Activa' }
function enrollmentIsClosed(status: AdminEnrollmentRecord['status']): boolean { return status === 'FINISHED' || status === 'CANCELLED' }
function courseCoverUrl(course: CourseRecord): string { return course.cover_image ? pb.files.getURL(course, course.cover_image, { thumb: '600x400' }) : '' }
function targetLevelFromCourse(level: string): GroupTargetLevel { const normalized = level.trim().toUpperCase(); return groupTargetLevels.includes(normalized as GroupTargetLevel) ? normalized as GroupTargetLevel : 'MIXED' }
function deliveryModeLabel(mode: GroupDeliveryMode): string { return groupDeliveryModes.find((item) => item.value === mode)?.label || mode }

export default function AdminCoursesPage() {
  const { isDemoMode } = useAuth()
  const [courses, setCourses] = useState<CourseRecord[]>(isDemoMode ? demoCourses : [])
  const [groups, setGroups] = useState<AdminGroupRecord[]>(isDemoMode ? demoGroups : [])
  const [teachers, setTeachers] = useState<AppUser[]>(isDemoMode ? [demoTeacher] : [])
  const [students, setStudents] = useState<AppUser[]>(isDemoMode ? [demoStudent] : [])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>(isDemoMode ? [demoEnrollment] : [])
  const [mode, setMode] = useState<CreateMode>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(isDemoMode ? demoGroups[0].id : null)
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [coverUploadingId, setCoverUploadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [courseSlug, setCourseSlug] = useState('')
  const [courseLevel, setCourseLevel] = useState('')
  const [courseDescription, setCourseDescription] = useState('')
  const [coursePublic, setCoursePublic] = useState(true)
  const [groupName, setGroupName] = useState('')
  const [groupCourseId, setGroupCourseId] = useState('')
  const [groupTeacherId, setGroupTeacherId] = useState('')
  const [academicYear, setAcademicYear] = useState('2026/27')
  const [scheduleText, setScheduleText] = useState('')
  const [capacity, setCapacity] = useState(8)
  const [groupTargetLevel, setGroupTargetLevel] = useState<GroupTargetLevel>('MIXED')
  const [groupDefaultDeliveryMode, setGroupDefaultDeliveryMode] = useState<GroupDeliveryMode>('IN_PERSON')
  const [enrollmentStudentId, setEnrollmentStudentId] = useState('')
  const [enrollmentGroupId, setEnrollmentGroupId] = useState('')
  const [showGroupEdit, setShowGroupEdit] = useState(false)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupTeacherId, setEditGroupTeacherId] = useState('')
  const [editAcademicYear, setEditAcademicYear] = useState('')
  const [editScheduleText, setEditScheduleText] = useState('')
  const [editCapacity, setEditCapacity] = useState(1)
  const [editTargetLevel, setEditTargetLevel] = useState<GroupTargetLevel>('MIXED')
  const [editDefaultDeliveryMode, setEditDefaultDeliveryMode] = useState<GroupDeliveryMode>('IN_PERSON')
  const [editReassignFutureScheduledClasses, setEditReassignFutureScheduledClasses] = useState(true)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    Promise.all([listAdminCourses(), listAdminGroups(), listAdminUsers('TEACHER'), listAdminUsers('STUDENT'), listAdminEnrollments()])
      .then(([courseRecords, groupRecords, teacherRecords, studentRecords, enrollmentRecords]) => {
        if (!mounted) return
        setCourses(courseRecords); setGroups(groupRecords); setTeachers(teacherRecords); setStudents(studentRecords); setEnrollments(enrollmentRecords)
        if (courseRecords[0]) { setGroupCourseId(courseRecords[0].id); setGroupTargetLevel(targetLevelFromCourse(courseRecords[0].level)) }
        if (teacherRecords[0]) setGroupTeacherId(teacherRecords[0].id)
        if (studentRecords[0]) setEnrollmentStudentId(studentRecords[0].id)
        if (groupRecords[0]) { setEnrollmentGroupId(groupRecords[0].id); setSelectedGroupId(groupRecords[0].id) }
      })
      .catch(() => { if (mounted) setError('No se han podido cargar cursos, grupos y matrículas. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const activeEnrollments = useMemo(() => enrollments.filter((item) => item.status === 'ACTIVE'), [enrollments])
  const activeGroups = useMemo(() => groups.filter((item) => item.status === 'ACTIVE'), [groups])
  const activeTeachers = useMemo(() => teachers.filter((item) => item.status === 'ACTIVE'), [teachers])
  const activeStudents = useMemo(() => students.filter((item) => item.status === 'ACTIVE'), [students])
  const activeCourses = useMemo(() => courses.filter((item) => item.status === 'ACTIVE'), [courses])
  const totalCapacity = useMemo(() => activeGroups.reduce((sum, group) => sum + group.capacity, 0), [activeGroups])
  const occupiedSeats = activeEnrollments.length
  const occupancy = totalCapacity > 0 ? Math.round((occupiedSeats / totalCapacity) * 100) : 0
  const selectedGroup = groups.find((item) => item.id === selectedGroupId) || null
  const selectedGroupEnrollments = useMemo(() => enrollments.filter((item) => item.group === selectedGroupId), [enrollments, selectedGroupId])
  function activeCountForGroup(groupId: string): number { return activeEnrollments.filter((item) => item.group === groupId).length }
  function courseMetrics(courseId: string) { const courseGroups = groups.filter((group) => group.course === courseId && group.status === 'ACTIVE'); const groupIds = new Set(courseGroups.map((group) => group.id)); const seats = activeEnrollments.filter((item) => groupIds.has(item.group)).length; const max = courseGroups.reduce((sum, group) => sum + group.capacity, 0); return { groups: courseGroups.length, seats, capacity: max, occupancy: max > 0 ? Math.round((seats / max) * 100) : 0 } }
  function openMode(nextMode: Exclude<CreateMode, null>) { setMode((current) => current === nextMode ? null : nextMode); setError(null); setMessage(null) }

  async function handleCourseCover(course: CourseRecord, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null); setMessage(null)
    if (isDemoMode) { setMessage(`Portada de ${course.title} preparada en la demo. No se guarda de forma permanente.`); event.target.value = ''; return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('La portada debe ser JPG, PNG o WEBP.'); event.target.value = ''; return }
    if (file.size > 8 * 1024 * 1024) { setError('La portada supera el límite de 8 MB.'); event.target.value = ''; return }
    setCoverUploadingId(course.id)
    try { const data = new FormData(); data.set('cover_image', file); const updated = await pb.collection(course.collectionName || 'courses').update<CourseRecord>(course.id, data); setCourses((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`Portada pública de ${course.title} actualizada correctamente.`) }
    catch { setError(`No se ha podido actualizar la portada de ${course.title}.`) }
    finally { setCoverUploadingId(null); event.target.value = '' }
  }

  async function handleCreateCourse(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); setMessage(null); if (isDemoMode) { setMessage('Curso preparado en la demostración. No se ha guardado ningún cambio real.'); return }; const finalSlug = courseSlug.trim() || slugify(courseTitle); if (!courseTitle.trim() || !finalSlug) { setError('Título y slug son obligatorios.'); return }; setSaving(true); try { const record = await createAdminCourse({ title: courseTitle, slug: finalSlug, level: courseLevel, description: courseDescription, status: 'ACTIVE', publicVisible: coursePublic }); setCourses((current) => [...current, record].sort((a, b) => a.title.localeCompare(b.title, 'es'))); setGroupCourseId((value) => { if (value) return value; setGroupTargetLevel(targetLevelFromCourse(record.level)); return record.id }); setCourseTitle(''); setCourseSlug(''); setCourseLevel(''); setCourseDescription(''); setCoursePublic(true); setMode(null); setMessage('Curso creado correctamente.') } catch (creationError) { setError(creationError instanceof Error ? creationError.message : 'No se ha podido crear el curso.') } finally { setSaving(false) } }
  async function handleCreateGroup(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); setMessage(null); if (isDemoMode) { setMessage('Grupo preparado en la demostración. No se ha guardado ningún cambio real.'); return }; if (!groupCourseId || !groupTeacherId) { setError(activeCourses.length === 0 || activeTeachers.length === 0 ? 'Necesitas al menos un curso activo y un profesor activo antes de crear un grupo.' : 'Selecciona curso y profesor.'); return }; setSaving(true); try { const record = await createAdminGroup({ name: groupName, courseId: groupCourseId, teacherId: groupTeacherId, academicYear, scheduleText, capacity, targetLevel: groupTargetLevel, defaultDeliveryMode: groupDefaultDeliveryMode, status: 'ACTIVE' }); setGroups((current) => [...current, record].sort((a, b) => a.name.localeCompare(b.name, 'es'))); setEnrollmentGroupId((value) => value || record.id); setSelectedGroupId(record.id); setGroupName(''); setScheduleText(''); setMode(null); setMessage('Grupo creado correctamente.') } catch { setError('No se ha podido crear el grupo.') } finally { setSaving(false) } }
  async function handleEnrollment(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(null); setMessage(null); if (isDemoMode) { setMessage('Matrícula preparada en la demostración. No se ha guardado ningún cambio real.'); return }; if (!enrollmentStudentId || !enrollmentGroupId) { setError('Selecciona alumno y grupo.'); return }; setSaving(true); try { const record = await createAdminEnrollment({ studentId: enrollmentStudentId, groupId: enrollmentGroupId }); setEnrollments((current) => [record, ...current]); setMode(null); setMessage('Alumno matriculado correctamente.') } catch { setError('No se ha podido crear la matrícula.') } finally { setSaving(false) } }
  async function toggleCourse(course: CourseRecord) { if (isDemoMode) { setMessage('Cambio de curso preparado en la demostración.'); return }; try { const updated = await updateAdminCourse(course, { status: course.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' }); setCourses((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`Curso ${course.status === 'ACTIVE' ? 'archivado' : 'reactivado'}.`) } catch { setError('No se ha podido cambiar el estado del curso.') } }
  function handleCourseSaved(updated: CourseRecord) { setCourses((current) => current.map((item) => item.id === updated.id ? updated : item).sort((a, b) => a.title.localeCompare(b.title, 'es'))); setGroups((current) => current.map((group) => group.course === updated.id ? { ...group, expand: { ...group.expand, course: updated } } : group)); setEditingCourseId(null); setError(null); setMessage(isDemoMode ? 'Cambios del curso preparados en la demostración.' : 'Curso actualizado correctamente. Los grupos y matrículas se conservan.') }
  async function toggleGroup(group: AdminGroupRecord) { if (isDemoMode) { setMessage('Cambio de grupo preparado en la demostración.'); return }; try { const updated = await updateAdminGroup(group, { status: group.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' }); setGroups((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`Grupo ${group.status === 'ACTIVE' ? 'pausado' : 'reactivado'}.`) } catch { setError('No se ha podido cambiar el estado del grupo.') } }
  function openGroupEdit() {
    if (!selectedGroup) return
    setEditGroupName(selectedGroup.name)
    setEditGroupTeacherId(selectedGroup.teacher)
    setEditAcademicYear(selectedGroup.academic_year)
    setEditScheduleText(selectedGroup.schedule_text || '')
    setEditCapacity(selectedGroup.capacity)
    setEditTargetLevel(selectedGroup.target_level)
    setEditDefaultDeliveryMode(selectedGroup.default_delivery_mode)
    setEditReassignFutureScheduledClasses(true)
    setShowGroupEdit(true)
    setError(null)
    setMessage(null)
  }
  async function saveGroupEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedGroup) return
    const activeCount = activeCountForGroup(selectedGroup.id)
    const teacher = activeTeachers.find((item) => item.id === editGroupTeacherId)
    if (!editGroupName.trim() || !teacher || !editAcademicYear.trim()) {
      setError('Completa el nombre, el profesor activo y el curso académico.')
      return
    }
    if (!Number.isInteger(editCapacity) || editCapacity < activeCount || editCapacity < 1) {
      setError(`La capacidad no puede ser inferior a las ${activeCount} matrículas activas del grupo.`)
      return
    }

    const teacherChanged = teacher.id !== selectedGroup.teacher
    const confirmation = teacherChanged
      ? editReassignFutureScheduledClasses
        ? `¿Guardar los cambios del grupo "${selectedGroup.name}"? Las clases SCHEDULED futuras se reasignarán al nuevo profesor. El histórico COMPLETED/CANCELLED y las clases programadas ya pasadas conservarán su profesor.`
        : `¿Guardar los cambios del grupo "${selectedGroup.name}"? Las clases futuras ya programadas conservarán el profesor que ya tienen. Las nuevas clases heredarán el nuevo profesor del grupo.`
      : `¿Guardar los cambios del grupo "${selectedGroup.name}"? Las matrículas y el histórico de clases se conservan.`
    if (!window.confirm(confirmation)) return

    if (isDemoMode) {
      setShowGroupEdit(false)
      setMessage('Cambios del grupo preparados en la demostración. No se ha guardado ningún cambio real.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await updateAdminGroup(selectedGroup, {
        name: editGroupName.trim(),
        teacher: teacher.id,
        academic_year: editAcademicYear.trim(),
        schedule_text: editScheduleText.trim(),
        capacity: editCapacity,
        target_level: editTargetLevel,
        default_delivery_mode: editDefaultDeliveryMode,
      }, teacherChanged ? { reassignFutureScheduledClasses: editReassignFutureScheduledClasses } : undefined)
      setGroups((current) => current.map((item) => item.id === updated.id ? updated : item))
      setEnrollments((current) => current.map((item) => item.group === updated.id ? { ...item, expand: { ...item.expand, group: updated } } : item))
      setShowGroupEdit(false)
      setMessage(teacherChanged
        ? editReassignFutureScheduledClasses
          ? 'Grupo actualizado. Las clases futuras programadas pasan al nuevo profesor; el histórico permanece intacto.'
          : 'Grupo actualizado. Las clases futuras ya programadas conservan su profesor; las nuevas clases heredarán el nuevo profesor del grupo.'
        : 'Grupo actualizado correctamente. La modalidad por defecto no ha modificado clases ya registradas.')
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se ha podido actualizar el grupo.')
    } finally {
      setSaving(false)
    }
  }
  async function changeEnrollment(record: AdminEnrollmentRecord, status: AdminEnrollmentRecord['status']) { setError(null); setMessage(null); const student = record.expand?.student || students.find((item) => item.id === record.student); const action = status === 'ACTIVE' ? 'reactivar' : status === 'PAUSED' ? 'pausar' : status === 'FINISHED' ? 'finalizar' : 'cancelar'; if (!window.confirm(`¿Quieres ${action} la matrícula de ${userName(student)}?`)) return; if (isDemoMode) { setMessage(`Cambio de matrícula preparado en la demostración: ${enrollmentStatusLabel(status).toLowerCase()}.`); return }; try { const updated = await updateAdminEnrollmentStatus(record, status); setEnrollments((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage(`Matrícula ${enrollmentStatusLabel(status).toLowerCase()}.`) } catch { setError('No se ha podido cambiar el estado de la matrícula.') } }

  const noGroupPrerequisites = !loading && (activeCourses.length === 0 || activeTeachers.length === 0)
  const noEnrollmentPrerequisites = !loading && (activeStudents.length === 0 || activeGroups.length === 0)

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading"><div><span className="eyebrow">PLATAFORMA · CURSOS</span><h2>Cursos, grupos y matrículas</h2><p>Gestiona programas, portadas públicas, profesores, plazas y alumnos matriculados desde la estructura académica central.</p></div><div className="admin-academic-header-actions"><button className="button button-ghost" type="button" onClick={() => openMode('ENROLLMENT')}>+ Matrícula</button><button className="button button-ghost" type="button" onClick={() => openMode('GROUP')}>+ Grupo</button><button className="button button-primary" type="button" onClick={() => openMode('COURSE')}>+ Curso</button></div></header>
        {loading && <div className="cms-notice" role="status">Cargando estructura académica…</div>}{message && <div className="cms-notice success-notice" role="status">{message}</div>}{error && <div className="cms-notice auth-error" role="alert">{error}</div>}
        {mode === 'COURSE' && <section className="panel admin-inline-create"><div className="panel-heading"><div><span className="eyebrow">CURSO</span><h3>Nuevo programa</h3></div><span className="status info">Programa académico</span></div><form className="admin-create-grid" onSubmit={handleCreateCourse}><div><label>Título</label><input value={courseTitle} onChange={(e) => { setCourseTitle(e.target.value); if (!courseSlug) setCourseSlug(slugify(e.target.value)) }} required /></div><div><label>Slug</label><input value={courseSlug} onChange={(e) => setCourseSlug(slugify(e.target.value))} placeholder="adultos-b1" required /></div><div><label>Nivel/es</label><input value={courseLevel} onChange={(e) => setCourseLevel(e.target.value)} placeholder="A2 · B1" /></div><div><label>Visibilidad</label><select value={coursePublic ? 'PUBLIC' : 'PRIVATE'} onChange={(e) => setCoursePublic(e.target.value === 'PUBLIC')}><option value="PUBLIC">Visible en web</option><option value="PRIVATE">Solo plataforma</option></select></div><div className="admin-create-wide"><label>Descripción</label><textarea rows={3} value={courseDescription} onChange={(e) => setCourseDescription(e.target.value)} /></div><div className="admin-create-action"><button className="button button-primary" disabled={saving} type="submit">{saving ? 'Creando…' : 'Crear curso'}</button></div></form></section>}
        {mode === 'GROUP' && <section className="panel admin-inline-create"><div className="panel-heading"><div><span className="eyebrow">GRUPO</span><h3>Nuevo grupo</h3></div><span className="status info">Profesor obligatorio</span></div>{noGroupPrerequisites && <PortalEmptyState compact title="Faltan datos para crear un grupo" description="Crea o activa al menos un curso y un profesor antes de continuar." />}<form className="admin-create-grid" onSubmit={handleCreateGroup}><div><label>Nombre</label><input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Adultos B1 · Tarde" required disabled={noGroupPrerequisites} /></div><div><label>Curso</label><select value={groupCourseId} onChange={(e) => { const courseId = e.target.value; setGroupCourseId(courseId); const course = activeCourses.find((item) => item.id === courseId); if (course) setGroupTargetLevel(targetLevelFromCourse(course.level)) }} required disabled={noGroupPrerequisites}><option value="">Selecciona curso</option>{activeCourses.map((course) => <option value={course.id} key={course.id}>{course.title} · {course.level || 'sin nivel'}</option>)}</select></div><div><label>Nivel objetivo</label><select value={groupTargetLevel} onChange={(e) => setGroupTargetLevel(e.target.value as GroupTargetLevel)} required disabled={noGroupPrerequisites}>{groupTargetLevels.map((level) => <option key={level} value={level}>{level === 'MIXED' ? 'Mixto / multinivel' : level}</option>)}</select></div><div><label>Modalidad por defecto</label><select value={groupDefaultDeliveryMode} onChange={(e) => setGroupDefaultDeliveryMode(e.target.value as GroupDeliveryMode)} required disabled={noGroupPrerequisites}>{groupDeliveryModes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label>Profesor</label><select value={groupTeacherId} onChange={(e) => setGroupTeacherId(e.target.value)} required disabled={noGroupPrerequisites}><option value="">Selecciona profesor</option>{activeTeachers.map((teacher) => <option value={teacher.id} key={teacher.id}>{userName(teacher)}</option>)}</select></div><div><label>Curso académico</label><input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required disabled={noGroupPrerequisites} /></div><div><label>Horario</label><input value={scheduleText} onChange={(e) => setScheduleText(e.target.value)} placeholder="Martes y jueves · 18:00" disabled={noGroupPrerequisites} /></div><div><label>Capacidad</label><input type="number" min={1} max={100} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} required disabled={noGroupPrerequisites} /></div><div className="admin-create-action"><button className="button button-primary" disabled={saving || noGroupPrerequisites} type="submit">{saving ? 'Creando…' : 'Crear grupo'}</button></div></form></section>}
        {mode === 'ENROLLMENT' && <section className="panel admin-inline-create"><div className="panel-heading"><div><span className="eyebrow">MATRÍCULA</span><h3>Asignar alumno a grupo</h3></div><span className="status success">Histórico conservado</span></div>{noEnrollmentPrerequisites && <PortalEmptyState compact title="Faltan datos para matricular" description="Necesitas al menos un alumno activo y un grupo activo antes de crear una matrícula." />}<form className="admin-create-grid" onSubmit={handleEnrollment}><div><label>Alumno</label><select value={enrollmentStudentId} onChange={(e) => setEnrollmentStudentId(e.target.value)} required disabled={noEnrollmentPrerequisites}><option value="">Selecciona alumno</option>{activeStudents.map((student) => <option key={student.id} value={student.id}>{userName(student)}</option>)}</select></div><div><label>Grupo</label><select value={enrollmentGroupId} onChange={(e) => setEnrollmentGroupId(e.target.value)} required disabled={noEnrollmentPrerequisites}><option value="">Selecciona grupo</option>{activeGroups.map((group) => <option key={group.id} value={group.id}>{group.name} · {activeCountForGroup(group.id)}/{group.capacity}</option>)}</select></div><div className="admin-create-action"><button className="button button-primary" disabled={saving || noEnrollmentPrerequisites} type="submit">{saving ? 'Matriculando…' : 'Matricular alumno'}</button></div></form></section>}
        <section className="metric-grid"><article><span>Programas</span><strong>{courses.length}</strong><small>{activeCourses.length} activos</small></article><article><span>Grupos activos</span><strong>{activeGroups.length}</strong><small>{groups.length} totales</small></article><article><span>Plazas ocupadas</span><strong>{occupiedSeats}</strong><small>De {totalCapacity} disponibles</small></article><article><span>Ocupación</span><strong>{occupancy}%</strong><small>Matrículas activas</small></article></section>
        <div className="admin-course-workspace"><section className="course-admin-grid">{courses.map((course, index) => { const metrics = courseMetrics(course.id); const cover = courseCoverUrl(course); return <article className={`panel course-admin-card ${course.status === 'ARCHIVED' ? 'course-archived' : ''}`} key={course.id}><div className="course-card-number">{String(index + 1).padStart(2, '0')}</div><div className="admin-course-cover" style={cover ? { backgroundImage: `url(${cover})` } : undefined}>{!cover && <span>PORTADA</span>}<label className="admin-course-cover-action">{coverUploadingId === course.id ? 'Subiendo…' : cover ? 'Cambiar imagen' : 'Añadir imagen'}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={coverUploadingId !== null} onChange={(event) => void handleCourseCover(course, event)} /></label></div><span className="eyebrow">{courseStatusLabel(course.status).toUpperCase()}</span><h3>{course.title}</h3><p>{course.level || 'Nivel sin definir'}</p><div className="course-capacity"><div><span>Ocupación</span><strong>{metrics.seats}/{metrics.capacity}</strong></div><div className="progress-line"><span style={{ width: `${Math.min(metrics.occupancy, 100)}%` }} /></div></div><dl><div><dt>Grupos activos</dt><dd>{metrics.groups}</dd></div><div><dt>Web pública</dt><dd>{course.public_visible ? 'Sí' : 'No'}</dd></div></dl><div className="course-card-actions"><button type="button" onClick={() => { setEditingCourseId((current) => current === course.id ? null : course.id); setError(null); setMessage(null) }}>{editingCourseId === course.id ? 'Cerrar edición' : 'Editar curso'}</button><button type="button" onClick={() => { const first = groups.find((group) => group.course === course.id); if (first) setSelectedGroupId(first.id) }}>Ver grupos</button><button type="button" onClick={() => void toggleCourse(course)}>{course.status === 'ACTIVE' ? 'Archivar' : 'Reactivar'}</button></div>{editingCourseId === course.id && <AdminCourseEditForm course={course} allCourses={courses} demo={isDemoMode} onSaved={handleCourseSaved} onCancel={() => setEditingCourseId(null)} />}</article> })}{!loading && courses.length === 0 && <PortalEmptyState title="Todavía no hay cursos" description="Crea el primer programa académico para poder formar grupos y matricular alumnos." />}</section>
        <section className="panel groups-overview-panel"><div className="panel-heading"><div><span className="eyebrow">GRUPOS</span><h3>Grupos y ocupación</h3></div><span className="status info">{groups.length}</span></div>{groups.map((group) => { const count = activeCountForGroup(group.id); const teacher = group.expand?.teacher || teachers.find((item) => item.id === group.teacher); const course = group.expand?.course || courses.find((item) => item.id === group.course); return <button className={`group-row admin-group-row ${selectedGroupId === group.id ? 'selected' : ''}`} type="button" key={group.id} onClick={() => setSelectedGroupId(group.id)}><span className="group-code">{group.target_level}</span><div><strong>{group.name}</strong><small>{course?.title || 'Curso'} · {userName(teacher)} · {deliveryModeLabel(group.default_delivery_mode)}</small></div><span>{group.schedule_text || 'Sin horario'}</span><span>{count}/{group.capacity} alumnos</span><span className={`status ${group.status === 'ACTIVE' ? 'success' : 'warning'}`}>{groupStatusLabel(group.status)}</span></button> })}{!loading && groups.length === 0 && <PortalEmptyState compact title="Todavía no hay grupos" description="Crea un grupo después de tener al menos un curso y un profesor activos." />}</section></div>
        {selectedGroup && <section className="panel admin-enrollment-panel"><div className="panel-heading"><div><span className="eyebrow">MATRÍCULAS · {selectedGroup.name}</span><h3>Alumnos del grupo</h3></div><div className="admin-group-actions"><button type="button" onClick={openGroupEdit}>Editar grupo</button><button type="button" onClick={() => void toggleGroup(selectedGroup)}>{selectedGroup.status === 'ACTIVE' ? 'Pausar grupo' : 'Reactivar grupo'}</button><span className="status info">{selectedGroup.target_level} · {deliveryModeLabel(selectedGroup.default_delivery_mode)} · {activeCountForGroup(selectedGroup.id)}/{selectedGroup.capacity}</span></div></div>{showGroupEdit && <form className="admin-create-grid class-edit-form" onSubmit={saveGroupEdit}><div><label>Nombre del grupo</label><input value={editGroupName} onChange={(event) => setEditGroupName(event.target.value)} required /></div><div><label>Profesor</label><select value={editGroupTeacherId} onChange={(event) => setEditGroupTeacherId(event.target.value)} required>{activeTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{userName(teacher)}</option>)}</select></div><div><label>Nivel objetivo</label><select value={editTargetLevel} onChange={(event) => setEditTargetLevel(event.target.value as GroupTargetLevel)} required>{groupTargetLevels.map((level) => <option key={level} value={level}>{level === 'MIXED' ? 'Mixto / multinivel' : level}</option>)}</select></div><div><label>Modalidad por defecto</label><select value={editDefaultDeliveryMode} onChange={(event) => setEditDefaultDeliveryMode(event.target.value as GroupDeliveryMode)} required>{groupDeliveryModes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div><label>Curso académico</label><input value={editAcademicYear} onChange={(event) => setEditAcademicYear(event.target.value)} required /></div><div><label>Horario</label><input value={editScheduleText} onChange={(event) => setEditScheduleText(event.target.value)} placeholder="Martes y jueves · 18:00" /></div><div><label>Capacidad</label><input type="number" min={activeCountForGroup(selectedGroup.id)} max={100} value={editCapacity} onChange={(event) => setEditCapacity(Number(event.target.value))} required /></div>{editGroupTeacherId !== selectedGroup.teacher && <div className="admin-create-wide cms-notice"><label><input type="checkbox" checked={editReassignFutureScheduledClasses} onChange={(event) => setEditReassignFutureScheduledClasses(event.target.checked)} /> <span><strong>Reasignar clases futuras programadas al nuevo profesor</strong><br /><small>Recomendado. Solo afecta a clases SCHEDULED futuras; las completadas, canceladas y programadas ya pasadas conservan su profesor histórico.</small></span></label></div>}<div className="admin-create-wide cms-notice"><small>La modalidad por defecto solo se aplica a nuevas clases. Las clases ya registradas mantienen su modalidad, incluido cualquier override intencional.</small></div><div className="admin-create-action"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar grupo'}</button><button className="button button-ghost" type="button" disabled={saving} onClick={() => setShowGroupEdit(false)}>Cancelar</button></div></form>}<div className="admin-enrollment-list">{selectedGroupEnrollments.map((record) => { const student = record.expand?.student || students.find((item) => item.id === record.student); return <div className="admin-enrollment-row" key={record.id}><div><strong>{userName(student)}</strong><small>{student?.email || 'Alumno'}</small></div><span className={`status ${record.status === 'ACTIVE' ? 'success' : 'warning'}`}>{enrollmentStatusLabel(record.status)}</span>{enrollmentIsClosed(record.status) ? <small>Histórico cerrado</small> : <select aria-label={`Estado de matrícula de ${userName(student)}`} value={record.status} onChange={(event) => void changeEnrollment(record, event.target.value as AdminEnrollmentRecord['status'])}><option value="ACTIVE">Activa</option><option value="PAUSED">Pausada</option><option value="FINISHED">Finalizada</option><option value="CANCELLED">Cancelada</option></select>}</div> })}{selectedGroupEnrollments.length === 0 && <PortalEmptyState compact title="Grupo sin alumnos" description="Todavía no hay matrículas asociadas a este grupo." />}</div></section>}
      </div>
    </DashboardShell>
  )
}

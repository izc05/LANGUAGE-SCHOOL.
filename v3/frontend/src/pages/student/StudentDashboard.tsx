import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import { getStudentDashboardSnapshot, type AssignmentRecord, type ClassDeliveryMode, type ClassRecord, type EnrollmentRecord, type MaterialRecord, type NotificationRecord, type StudentFileRecord, type SubmissionRecord } from '../../services/pocketbase/studentPortal'
import { studentNav } from './studentNav'

type Snapshot = Awaited<ReturnType<typeof getStudentDashboardSnapshot>>

function formatClassDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Próximamente'
  return new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatShortDate(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}

function classMode(record?: ClassRecord): ClassDeliveryMode {
  return record?.delivery_mode || 'IN_PERSON'
}

function classModeLabel(mode: ClassDeliveryMode): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

function extensionLabel(filename: string): string { return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE' }

function PendingTask({ assignment, submitted }: { assignment: AssignmentRecord; submitted: boolean }) {
  return <div className="task-item"><span className="task-icon">T</span><div><strong>{assignment.title}</strong><small>{assignment.due_at ? `Entrega · ${formatShortDate(assignment.due_at)}` : 'Sin fecha límite'}</small></div><span className={`status ${submitted ? 'success' : 'warning'}`}>{submitted ? 'Entregada' : 'Pendiente'}</span></div>
}

function MaterialItem({ material }: { material: MaterialRecord }) {
  return <div><span>{extensionLabel(material.file)}</span><div><strong>{material.title}</strong><small>{material.visibility === 'STUDENT' ? 'Material personal' : material.visibility === 'GROUP' ? 'Material del grupo' : 'Material del curso'}</small></div></div>
}

function FileItem({ file }: { file: StudentFileRecord }) {
  return <div><span>{extensionLabel(file.file)}</span><div><strong>{file.title}</strong><small>{file.category} · {formatShortDate(file.created)}</small></div></div>
}

function NoticeItem({ notice }: { notice: NotificationRecord }) {
  return <div className="task-item"><span className="task-icon">N</span><div><strong>{notice.title}</strong><small>{notice.body}</small></div><span className={`status ${notice.read_at ? 'success' : 'info'}`}>{notice.read_at ? 'Leído' : 'Nuevo'}</span></div>
}

function CampusNextAction({ to, eyebrow, title, meta, state, stateTone = 'info' }: { to: string; eyebrow: string; title: string; meta: string; state: string; stateTone?: 'info' | 'warning' | 'success' }) {
  return (
    <Link className="campus10-action-card" to={to}>
      <div className="campus10-action-top"><span className="eyebrow">{eyebrow}</span><span className={`status ${stateTone}`}>{state}</span></div>
      <strong>{title}</strong>
      <p>{meta}</p>
      <span className="campus10-action-link">Abrir →</span>
    </Link>
  )
}

function DemoStudentDashboard() {
  return (
    <DashboardShell role="Alumno" name="Emma" nav={[...studentNav]}>
      <div className="dashboard-content student-dashboard-premium student-campus-home campus10-home">
        <section className="campus10-hero" aria-labelledby="campus-home-title">
          <div className="campus10-intro">
            <span className="eyebrow">TU CAMPUS</span>
            <h2 id="campus-home-title">Hoy, empieza <em>por aquí.</em></h2>
            <p>Tu próxima clase y el trabajo que necesita atención están primero. Todo lo demás sigue a un clic.</p>
            <div className="campus10-context" aria-label="Resumen académico">
              <span><small>CURSO</small><strong>Adult English B1</strong></span>
              <span><small>GRUPO</small><strong>B1 Evening</strong></span>
              <Link to="/alumno/nivel"><small>NIVEL DEL CURSO</small><strong>B1</strong></Link>
            </div>
          </div>

          <article className="campus-next-class campus10-next-class">
            <div className="campus-next-class-top"><span>PRÓXIMA CLASE</span><span className="status info">Programada</span></div>
            <strong>Jueves · 18:00</strong>
            <h3>Travel & experiences</h3>
            <p>Adult English B1 · B1 Evening</p>
            <div className="campus-next-delivery"><span className="class-mode class-mode-hybrid">Híbrida</span><span>📍 Aula 2</span></div>
            <div className="campus10-class-actions">
              <Link className="button button-primary campus-online-entry" to="/alumno/aula/demo-u1">Entrar al aula online →</Link>
              <Link className="campus-text-link" to="/alumno/clases">Ver agenda</Link>
            </div>
          </article>
        </section>

        <section className="campus10-next" aria-labelledby="campus10-next-title">
          <div className="campus10-section-heading"><div><span className="eyebrow">LO SIGUIENTE</span><h3 id="campus10-next-title">Lo que necesita tu atención</h3></div><p>Empieza por la primera tarjeta y continúa desde ahí.</p></div>
          <div className="campus10-action-grid">
            <CampusNextAction to="/alumno/tareas" eyebrow="SIGUIENTE TAREA" title="Writing · My last trip" meta="Entrega · viernes" state="Pendiente" stateTone="warning" />
            <CampusNextAction to="/alumno/material" eyebrow="MATERIAL RECIENTE" title="Unit 04 · Travel" meta="Ficha principal de vocabulario y speaking" state="Nuevo" />
            <CampusNextAction to="/alumno/avisos" eyebrow="AVISOS" title="2 comunicaciones sin leer" meta="Novedades de la academia y tu curso" state="2 nuevos" />
          </div>
        </section>

        <section className="campus-course-strip campus10-course-strip">
          <div><span className="eyebrow">TU CURSO ACTUAL</span><h3>Adult English B1</h3><p>B1 Evening · Matrícula activa</p></div>
          <div className="campus-level"><strong>B1</strong><span>Nivel del curso</span></div>
          <div className="campus-course-links"><Link to="/alumno/nivel">Mi nivel</Link><Link to="/alumno/clases">Mis clases</Link><Link to="/alumno/material">Material</Link><Link to="/alumno/archivos">Mis archivos</Link></div>
        </section>
      </div>
    </DashboardShell>
  )
}

function ConnectedStudentDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getStudentDashboardSnapshot().then((result) => { if (mounted) setSnapshot(result) }).catch(() => { if (mounted) setError('No se ha podido cargar tu espacio. Prueba de nuevo en unos segundos.') }).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const submittedAssignmentIds = useMemo(() => new Set((snapshot?.submissions || []).map((submission: SubmissionRecord) => submission.assignment)), [snapshot?.submissions])
  const activeEnrollments = (snapshot?.enrollments || []).filter((enrollment: EnrollmentRecord) => enrollment.status === 'ACTIVE')
  const nextClass: ClassRecord | undefined = snapshot?.upcomingClasses[0]
  const nextMode = classMode(nextClass)
  const currentEnrollment = activeEnrollments[0]
  const currentCourse = currentEnrollment?.expand?.group?.expand?.course
  const currentGroup = currentEnrollment?.expand?.group
  const courseLevel = currentCourse?.level || '—'
  const currentCourseTitle = currentCourse?.title || currentCourse?.level || 'Tu curso de inglés'
  const currentGroupName = currentGroup?.name || 'Grupo asignado'
  const enrollmentSummary = currentEnrollment ? `${currentCourseTitle} · ${currentGroupName} · Matrícula activa` : 'Cuando tengas una matrícula activa aparecerá aquí tu curso.'
  const pendingAssignments = (snapshot?.assignments || []).filter((assignment: AssignmentRecord) => !submittedAssignmentIds.has(assignment.id) && assignment.status !== 'CLOSED')
  const nextAssignment = pendingAssignments[0]
  const unreadNotifications = (snapshot?.notifications || []).filter((notice: NotificationRecord) => !notice.read_at)
  const recentMaterials = snapshot?.materials || []
  const recentMaterial = recentMaterials[0]
  const canOpenOnlineClass = Boolean(nextClass && nextMode !== 'IN_PERSON' && nextClass.online_join_url)

  return (
    <DashboardShell role="Alumno" name="Alumno" nav={[...studentNav]}>
      <div className="dashboard-content student-dashboard-premium student-campus-home campus10-home">
        {loading && <div className="cms-notice" role="status">Cargando tu campus…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
        {!loading && !error && (
          <>
            <section className="campus10-hero" aria-labelledby="campus-home-title">
              <div className="campus10-intro">
                <span className="eyebrow">TU CAMPUS</span>
                <h2 id="campus-home-title">Hoy, empieza <em>por aquí.</em></h2>
                <p>{currentEnrollment ? 'Tu próxima clase y el trabajo que necesita atención están primero. Todo lo demás sigue a un clic.' : 'Tu espacio ya está preparado. Cuando la academia active tu matrícula, aquí aparecerá tu ruta de trabajo.'}</p>
                <div className="campus10-context" aria-label="Resumen académico">
                  <span><small>CURSO</small><strong>{currentCourseTitle}</strong></span>
                  <span><small>GRUPO</small><strong>{currentGroupName}</strong></span>
                  <Link to="/alumno/nivel"><small>NIVEL DEL CURSO</small><strong>{courseLevel}</strong></Link>
                </div>
              </div>

              <article className="campus-next-class campus10-next-class">
                <div className="campus-next-class-top"><span>PRÓXIMA CLASE</span><span className={`status ${nextClass ? 'info' : 'success'}`}>{nextClass ? 'Programada' : 'Agenda al día'}</span></div>
                <strong>{nextClass ? formatClassDate(nextClass.starts_at) : 'Sin clases programadas'}</strong>
                <h3>{nextClass?.topic || currentCourseTitle}</h3>
                <p>{nextClass ? `${nextClass.expand?.group?.expand?.course?.title || currentCourseTitle} · ${nextClass.expand?.group?.name || currentGroupName}` : enrollmentSummary}</p>
                {nextClass && <div className="campus-next-delivery"><span className={`class-mode class-mode-${nextMode.toLowerCase()}`}>{classModeLabel(nextMode)}</span>{nextMode !== 'ONLINE' && <span>📍 {nextClass.location_text || 'Aula pendiente'}</span>}</div>}
                <div className="campus10-class-actions">
                  {canOpenOnlineClass && nextClass
                    ? <Link className="button button-primary campus-online-entry" to={`/alumno/aula/${encodeURIComponent(nextClass.id)}`}>Entrar al aula online →</Link>
                    : nextClass && nextMode !== 'IN_PERSON'
                      ? <span className="campus-online-pending">Acceso online pendiente</span>
                      : null}
                  <Link className="campus-text-link" to="/alumno/clases">{nextClass ? 'Ver agenda' : 'Abrir Mis clases'} →</Link>
                </div>
              </article>
            </section>

            <section className="campus10-next" aria-labelledby="campus10-next-title">
              <div className="campus10-section-heading"><div><span className="eyebrow">LO SIGUIENTE</span><h3 id="campus10-next-title">Lo que necesita tu atención</h3></div><p>Empieza por la primera tarjeta pendiente y continúa desde ahí.</p></div>
              <div className="campus10-action-grid">
                <CampusNextAction
                  to="/alumno/tareas"
                  eyebrow="SIGUIENTE TAREA"
                  title={nextAssignment?.title || 'Todo al día'}
                  meta={nextAssignment ? (nextAssignment.due_at ? `Entrega · ${formatShortDate(nextAssignment.due_at)}` : 'Sin fecha límite') : 'No tienes entregas pendientes ahora mismo.'}
                  state={nextAssignment ? 'Pendiente' : 'Al día'}
                  stateTone={nextAssignment ? 'warning' : 'success'}
                />
                <CampusNextAction
                  to="/alumno/material"
                  eyebrow="MATERIAL RECIENTE"
                  title={recentMaterial?.title || 'Sin material nuevo'}
                  meta={recentMaterial?.description || (recentMaterial ? 'Recurso publicado para continuar tu curso.' : 'Cuando tu profesor publique un recurso aparecerá aquí.')}
                  state={recentMaterial ? extensionLabel(recentMaterial.file) : 'Al día'}
                  stateTone={recentMaterial ? 'info' : 'success'}
                />
                <CampusNextAction
                  to="/alumno/avisos"
                  eyebrow="AVISOS"
                  title={unreadNotifications.length ? `${unreadNotifications.length} ${unreadNotifications.length === 1 ? 'comunicación sin leer' : 'comunicaciones sin leer'}` : 'Todo leído'}
                  meta={unreadNotifications[0]?.title || 'No tienes comunicaciones pendientes.'}
                  state={unreadNotifications.length ? `${unreadNotifications.length} ${unreadNotifications.length === 1 ? 'nuevo' : 'nuevos'}` : 'Al día'}
                  stateTone={unreadNotifications.length ? 'info' : 'success'}
                />
              </div>
            </section>

            {(pendingAssignments.length > 1 || recentMaterials.length > 1) && (
              <div className="campus-work-grid campus10-work-grid">
                <section className="panel campus-work-panel"><div className="panel-heading"><div><span className="eyebrow">DESPUÉS</span><h3>Más trabajo de tu curso</h3></div><Link to="/alumno/tareas">Ver todas →</Link></div><div className="task-list">{pendingAssignments.slice(1, 4).map((assignment: AssignmentRecord) => <PendingTask key={assignment.id} assignment={assignment} submitted={false} />)}{pendingAssignments.length <= 1 && <p className="muted">No tienes más tareas pendientes.</p>}</div></section>
                <section className="panel campus-work-panel"><div className="panel-heading"><div><span className="eyebrow">PARA CONTINUAR</span><h3>Más material disponible</h3></div><Link to="/alumno/material">Ver material →</Link></div><div className="file-list">{recentMaterials.slice(1, 4).map((material: MaterialRecord) => <MaterialItem key={material.id} material={material} />)}{recentMaterials.length <= 1 && <p className="muted">No hay más material reciente.</p>}</div></section>
              </div>
            )}

            <section className="campus-course-strip campus10-course-strip">
              <div><span className="eyebrow">TU CURSO ACTUAL</span><h3>{currentCourseTitle}</h3><p>{currentEnrollment ? `${currentGroupName} · Matrícula activa` : enrollmentSummary}</p></div>
              <div className="campus-level"><strong>{courseLevel}</strong><span>Nivel del curso</span></div>
              <div className="campus-course-links"><Link to="/alumno/nivel">Mi nivel</Link><Link to="/alumno/clases">Mis clases</Link><Link to="/alumno/material">Material</Link><Link to="/alumno/archivos">Mis archivos</Link></div>
            </section>

            {(snapshot?.files.length || unreadNotifications.length) > 0 && (
              <div className="campus-secondary-grid campus10-secondary-grid">
                {(snapshot?.files.length || 0) > 0 && <section className="panel campus-secondary-panel"><div className="panel-heading"><div><span className="eyebrow">MIS ARCHIVOS</span><h3>Espacio privado</h3></div><Link to="/alumno/archivos">Abrir →</Link></div><div className="file-list">{(snapshot?.files || []).slice(0, 3).map((file: StudentFileRecord) => <FileItem key={file.id} file={file} />)}</div></section>}
                {unreadNotifications.length > 0 && <section className="panel campus-secondary-panel"><div className="panel-heading"><div><span className="eyebrow">AVISOS PENDIENTES</span><h3>Antes de cerrar</h3></div><Link to="/alumno/avisos">Ver todos →</Link></div><div className="task-list">{unreadNotifications.slice(0, 3).map((notice: NotificationRecord) => <NoticeItem key={notice.id} notice={notice} />)}</div></section>}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  )
}

export default function StudentDashboard() {
  const { isDemoMode } = useAuth()
  return isDemoMode ? <DemoStudentDashboard /> : <ConnectedStudentDashboard />
}

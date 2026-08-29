import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { listMyTeacherEnrollments, type TeacherEnrollmentRecord } from '../../services/pocketbase/teacherPortal'
import {
  getAuthorizedStudentFileDownloadUrl,
  getMyAuthorizedStudentProfile,
  listMyAuthorizedStudentFiles,
} from '../../services/pocketbase/teacherStudents'
import type { StudentFileRecord, StudentProfileRecord } from '../../services/pocketbase/studentPortal'
import { teacherNav } from './teacherNav'

type StudentView = {
  id: string
  name: string
  email: string
  phone: string
  groups: string[]
}

function extension(filename: string): string {
  return filename.split('.').pop()?.slice(0, 4).toUpperCase() || 'FILE'
}

function formatDate(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Sin fecha' : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

export default function TeacherStudentsPage() {
  const { isDemoMode } = useAuth()
  const [enrollments, setEnrollments] = useState<TeacherEnrollmentRecord[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [profile, setProfile] = useState<StudentProfileRecord | null>(null)
  const [files, setFiles] = useState<StudentFileRecord[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(!isDemoMode)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) {
      setSelectedId('demo-student')
      setFiles([{ id: 'demo-file', collectionId: '', collectionName: 'student_files', created: '2026-08-10T18:00:00Z', updated: '', expand: {}, title: 'My-last-trip.docx', file: 'my-last-trip.docx', student: 'demo-student', uploaded_by: 'demo-student', category: 'HOMEWORK', description: 'Entrega personal', status: 'ACTIVE' }])
      return
    }

    let mounted = true
    listMyTeacherEnrollments()
      .then((records) => {
        if (!mounted) return
        setEnrollments(records)
        if (records[0]) setSelectedId(records[0].student)
      })
      .catch(() => { if (mounted) setError('No se han podido cargar tus alumnos. Inténtalo de nuevo en unos segundos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const students = useMemo<StudentView[]>(() => {
    if (isDemoMode) return [{ id: 'demo-student', name: 'Emma Rodríguez', email: 'emma@example.com', phone: '600 000 000', groups: ['Adultos B1'] }]
    const map = new Map<string, StudentView>()
    enrollments.forEach((enrollment) => {
      const record = enrollment.expand?.student
      const groupName = enrollment.expand?.group?.name || 'Grupo'
      const current = map.get(enrollment.student)
      if (current) {
        if (!current.groups.includes(groupName)) current.groups.push(groupName)
      } else {
        map.set(enrollment.student, {
          id: enrollment.student,
          name: record ? [record.name, record.surname].filter(Boolean).join(' ') || record.email : 'Alumno',
          email: record?.email || '',
          phone: record?.phone || '',
          groups: [groupName],
        })
      }
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [enrollments, isDemoMode])

  const visibleStudents = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return students
    return students.filter((student) => `${student.name} ${student.email} ${student.groups.join(' ')}`.toLowerCase().includes(query))
  }, [search, students])

  const selectedStudent = students.find((student) => student.id === selectedId) || null

  useEffect(() => {
    if (!selectedId || isDemoMode) return
    let mounted = true
    setDetailLoading(true); setError(null); setProfile(null); setFiles([])
    Promise.all([getMyAuthorizedStudentProfile(selectedId), listMyAuthorizedStudentFiles(selectedId, 50)])
      .then(([profileRecord, fileRecords]) => {
        if (!mounted) return
        setProfile(profileRecord); setFiles(fileRecords)
      })
      .catch(() => { if (mounted) setError('No se ha podido abrir esta ficha. Comprueba que el alumno siga asignado a uno de tus grupos.') })
      .finally(() => { if (mounted) setDetailLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, selectedId])

  async function downloadFile(record: StudentFileRecord) {
    setError(null); setMessage(null)
    if (isDemoMode) { setMessage('La descarga real no está disponible en la demostración.'); return }
    try {
      const url = await getAuthorizedStudentFileDownloadUrl(record)
      window.location.assign(url)
    } catch {
      setError('No se puede descargar este archivo. Comprueba que el alumno siga asignado a uno de tus grupos.')
    }
  }

  return (
    <DashboardShell role="Profesor" name="Profesor" nav={[...teacherNav]}>
      <div className="dashboard-content teacher-portal-page">
        <header className="teacher-page-heading">
          <div><span className="eyebrow">SEGUIMIENTO</span><h2>Mis alumnos</h2><p>Solo aparecen alumnos con matrícula activa en uno de tus grupos. Los archivos privados son de solo lectura.</p></div>
          <div className="private-space-badge"><strong>{students.length}</strong><span>alumnos asignados</span></div>
        </header>
        {loading && <div className="cms-notice" role="status">Cargando alumnos…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="teacher-students-grid">
          <section className="panel teacher-student-list-panel">
            <div className="panel-heading"><div><span className="eyebrow">ALUMNOS</span><h3>Grupos propios</h3></div><input className="student-files-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." aria-label="Buscar alumnos" /></div>
            <div className="teacher-student-picker">
              {visibleStudents.map((student) => <button key={student.id} type="button" className={selectedId === student.id ? 'active' : ''} onClick={() => setSelectedId(student.id)}><span className="avatar-mini">{student.name.charAt(0).toUpperCase()}</span><span><strong>{student.name}</strong><small>{student.groups.join(' · ')}</small></span><b>→</b></button>)}
              {!loading && visibleStudents.length === 0 && (
                <PortalEmptyState
                  compact
                  title={search.trim() ? 'No hay coincidencias' : 'Todavía no tienes alumnos asignados'}
                  description={search.trim() ? 'Prueba con otro nombre, email o grupo.' : 'Cuando haya matrículas activas en tus grupos, los alumnos aparecerán aquí automáticamente.'}
                />
              )}
            </div>
          </section>

          <section className="panel teacher-student-detail">
            {!selectedStudent && (
              <PortalEmptyState
                title={students.length === 0 ? 'Sin alumnos asignados' : 'Selecciona un alumno'}
                description={students.length === 0 ? 'La ficha se habilitará cuando tengas alumnos con matrícula activa en alguno de tus grupos.' : 'Aquí verás sus datos académicos permitidos y archivos privados de solo lectura.'}
              />
            )}
            {selectedStudent && <>
              <div className="teacher-student-profile"><span className="teacher-profile-avatar">{selectedStudent.name.charAt(0).toUpperCase()}</span><div><span className="eyebrow">ALUMNO ASIGNADO</span><h3>{selectedStudent.name}</h3><p>{selectedStudent.email || 'Sin email visible'}{selectedStudent.phone ? ` · ${selectedStudent.phone}` : ''}</p></div><span className="status success">Activo</span></div>
              <div className="teacher-student-groups"><strong>Grupos</strong><div>{selectedStudent.groups.map((group) => <span className="pill" key={group}>{group}</span>)}</div></div>
              {profile && <div className="teacher-profile-note"><span className="eyebrow">PERFIL ACADÉMICO</span><p>{profile.active ? 'Perfil activo en la academia.' : 'Perfil marcado como inactivo.'}</p></div>}
              <div className="panel-heading teacher-file-heading"><div><span className="eyebrow">ARCHIVOS PRIVADOS</span><h3>Solo lectura</h3></div><span className="status info">{files.length}</span></div>
              {detailLoading ? <div className="cms-notice" role="status">Comprobando permisos y archivos…</div> : <div className="teacher-student-files">{files.map((record) => <article key={record.id}><span className="teacher-record-icon">{extension(record.file)}</span><div><strong>{record.title}</strong><small>{record.category} · {formatDate(record.created)}</small>{record.description && <p>{record.description}</p>}</div><button type="button" onClick={() => void downloadFile(record)}>Descargar</button></article>)}{files.length === 0 && <PortalEmptyState compact title="Sin archivos compartidos" description="Este alumno no tiene archivos activos disponibles para consulta." />}</div>}
            </>}
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

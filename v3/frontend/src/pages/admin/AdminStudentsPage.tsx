import { useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

type Student = {
  id: number
  initials: string
  name: string
  email: string
  level: string
  program: string
  teacher: string
  status: 'Activo' | 'Pausado'
  nextClass: string
  files: number
  storage: string
}

const students: Student[] = [
  { id: 1, initials: 'EM', name: 'Emma Martín', email: 'emma@example.com', level: 'B1', program: 'Teens', teacher: 'Laura', status: 'Activo', nextClass: 'Jue · 18:00', files: 18, storage: '124 MB' },
  { id: 2, initials: 'DL', name: 'Daniel López', email: 'daniel@example.com', level: 'A2', program: 'Kids', teacher: 'Marta', status: 'Activo', nextClass: 'Vie · 17:00', files: 12, storage: '86 MB' },
  { id: 3, initials: 'CR', name: 'Carla Ruiz', email: 'carla@example.com', level: 'B2', program: 'Exámenes', teacher: 'Laura', status: 'Activo', nextClass: 'Vie · 19:00', files: 31, storage: '310 MB' },
  { id: 4, initials: 'JM', name: 'Javier Molina', email: 'javier@example.com', level: 'A1', program: 'Adultos', teacher: 'Álvaro', status: 'Pausado', nextClass: 'Sin programar', files: 7, storage: '42 MB' },
  { id: 5, initials: 'AS', name: 'Ana Sánchez', email: 'ana@example.com', level: 'C1', program: 'Exámenes', teacher: 'Laura', status: 'Activo', nextClass: 'Lun · 18:30', files: 26, storage: '228 MB' },
]

export default function AdminStudentsPage() {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'Todos' | Student['status']>('Todos')
  const [selectedId, setSelectedId] = useState(students[0].id)

  const filteredStudents = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return students.filter((student) => {
      const matchesText = !normalized || [student.name, student.email, student.level, student.program, student.teacher]
        .some((value) => value.toLowerCase().includes(normalized))
      const matchesStatus = status === 'Todos' || student.status === status
      return matchesText && matchesStatus
    })
  }, [query, status])

  const selected = students.find((student) => student.id === selectedId) ?? students[0]

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">PLATAFORMA · ALUMNOS</span>
            <h2>Alumnos y espacio privado</h2>
            <p>Desde aquí se gestionarán perfiles, nivel, profesor, clases y el almacenamiento privado de cada alumno.</p>
          </div>
          <button className="button button-primary" type="button">+ Nuevo alumno</button>
        </header>

        <section className="metric-grid student-metrics">
          <article><span>Alumnos activos</span><strong>36</strong><small>3 altas este mes</small></article>
          <article><span>Exámenes</span><strong>9</strong><small>B1 · B2 · C1</small></article>
          <article><span>Tareas pendientes</span><strong>14</strong><small>Entre todos los alumnos</small></article>
          <article><span>Almacenamiento</span><strong>1.4 GB</strong><small>Valor de demostración</small></article>
        </section>

        <div className="students-admin-layout">
          <section className="panel students-list-panel">
            <div className="students-toolbar">
              <label className="student-search">
                <span>Buscar alumno</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, nivel, profesor..." />
              </label>
              <div className="filter-pills">
                {(['Todos', 'Activo', 'Pausado'] as const).map((option) => (
                  <button key={option} className={status === option ? 'active' : ''} type="button" onClick={() => setStatus(option)}>{option}</button>
                ))}
              </div>
            </div>

            <div className="students-table" role="table" aria-label="Listado de alumnos">
              <div className="students-table-row students-table-header" role="row">
                <span>Alumno</span><span>Programa</span><span>Profesor</span><span>Próxima clase</span><span>Estado</span>
              </div>
              {filteredStudents.map((student) => (
                <button className={`students-table-row ${selected.id === student.id ? 'selected' : ''}`} role="row" type="button" key={student.id} onClick={() => setSelectedId(student.id)}>
                  <span className="student-identity"><b>{student.initials}</b><span><strong>{student.name}</strong><small>{student.email}</small></span></span>
                  <span><strong>{student.level}</strong><small>{student.program}</small></span>
                  <span>{student.teacher}</span>
                  <span>{student.nextClass}</span>
                  <span><i className={`student-status ${student.status === 'Activo' ? 'active' : 'paused'}`}>{student.status}</i></span>
                </button>
              ))}
            </div>
          </section>

          <aside className="panel student-detail-panel">
            <div className="student-detail-heading">
              <span className="student-avatar-large">{selected.initials}</span>
              <div><span className="eyebrow">FICHA DEL ALUMNO</span><h3>{selected.name}</h3><p>{selected.email}</p></div>
            </div>

            <div className="student-detail-tags">
              <span>{selected.level}</span><span>{selected.program}</span><span>{selected.teacher}</span>
            </div>

            <div className="student-detail-grid">
              <div><span>Próxima clase</span><strong>{selected.nextClass}</strong></div>
              <div><span>Archivos</span><strong>{selected.files}</strong></div>
              <div><span>Espacio usado</span><strong>{selected.storage}</strong></div>
              <div><span>Estado</span><strong>{selected.status}</strong></div>
            </div>

            <div className="student-private-space">
              <div className="panel-heading"><div><span className="eyebrow">ESPACIO PRIVADO</span><h3>Carpetas del alumno</h3></div><span className="status success">Aislado</span></div>
              <button type="button"><span>📁</span><div><strong>Material del profesor</strong><small>8 archivos</small></div><b>→</b></button>
              <button type="button"><span>📝</span><div><strong>Mis entregas</strong><small>5 archivos</small></div><b>→</b></button>
              <button type="button"><span>🎧</span><div><strong>Listening</strong><small>3 audios</small></div><b>→</b></button>
              <button type="button"><span>📚</span><div><strong>Documentos</strong><small>2 archivos</small></div><b>→</b></button>
            </div>

            <div className="student-detail-actions">
              <button className="button button-primary" type="button">Abrir perfil</button>
              <button className="button button-ghost" type="button">Subir material</button>
            </div>
          </aside>
        </div>
      </div>
    </DashboardShell>
  )
}

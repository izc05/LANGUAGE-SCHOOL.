import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

const teachers = [
  { initials: 'LG', name: 'Laura García', specialty: 'Exámenes · B1–C1', students: 18, classes: 12, availability: 'L–V tardes', status: 'Activa' },
  { initials: 'MS', name: 'Marta Sánchez', specialty: 'Kids · Teens', students: 11, classes: 9, availability: 'L–J tardes', status: 'Activa' },
  { initials: 'AR', name: 'Álvaro Ruiz', specialty: 'Adultos · Speaking', students: 7, classes: 6, availability: 'M–V mañanas', status: 'Activo' },
]

export default function AdminTeachersPage() {
  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">PLATAFORMA · PROFESORES</span>
            <h2>Equipo docente</h2>
            <p>Control de profesores, especialidades, alumnos asignados, carga semanal y disponibilidad.</p>
          </div>
          <button className="button button-primary" type="button">+ Nuevo profesor</button>
        </header>

        <section className="metric-grid">
          <article><span>Profesores activos</span><strong>3</strong><small>Equipo actual</small></article>
          <article><span>Clases esta semana</span><strong>27</strong><small>Individuales y grupos</small></article>
          <article><span>Alumnos asignados</span><strong>36</strong><small>Todos con profesor</small></article>
          <article><span>Horas disponibles</span><strong>14 h</strong><small>Huecos de demostración</small></article>
        </section>

        <section className="teacher-admin-grid">
          {teachers.map((teacher) => (
            <article className="panel teacher-admin-card" key={teacher.name}>
              <div className="teacher-card-heading">
                <span className="teacher-avatar">{teacher.initials}</span>
                <div><span className="eyebrow">PROFESOR</span><h3>{teacher.name}</h3><p>{teacher.specialty}</p></div>
                <span className="status success">{teacher.status}</span>
              </div>

              <div className="teacher-card-metrics">
                <div><span>Alumnos</span><strong>{teacher.students}</strong></div>
                <div><span>Clases/semana</span><strong>{teacher.classes}</strong></div>
              </div>

              <div className="teacher-availability">
                <span>Disponibilidad</span>
                <strong>{teacher.availability}</strong>
              </div>

              <div className="teacher-card-actions">
                <button type="button">Ver agenda</button>
                <button type="button">Alumnos</button>
                <button type="button">Editar</button>
              </div>
            </article>
          ))}
        </section>

        <section className="panel teacher-load-panel">
          <div className="panel-heading"><div><span className="eyebrow">CARGA DOCENTE</span><h3>Distribución semanal</h3></div><span className="status info">Demo</span></div>
          <div className="teacher-load-list">
            <div><span>Laura García</span><div><i style={{ width: '78%' }} /></div><strong>12 / 16 h</strong></div>
            <div><span>Marta Sánchez</span><div><i style={{ width: '61%' }} /></div><strong>9 / 15 h</strong></div>
            <div><span>Álvaro Ruiz</span><div><i style={{ width: '45%' }} /></div><strong>6 / 14 h</strong></div>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

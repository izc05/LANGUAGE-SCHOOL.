import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

const courses = [
  { name: 'Kids', levels: 'A1 · A2', groups: 3, students: 11, capacity: 18, schedule: 'L–J · 16:00–18:00' },
  { name: 'Teens', levels: 'A2 · B1 · B2', groups: 4, students: 12, capacity: 24, schedule: 'L–V · 17:00–20:00' },
  { name: 'Adultos', levels: 'A1 · A2 · B1', groups: 3, students: 7, capacity: 15, schedule: 'M–V · mañana/tarde' },
  { name: 'Exámenes', levels: 'B1 · B2 · C1', groups: 2, students: 6, capacity: 10, schedule: 'V · 18:00–21:00' },
]

export default function AdminCoursesPage() {
  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">PLATAFORMA · CURSOS</span>
            <h2>Cursos y grupos</h2>
            <p>Organiza programas, niveles, grupos, plazas y horarios desde una única pantalla.</p>
          </div>
          <button className="button button-primary" type="button">+ Nuevo curso</button>
        </header>

        <section className="metric-grid">
          <article><span>Programas</span><strong>4</strong><small>Kids · Teens · Adultos · Exámenes</small></article>
          <article><span>Grupos activos</span><strong>12</strong><small>Curso actual</small></article>
          <article><span>Plazas ocupadas</span><strong>36</strong><small>De 67 disponibles</small></article>
          <article><span>Ocupación</span><strong>54%</strong><small>Capacidad de demostración</small></article>
        </section>

        <section className="course-admin-grid">
          {courses.map((course, index) => {
            const occupancy = Math.round((course.students / course.capacity) * 100)
            return (
              <article className="panel course-admin-card" key={course.name}>
                <div className="course-card-number">0{index + 1}</div>
                <span className="eyebrow">PROGRAMA</span>
                <h3>{course.name}</h3>
                <p>{course.levels}</p>

                <div className="course-capacity">
                  <div><span>Ocupación</span><strong>{course.students}/{course.capacity}</strong></div>
                  <div className="progress-line"><span style={{ width: `${occupancy}%` }} /></div>
                </div>

                <dl>
                  <div><dt>Grupos</dt><dd>{course.groups}</dd></div>
                  <div><dt>Horario</dt><dd>{course.schedule}</dd></div>
                </dl>

                <div className="course-card-actions">
                  <button type="button">Ver grupos</button>
                  <button type="button">Editar</button>
                </div>
              </article>
            )
          })}
        </section>

        <section className="panel groups-overview-panel">
          <div className="panel-heading"><div><span className="eyebrow">GRUPOS</span><h3>Próximos grupos</h3></div><button type="button">Ver todos</button></div>
          <div className="group-row"><span className="group-code">B1-T1</span><div><strong>Teens B1</strong><small>Laura · martes y jueves</small></div><span>18:00</span><span>6/8 alumnos</span><span className="status success">Activo</span></div>
          <div className="group-row"><span className="group-code">A2-K2</span><div><strong>Kids A2</strong><small>Marta · lunes y miércoles</small></div><span>17:00</span><span>5/6 alumnos</span><span className="status success">Activo</span></div>
          <div className="group-row"><span className="group-code">B2-E1</span><div><strong>Exámenes B2</strong><small>Laura · viernes</small></div><span>19:00</span><span>4/5 alumnos</span><span className="status warning">1 plaza</span></div>
        </section>
      </div>
    </DashboardShell>
  )
}

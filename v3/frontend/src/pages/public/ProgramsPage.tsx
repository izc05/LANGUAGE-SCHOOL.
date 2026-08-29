import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { demoPublicCourses, listPublicCourses, type PublicCourseRecord } from '../../services/pocketbase/publicAcademy'

export default function ProgramsPage() {
  const [courses, setCourses] = useState<PublicCourseRecord[]>(isDemoMode ? demoPublicCourses : [])
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    let mounted = true
    listPublicCourses()
      .then((records) => { if (mounted) setCourses(records) })
      .catch(() => undefined)
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <SiteShell>
      <section className="public-page-hero">
        <div className="container public-page-hero-inner">
          <span className="eyebrow">PROGRAMAS</span>
          <h1>Encuentra el inglés que encaja contigo.</h1>
          <p>Niños, adolescentes, adultos y preparación de exámenes con objetivos claros y continuidad dentro de la plataforma.</p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          {loading && <div className="public-inline-note">Actualizando programas…</div>}
          {!loading && courses.length === 0 && <div className="public-empty-state">Todavía no hay programas publicados. Escríbenos y te orientamos personalmente.</div>}
          <div className="public-course-grid">
            {courses.map((course, index) => (
              <article className="public-course-card" key={course.id}>
                <span className="program-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="pill">{course.level || 'Inglés'}</span>
                <h2>{course.title}</h2>
                <p>{course.description || 'Programa adaptado al nivel y objetivos del alumno.'}</p>
                <Link className="text-link" to={`/contacto?interes=${encodeURIComponent(course.title)}`}>Consultar este programa →</Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container cta-panel public-cta-panel">
          <div><span className="eyebrow">¿NO SABES QUÉ NIVEL ELEGIR?</span><h2>Cuéntanos tu objetivo y te orientamos.</h2></div>
          <Link className="button button-primary" to="/contacto">Solicitar información</Link>
        </div>
      </section>
    </SiteShell>
  )
}

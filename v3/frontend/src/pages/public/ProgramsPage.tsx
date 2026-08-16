import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import {
  demoPublicCourses,
  getPublicCourseCoverUrl,
  listPublicCourses,
  type PublicCourseRecord,
} from '../../services/pocketbase/publicAcademy'

const audienceStages = [
  ['01', 'Kids', '6–12', 'Primeros pasos con una base sólida y mucha confianza.'],
  ['02', 'Teens', '13–17', 'Instituto, speaking y objetivos académicos claros.'],
  ['03', 'Universidad', '18+', 'Erasmus, presentaciones, viajes y futuro profesional.'],
  ['04', 'Adultos', 'Life', 'Conversación, trabajo y un inglés útil de verdad.'],
  ['05', 'Exámenes', 'A2–C1', 'Preparación, simulacros y estrategia por destrezas.'],
]

type CourseTheme = 'kids' | 'teens' | 'university' | 'adults' | 'exams'

function getCourseTheme(course: PublicCourseRecord): CourseTheme {
  const value = `${course.slug} ${course.title} ${course.level}`.toLowerCase()
  if (/(kid|niñ|primaria|6–12|6-12)/.test(value)) return 'kids'
  if (/(teen|adolesc|13–17|13-17|instituto)/.test(value)) return 'teens'
  if (/(univers|young|erasmus|campus)/.test(value)) return 'university'
  if (/(exam|examen|cambridge|ielts|aptis|a2|b1|b2|c1|c2)/.test(value)) return 'exams'
  return 'adults'
}

function getThemeSymbol(theme: CourseTheme) {
  if (theme === 'kids') return '✦'
  if (theme === 'teens') return '★'
  if (theme === 'university') return 'U'
  if (theme === 'exams') return '✓'
  return '∞'
}

function getThemeLabel(theme: CourseTheme) {
  if (theme === 'kids') return 'BUILD CONFIDENCE'
  if (theme === 'teens') return 'FIND YOUR VOICE'
  if (theme === 'university') return 'OPEN YOUR WORLD'
  if (theme === 'exams') return 'REACH YOUR GOAL'
  return 'ENGLISH FOR LIFE'
}

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
      <section className="programs-v2-hero">
        <div className="container programs-v2-hero-grid">
          <div className="programs-v2-hero-copy">
            <span className="eyebrow">PROGRAMAS · LANGUAGE SCHOOL</span>
            <h1>Un inglés distinto para <em>cada etapa.</em></h1>
            <p>Desde los primeros años de colegio hasta la universidad, la vida profesional o una certificación. El objetivo cambia; la atención personal y el seguimiento, no.</p>
            <div className="programs-v2-hero-actions">
              <a className="button button-primary" href="#catalogo-programas">Ver programas</a>
              <Link className="button button-ghost" to="/contacto">Ayúdame a elegir</Link>
            </div>
          </div>

          <div className="programs-v2-route" aria-label="Etapas de aprendizaje">
            <div className="programs-v2-route-orbit orbit-one" aria-hidden="true" />
            <div className="programs-v2-route-orbit orbit-two" aria-hidden="true" />
            <div className="programs-v2-route-center">
              <span>YOUR</span>
              <strong>English</strong>
              <small>PATH</small>
            </div>
            <div className="programs-v2-route-note note-kids"><b>01</b><span>Kids</span></div>
            <div className="programs-v2-route-note note-teens"><b>02</b><span>Teens</span></div>
            <div className="programs-v2-route-note note-university"><b>03</b><span>Universidad</span></div>
            <div className="programs-v2-route-note note-adults"><b>04</b><span>Adultos</span></div>
            <div className="programs-v2-route-note note-exams"><b>05</b><span>Exámenes</span></div>
          </div>
        </div>
      </section>

      <section className="programs-v2-stages" aria-label="Programas por etapa">
        <div className="container programs-v2-stage-grid">
          {audienceStages.map(([number, title, age, description]) => (
            <article className="programs-v2-stage" key={title}>
              <div><span>{number}</span><small>{age}</small></div>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="programs-v2-catalog" id="catalogo-programas">
        <div className="container">
          <div className="programs-v2-section-heading">
            <div>
              <span className="eyebrow">PROGRAMAS PUBLICADOS</span>
              <h2>Encuentra el camino que encaja contigo.</h2>
            </div>
            <p>No necesitas saber tu nivel antes de empezar. Cuéntanos tu momento y tu objetivo y te ayudamos a elegir el recorrido adecuado.</p>
          </div>

          {loading && <div className="public-inline-note">Actualizando programas…</div>}
          {!loading && courses.length === 0 && <div className="public-empty-state">Todavía no hay programas publicados. Escríbenos y te orientamos personalmente.</div>}

          <div className="programs-v2-course-list">
            {courses.map((course, index) => {
              const theme = getCourseTheme(course)
              const coverUrl = getPublicCourseCoverUrl(course)
              return (
                <article className={`programs-v2-course ${theme}`} key={course.id}>
                  <div
                    className={`programs-v2-course-visual${coverUrl ? ' has-image' : ''}`}
                    style={coverUrl ? { backgroundImage: `linear-gradient(160deg, rgba(44,24,34,.06), rgba(44,24,34,.28)), url(${coverUrl})` } : undefined}
                  >
                    <span className="programs-v2-course-symbol" aria-hidden="true">{getThemeSymbol(theme)}</span>
                    <span className="programs-v2-course-visual-label">{getThemeLabel(theme)}</span>
                    <strong aria-hidden="true">{String(index + 1).padStart(2, '0')}</strong>
                  </div>

                  <div className="programs-v2-course-copy">
                    <div className="programs-v2-course-meta">
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <span className="pill">{course.level || 'Inglés'}</span>
                    </div>
                    <h3>{course.title}</h3>
                    <p>{course.description || 'Programa adaptado al nivel y objetivos del alumno.'}</p>
                    <div className="programs-v2-course-points" aria-label="Qué puedes esperar">
                      <span>Grupos reducidos</span>
                      <span>Seguimiento</span>
                      <span>Recursos digitales</span>
                    </div>
                    <Link className="programs-v2-course-link" to={`/contacto?interes=${encodeURIComponent(course.title)}`}>
                      Consultar este programa <span aria-hidden="true">↗</span>
                    </Link>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="programs-v2-guidance">
        <div className="container programs-v2-guidance-panel">
          <div className="programs-v2-guidance-mark" aria-hidden="true">?</div>
          <div>
            <span className="eyebrow">NO TIENES QUE SABERLO TODO AHORA</span>
            <h2>Te ayudamos a encontrar tu punto de partida.</h2>
            <p>Edad, nivel, objetivo y disponibilidad. Con cuatro datos podemos recomendarte el programa que más sentido tiene para ti o para tu hijo.</p>
          </div>
          <Link className="button button-primary" to="/contacto">Quiero orientación</Link>
        </div>
      </section>
    </SiteShell>
  )
}

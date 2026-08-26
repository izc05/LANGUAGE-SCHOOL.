import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import SiteShell from '../../components/SiteShell'
import {
  getPublicCourseBySlug,
  getPublicCourseCoverUrl,
  type PublicCourseRecord,
} from '../../services/pocketbase/publicAcademy'

type CourseTheme = 'kids' | 'teens' | 'university' | 'adults' | 'exams'

function getCourseTheme(course: PublicCourseRecord): CourseTheme {
  const value = `${course.slug} ${course.title} ${course.level}`.toLowerCase()
  if (/(kid|niñ|primaria|6–12|6-12)/.test(value)) return 'kids'
  if (/(teen|adolesc|13–17|13-17|instituto)/.test(value)) return 'teens'
  if (/(univers|young|erasmus|campus)/.test(value)) return 'university'
  if (/(exam|examen|cambridge|ielts|aptis|a2|b1|b2|c1|c2)/.test(value)) return 'exams'
  return 'adults'
}

function themeLabel(theme: CourseTheme) {
  if (theme === 'kids') return 'Primeros pasos'
  if (theme === 'teens') return 'Confianza y objetivos'
  if (theme === 'university') return 'Estudios y futuro'
  if (theme === 'exams') return 'Preparación y estrategia'
  return 'Inglés para la vida real'
}

export default function CourseDetailPage() {
  const { slug = '' } = useParams()
  const [course, setCourse] = useState<PublicCourseRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getPublicCourseBySlug(slug)
      .then((record) => {
        if (mounted) setCourse(record)
      })
      .catch(() => {
        if (mounted) setCourse(null)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [slug])

  useEffect(() => {
    if (!course) return
    const previousTitle = document.title
    document.title = `${course.title} · Language School`
    return () => { document.title = previousTitle }
  }, [course])

  if (loading) {
    return (
      <SiteShell>
        <section className="course-detail-v2 course-detail-state">
          <div className="container"><p>Estamos preparando la información del programa…</p></div>
        </section>
      </SiteShell>
    )
  }

  if (!course) {
    return (
      <SiteShell>
        <section className="course-detail-v2 course-detail-state">
          <div className="container course-detail-state-card">
            <span className="eyebrow">PROGRAMAS · LANGUAGE SCHOOL</span>
            <h1>No hemos encontrado este programa.</h1>
            <p>Puede que ya no esté publicado o que el enlace haya cambiado. Puedes volver al catálogo o escribirnos y te orientamos personalmente.</p>
            <div className="course-detail-actions">
              <Link className="button button-primary" to="/programas">Ver programas</Link>
              <Link className="button button-ghost" to="/contacto">Contactar</Link>
            </div>
          </div>
        </section>
      </SiteShell>
    )
  }

  const theme = getCourseTheme(course)
  const coverUrl = getPublicCourseCoverUrl(course, '1600x1050')
  const description = course.description || 'Un programa adaptado al nivel, momento y objetivos del alumno.'

  return (
    <SiteShell>
      <article className={`course-detail-v2 theme-${theme}`}>
        <section className="course-detail-hero">
          <div className="container course-detail-hero-grid">
            <div className="course-detail-copy">
              <nav className="course-detail-breadcrumb" aria-label="Migas de pan">
                <Link to="/programas">Programas</Link><span aria-hidden="true">/</span><span>{course.title}</span>
              </nav>
              <span className="eyebrow">{course.level || 'PROGRAMA DE INGLÉS'}</span>
              <h1>{course.title}</h1>
              <p className="course-detail-lead">{description}</p>
              <div className="course-detail-actions">
                <Link className="button button-primary" to={`/contacto?interes=${encodeURIComponent(course.title)}`}>Quiero información</Link>
                <Link className="button button-ghost" to="/tarifas">Ver tarifas</Link>
              </div>
              <div className="course-detail-trust" aria-label="Qué incluye la experiencia Language School">
                <span>Grupos reducidos</span><span>Seguimiento personal</span><span>Recursos digitales</span>
              </div>
            </div>

            <figure
              className={`course-detail-visual${coverUrl ? ' has-photo' : ''}`}
              style={coverUrl ? { backgroundImage: `linear-gradient(180deg, rgba(45,25,35,.02), rgba(45,25,35,.20)), url(${coverUrl})` } : undefined}
            >
              <div className="course-detail-visual-copy">
                <span>{themeLabel(theme)}</span>
                <strong>{course.level || 'Tu siguiente paso'}</strong>
                <small>Language School · Rocío Ruiz</small>
              </div>
            </figure>
          </div>
        </section>

        <section className="course-detail-essentials">
          <div className="container course-detail-essentials-grid">
            <div className="course-detail-section-heading">
              <span className="eyebrow">UNA RUTA CLARA</span>
              <h2>Lo importante no es empezar perfecto. Es saber cuál es tu <em>siguiente paso.</em></h2>
            </div>
            <div className="course-detail-principles">
              <article><span>01</span><h3>Partimos de tu punto actual</h3><p>Antes de acelerar, entendemos nivel, objetivos y ritmo para que el trabajo tenga sentido desde el principio.</p></article>
              <article><span>02</span><h3>Practicamos con intención</h3><p>Speaking, listening, vocabulario y estructuras se trabajan para usarlos, no solo para reconocerlos sobre el papel.</p></article>
              <article><span>03</span><h3>Seguimos tu evolución</h3><p>Clases, materiales y tareas forman una misma ruta para que sepas qué estás reforzando y qué viene después.</p></article>
            </div>
          </div>
        </section>

        <section className="course-detail-experience">
          <div className="container course-detail-experience-grid">
            <div className="course-detail-experience-copy">
              <span className="eyebrow">DENTRO Y FUERA DEL AULA</span>
              <h2>Una experiencia de aprendizaje que continúa entre clases.</h2>
              <p>El objetivo es que el alumno no dependa de una única hora de clase para saber qué hacer. Language School conecta la sesión presencial con recursos, tareas y seguimiento en su espacio digital.</p>
              <Link className="text-link" to="/acceso">Conoce el área del alumno →</Link>
            </div>
            <div className="course-detail-experience-list">
              <article><strong>Clase</strong><span>Objetivos claros, práctica guiada y espacio para preguntar.</span></article>
              <article><strong>Recursos</strong><span>Materiales de apoyo para continuar trabajando fuera del aula.</span></article>
              <article><strong>Seguimiento</strong><span>Una referencia clara del progreso y del siguiente objetivo.</span></article>
            </div>
          </div>
        </section>

        <section className="course-detail-final">
          <div className="container course-detail-final-panel">
            <span className="eyebrow">¿ENCAJA CONTIGO?</span>
            <h2>Cuéntanos qué necesitas y te ayudamos a decidir.</h2>
            <p>No hace falta conocer tu nivel exacto antes de escribirnos. Edad, objetivo y disponibilidad son suficientes para empezar a orientarte.</p>
            <div className="course-detail-actions">
              <Link className="button button-primary" to={`/contacto?interes=${encodeURIComponent(course.title)}`}>Preguntar por {course.title}</Link>
              <Link className="button button-ghost" to="/programas">Volver a programas</Link>
            </div>
          </div>
        </section>
      </article>
    </SiteShell>
  )
}

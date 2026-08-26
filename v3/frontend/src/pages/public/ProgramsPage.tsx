import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { getMediaById, getMediaUrl } from '../../services/pocketbase/media'
import { demoPublicCourses, getPublicCourseCoverUrl, listPublicCourses, type PublicCourseRecord } from '../../services/pocketbase/publicAcademy'
import { getPublishedHomeContent, type HomeVisualContent } from '../../services/pocketbase/siteContent'

const audienceStages = [
  ['01', 'Kids', '6–12', 'Primeros pasos con una base sólida y mucha confianza.'],
  ['02', 'Teens', '13–17', 'Instituto, speaking y objetivos académicos claros.'],
  ['03', 'Universidad', '18+', 'Erasmus, presentaciones, viajes y futuro profesional.'],
  ['04', 'Adultos', 'Life', 'Conversación, trabajo y un inglés útil de verdad.'],
  ['05', 'Exámenes', 'A2–C1', 'Preparación, simulacros y estrategia por destrezas.'],
]

type CourseTheme = 'kids' | 'teens' | 'university' | 'adults' | 'exams'

const themeVisualKeys: Record<CourseTheme, keyof HomeVisualContent> = {
  kids: 'kidsMediaId', teens: 'teensMediaId', university: 'universityMediaId', adults: 'adultsMediaId', exams: 'examsMediaId',
}
const emptyThemeVisuals: Record<CourseTheme, string> = { kids: '', teens: '', university: '', adults: '', exams: '' }

// Fotografías editoriales de respaldo. La portada del curso subida en Admin y las
// imágenes de etapa del CMS siempre tienen prioridad. El SVG local queda como
// último salvavidas si la fotografía remota no estuviera disponible.
const editorialPhotoFallbacks: Record<CourseTheme, string> = {
  kids: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1500&q=84',
  teens: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1500&q=84',
  university: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1500&q=84',
  adults: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1500&q=84',
  exams: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1500&q=84',
}

function getCourseTheme(course: PublicCourseRecord): CourseTheme {
  const value = `${course.slug} ${course.title} ${course.level}`.toLowerCase()
  if (/(kid|niñ|primaria|6–12|6-12)/.test(value)) return 'kids'
  if (/(teen|adolesc|13–17|13-17|instituto)/.test(value)) return 'teens'
  if (/(univers|young|erasmus|campus)/.test(value)) return 'university'
  if (/(exam|examen|cambridge|ielts|aptis|a2|b1|b2|c1|c2)/.test(value)) return 'exams'
  return 'adults'
}

function getThemeSymbol(theme: CourseTheme) { if (theme === 'kids') return '✦'; if (theme === 'teens') return '★'; if (theme === 'university') return 'U'; if (theme === 'exams') return '✓'; return '∞' }
function getThemeLabel(theme: CourseTheme) { if (theme === 'kids') return 'BUILD CONFIDENCE'; if (theme === 'teens') return 'FIND YOUR VOICE'; if (theme === 'university') return 'OPEN YOUR WORLD'; if (theme === 'exams') return 'REACH YOUR GOAL'; return 'ENGLISH FOR LIFE' }

function photoLayers(primary: string, localFallback: string, endOpacity = '.18') {
  return `linear-gradient(180deg, rgba(45,25,35,.015), rgba(45,25,35,${endOpacity})), url("${primary}"), url("${localFallback}")`
}

export default function ProgramsPage() {
  const [courses, setCourses] = useState<PublicCourseRecord[]>(isDemoMode ? demoPublicCourses : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [themeVisuals, setThemeVisuals] = useState<Record<CourseTheme, string>>({ ...emptyThemeVisuals })
  const visualBase = `${import.meta.env.BASE_URL}visuals/`

  useEffect(() => {
    let mounted = true
    listPublicCourses().then((records) => { if (mounted) setCourses(records) }).catch(() => undefined).finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadThemeVisuals() {
      try {
        const content = await getPublishedHomeContent()
        const entries = await Promise.all((Object.keys(themeVisualKeys) as CourseTheme[]).map(async (theme) => {
          const id = content.visuals[themeVisualKeys[theme]]
          if (!id) return [theme, ''] as const
          try { const media = await getMediaById(id); return [theme, getMediaUrl(media, '1400x900')] as const }
          catch { return [theme, ''] as const }
        }))
        if (mounted) setThemeVisuals({ ...emptyThemeVisuals, ...Object.fromEntries(entries) })
      } catch { /* photography + packaged fallback remain available */ }
    }
    void loadThemeVisuals()
    return () => { mounted = false }
  }, [])

  const heroManagedVisual = themeVisuals.university || themeVisuals.adults || themeVisuals.teens || themeVisuals.kids || themeVisuals.exams
  const heroPrimaryPhoto = heroManagedVisual || editorialPhotoFallbacks.university
  const heroLocalFallback = `${visualBase}program-photo-university.svg`

  return (
    <SiteShell>
      <section className="programs-v2-hero programs-v2-hero-editorial">
        <div className="container programs-v2-hero-grid">
          <div className="programs-v2-hero-copy">
            <span className="eyebrow">PROGRAMAS · LANGUAGE SCHOOL</span>
            <h1>Encuentra el inglés que <em>encaja contigo.</em></h1>
            <p>Desde los primeros años de colegio hasta la universidad, la vida profesional o una certificación. El objetivo cambia; la atención personal y el seguimiento, no.</p>
            <div className="programs-v2-hero-actions"><a className="button button-primary" href="#catalogo-programas">Ver programas</a><Link className="button button-ghost" to="/contacto">Ayúdame a elegir</Link></div>
          </div>
          <figure
            className={`programs-v2-hero-visual has-photo${heroManagedVisual ? ' has-cms-photo' : ' has-editorial-photo'}`}
            style={{ backgroundImage: photoLayers(heroPrimaryPhoto, heroLocalFallback, '.20') }}
          >
            <figcaption><span>UNA ACADEMIA · DISTINTAS ETAPAS</span><strong>Tu objetivo cambia. El acompañamiento permanece.</strong><small>Kids · Teens · Universidad · Adultos · Exámenes</small></figcaption>
          </figure>
        </div>
      </section>

      <section className="programs-v2-stages" aria-label="Programas por etapa"><div className="container programs-v2-stage-grid">{audienceStages.map(([number, title, age, description]) => <article className="programs-v2-stage" key={title}><div><span>{number}</span><small>{age}</small></div><h2>{title}</h2><p>{description}</p></article>)}</div></section>

      <section className="programs-v2-catalog" id="catalogo-programas">
        <div className="container">
          <div className="programs-v2-section-heading"><div><span className="eyebrow">PROGRAMAS PUBLICADOS</span><h2>Encuentra el camino que encaja contigo.</h2></div><p>No necesitas saber tu nivel antes de empezar. Cuéntanos tu momento y tu objetivo y te ayudamos a elegir el recorrido adecuado.</p></div>
          {loading && <div className="public-inline-note">Actualizando programas…</div>}
          {!loading && courses.length === 0 && <div className="public-empty-state">Todavía no hay programas publicados. Escríbenos y te orientamos personalmente.</div>}

          <div className="programs-v2-course-list">
            {courses.map((course, index) => {
              const theme = getCourseTheme(course)
              const coverUrl = getPublicCourseCoverUrl(course)
              const adminFallbackUrl = themeVisuals[theme]
              const editorialPhoto = editorialPhotoFallbacks[theme]
              const localFallbackUrl = `${visualBase}program-photo-${theme}.svg`
              const primaryPhoto = coverUrl || adminFallbackUrl || editorialPhoto
              const managedVisual = Boolean(coverUrl || adminFallbackUrl)
              return (
                <article className={`programs-v2-course ${theme}`} key={course.id}>
                  <div
                    className={`programs-v2-course-visual has-image${managedVisual ? ' has-managed-photo' : ' has-editorial-photo'}`}
                    style={{ backgroundImage: photoLayers(primaryPhoto, localFallbackUrl, '.23') }}
                  >
                    <span className="programs-v2-course-symbol" aria-hidden="true">{getThemeSymbol(theme)}</span><span className="programs-v2-course-visual-label">{getThemeLabel(theme)}</span><strong aria-hidden="true">{String(index + 1).padStart(2, '0')}</strong>
                  </div>
                  <div className="programs-v2-course-copy">
                    <div className="programs-v2-course-meta"><span>{String(index + 1).padStart(2, '0')}</span><span className="pill">{course.level || 'Inglés'}</span></div>
                    <h3>{course.title}</h3><p>{course.description || 'Programa adaptado al nivel y objetivos del alumno.'}</p>
                    <div className="programs-v2-course-points" aria-label="Qué puedes esperar"><span>Grupos reducidos</span><span>Seguimiento</span><span>Recursos digitales</span></div>
                    <Link className="programs-v2-course-link" to={`/programas/${encodeURIComponent(course.slug)}`}>Ver ficha del programa <span aria-hidden="true">↗</span></Link>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="programs-v2-guidance"><div className="container programs-v2-guidance-panel"><div className="programs-v2-guidance-mark" aria-hidden="true">?</div><div><span className="eyebrow">NO TIENES QUE SABERLO TODO AHORA</span><h2>Te ayudamos a encontrar tu punto de partida.</h2><p>Edad, nivel, objetivo y disponibilidad. Con cuatro datos podemos recomendarte el programa que más sentido tiene para ti o para tu hijo.</p></div><Link className="button button-primary" to="/contacto">Quiero orientación</Link></div></section>
    </SiteShell>
  )
}
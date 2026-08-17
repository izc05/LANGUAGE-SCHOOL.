import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
import { getPublishedHomeVisualUrl } from '../../services/pocketbase/siteContent'
import {
  demoPublicTeachers,
  getTeacherPhotoUrl,
  listPublicTeacherProfiles,
  teacherSpecialties,
  type PublicTeacherProfile,
} from '../../services/pocketbase/teacherProfiles'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'LS'
}

const audience = [
  ['01', 'Kids'],
  ['02', 'Teens'],
  ['03', 'Universidad'],
  ['04', 'Adultos'],
  ['05', 'Exámenes'],
] as const

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<PublicTeacherProfile[]>(isDemoMode ? demoPublicTeachers : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [heroPhoto, setHeroPhoto] = useState('')
  const heroVisual = `${import.meta.env.BASE_URL}visuals/teachers-hero.svg`
  const methodVisual = `${import.meta.env.BASE_URL}visuals/teachers-method.svg`
  const feedbackVisual = `${import.meta.env.BASE_URL}visuals/teachers-feedback.svg`

  useEffect(() => {
    let mounted = true
    listPublicTeacherProfiles()
      .then((records) => { if (mounted) setTeachers(records) })
      .catch(() => undefined)
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    getPublishedHomeVisualUrl('teachersHeroMediaId').then((url) => { if (mounted) setHeroPhoto(url) }).catch(() => undefined)
    return () => { mounted = false }
  }, [])

  return (
    <SiteShell>
      <div className="teachers-premium-v2">
        <section className="teachers-v2-hero">
          <div className="container teachers-v2-hero-grid">
            <div className="teachers-v2-hero-copy">
              <span className="eyebrow">EQUIPO DOCENTE</span>
              <h1>Aprender mejor empieza por <span>sentirse acompañado.</span></h1>
              <p>Conoce a las personas que están detrás de cada clase, cada corrección y cada pequeño avance.</p>
              <div className="teachers-v2-audience" aria-label="Etapas de aprendizaje">
                {audience.map(([number, label]) => (
                  <span key={label}><small>{number}</small>{label}</span>
                ))}
              </div>
            </div>
            <div className={`teachers-v2-hero-visual${heroPhoto ? ' has-cms-photo' : ''}`} style={heroPhoto ? { backgroundImage: `linear-gradient(180deg, rgba(52,24,38,.02), rgba(52,24,38,.22)), url(${heroPhoto})` } : undefined}>
              <img src={heroVisual} alt="Ilustración de una profesora acompañando a estudiantes de distintas edades" />
              <span className="teachers-v2-orbit teachers-v2-orbit-one" aria-hidden="true" />
              <span className="teachers-v2-orbit teachers-v2-orbit-two" aria-hidden="true" />
              <div className="teachers-v2-floating-note">
                <small>NUESTRO ENFOQUE</small>
                <strong>Confianza antes que perfección.</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section teachers-v2-team-section">
          <div className="container">
            <div className="teachers-v2-section-head">
              <div>
                <span className="eyebrow">CONOCE AL EQUIPO</span>
                <h2>Personas que enseñan, escuchan y hacen avanzar.</h2>
              </div>
              <p>Perfiles reales publicados desde la academia. Especialidad, experiencia y forma de acompañar, sin ruido innecesario.</p>
            </div>

            {loading && <div className="public-inline-note">Cargando equipo docente…</div>}
            {!loading && teachers.length === 0 && (
              <div className="public-empty-state">El equipo docente se publicará próximamente.</div>
            )}

            <div className="teachers-v2-grid">
              {teachers.map((teacher, index) => {
                const photoUrl = getTeacherPhotoUrl(teacher)
                const specialties = teacherSpecialties(teacher)
                const displayName = teacher.display_name || 'Profesor/a Language School'
                return (
                  <article className="teachers-v2-card" key={teacher.id}>
                    <div className="teachers-v2-photo-wrap">
                      {photoUrl
                        ? <img src={photoUrl} alt={`Retrato de ${displayName}`} />
                        : (
                          <div className={`teachers-v2-photo-fallback fallback-${(index % 3) + 1}`} aria-label={`Perfil de ${displayName}`}>
                            <span className="teachers-v2-fallback-ring" aria-hidden="true" />
                            <strong>{initials(displayName)}</strong>
                            <small>LANGUAGE SCHOOL</small>
                          </div>
                        )}
                      <span className="teachers-v2-card-index">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="teachers-v2-card-copy">
                      <span className="eyebrow">{teacher.headline || 'ENGLISH TEACHER'}</span>
                      <h3>{displayName}</h3>
                      <p>{teacher.bio || 'Acompañamiento cercano y práctica orientada a objetivos reales.'}</p>
                      {specialties.length > 0 && (
                        <div className="teachers-v2-specialties" aria-label="Especialidades">
                          {specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}
                        </div>
                      )}
                      <blockquote>“Aprender también es sentirse seguro para intentarlo.”</blockquote>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className="section teachers-v2-method-section">
          <div className="container">
            <div className="teachers-v2-method-intro">
              <div>
                <span className="eyebrow">DENTRO DE UNA CLASE</span>
                <h2>La diferencia no está solo en explicar. Está en acompañar el proceso.</h2>
              </div>
              <p>La clase se construye para que el alumno use el idioma, entienda qué puede mejorar y salga con un siguiente paso claro. Más conversación útil, menos sensación de estar memorizando por memorizar.</p>
            </div>

            <div className="teachers-v2-method-grid">
              <article className="teachers-v2-method-card">
                <div className="teachers-v2-method-copy">
                  <span className="eyebrow">01 · PRÁCTICA</span>
                  <h3>Hablar primero. Afinar después.</h3>
                  <p>Situaciones, preguntas y objetivos concretos convierten el inglés en una herramienta que se usa desde el principio.</p>
                  <div className="teachers-v2-method-tags" aria-label="Claves de práctica">
                    <span>Contexto real</span>
                    <span>Participación</span>
                    <span>Corrección útil</span>
                  </div>
                </div>
                <div className="teachers-v2-method-visual">
                  <img src={methodVisual} alt="Ilustración editorial de práctica oral y conversación guiada" />
                  <div className="teachers-v2-method-caption">
                    <small>EN CLASE</small>
                    <strong>Más uso real del idioma.</strong>
                  </div>
                </div>
              </article>

              <article className="teachers-v2-method-card">
                <div className="teachers-v2-method-copy">
                  <span className="eyebrow">02 · FEEDBACK</span>
                  <h3>Entender qué mejorar cambia la forma de avanzar.</h3>
                  <p>Correcciones claras, objetivos alcanzables y seguimiento ayudan a convertir cada error en información útil para la siguiente clase.</p>
                  <div className="teachers-v2-method-tags" aria-label="Claves de seguimiento">
                    <span>Objetivos claros</span>
                    <span>Progreso visible</span>
                    <span>Siguiente paso</span>
                  </div>
                </div>
                <div className="teachers-v2-method-visual">
                  <img src={feedbackVisual} alt="Ilustración editorial de feedback, correcciones y progreso" />
                  <div className="teachers-v2-method-caption">
                    <small>ENTRE CLASES</small>
                    <strong>Feedback que se entiende.</strong>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section teachers-v2-philosophy-section">
          <div className="container teachers-v2-philosophy">
            <div className="teachers-v2-philosophy-mark" aria-hidden="true">
              <span>LS</span>
            </div>
            <div className="teachers-v2-philosophy-copy">
              <span className="eyebrow">NUESTRA FILOSOFÍA</span>
              <h2>Enseñamos inglés. <span>Formamos confianza.</span></h2>
              <p>Cada profesor aporta su especialidad, pero todos comparten una misma forma de trabajar: objetivos claros, correcciones útiles, cercanía y práctica que sirve fuera del aula.</p>
            </div>
            <div className="teachers-v2-values">
              <span><b>01</b> Atención cercana</span>
              <span><b>02</b> Formación continua</span>
              <span><b>03</b> Práctica real</span>
              <span><b>04</b> Progreso medible</span>
            </div>
          </div>
        </section>

        <section className="section teachers-v2-cta-section">
          <div className="container teachers-v2-cta">
            <div>
              <span className="eyebrow">PRIMER CONTACTO</span>
              <h2>Cuéntanos qué necesitas y te ayudamos a elegir.</h2>
              <p>Niños, teens, universidad, adultos o exámenes: buscamos el profesor y el programa que mejor encajen.</p>
            </div>
            <Link className="button button-primary" to="/contacto">Hablar con la academia</Link>
          </div>
        </section>
      </div>
    </SiteShell>
  )
}

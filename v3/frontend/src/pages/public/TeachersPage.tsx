import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import SiteShell from '../../components/SiteShell'
import { isDemoMode } from '../../config/environment'
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

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<PublicTeacherProfile[]>(isDemoMode ? demoPublicTeachers : [])
  const [loading, setLoading] = useState(!isDemoMode)

  useEffect(() => {
    let mounted = true
    listPublicTeacherProfiles()
      .then((records) => { if (mounted) setTeachers(records) })
      .catch(() => undefined)
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  return (
    <SiteShell>
      <section className="public-page-hero">
        <div className="container public-page-hero-inner">
          <span className="eyebrow">EQUIPO DOCENTE</span>
          <h1>Aprender mejor empieza por sentirse acompañado.</h1>
          <p>Conoce a las personas que están detrás de cada clase, cada corrección y cada pequeño avance.</p>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          {loading && <div className="public-inline-note">Cargando equipo docente…</div>}
          {!loading && teachers.length === 0 && (
            <div className="public-empty-state">El equipo docente se publicará próximamente.</div>
          )}

          <div className="public-teacher-grid">
            {teachers.map((teacher) => {
              const photoUrl = getTeacherPhotoUrl(teacher)
              const specialties = teacherSpecialties(teacher)
              const displayName = teacher.display_name || 'Profesor/a Language School'
              return (
                <article className="public-teacher-card" key={teacher.id}>
                  <div className="public-teacher-photo">
                    {photoUrl
                      ? <img src={photoUrl} alt={`Retrato de ${displayName}`} />
                      : <span aria-hidden="true">{initials(displayName)}</span>}
                  </div>
                  <div className="public-teacher-copy">
                    <span className="eyebrow">{teacher.headline || 'ENGLISH TEACHER'}</span>
                    <h2>{displayName}</h2>
                    <p>{teacher.bio || 'Acompañamiento cercano y práctica orientada a objetivos reales.'}</p>
                    {specialties.length > 0 && (
                      <div className="teacher-specialties" aria-label="Especialidades">
                        {specialties.map((specialty) => <span className="pill" key={specialty}>{specialty}</span>)}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container cta-panel public-cta-panel">
          <div>
            <span className="eyebrow">PRIMER CONTACTO</span>
            <h2>Cuéntanos qué necesitas y te ayudamos a elegir.</h2>
          </div>
          <Link className="button button-primary" to="/contacto">Hablar con la academia</Link>
        </div>
      </section>
    </SiteShell>
  )
}

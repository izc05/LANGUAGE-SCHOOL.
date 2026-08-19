import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import { getAdminDashboardMetrics, type AdminDashboardMetrics } from '../../services/pocketbase/adminDashboard'
import { adminNav } from './adminNav'

function formatUpdated(value: string): string {
  if (!value) return 'sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(date)
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    getAdminDashboardMetrics()
      .then((snapshot) => { if (mounted) setMetrics(snapshot) })
      .catch(() => { if (mounted) setError('No se han podido actualizar las métricas del Dashboard.') })
    return () => { mounted = false }
  }, [])

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content admin-dashboard-phase12a">
        <div className="admin-intro">
          <div>
            <span className="eyebrow">CENTRO DE OPERACIONES</span>
            <h2>Todo lo importante de la academia, en un solo lugar.</h2>
            <p>Revisa solicitudes, alumnos y clases antes de pasar a la edición de contenidos y configuración.</p>
          </div>
          <Link className="button button-primary" to="/admin/contactos">Ver solicitudes</Link>
        </div>

        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="metric-grid" aria-label="Resumen de la academia">
          <article><span>Solicitudes nuevas</span><strong>{metrics?.newContacts ?? '—'}</strong><small><Link to="/admin/contactos">Abrir bandeja →</Link></small></article>
          <article><span>Alumnos activos</span><strong>{metrics?.activeStudents ?? '—'}</strong><small><Link to="/admin/alumnos">Gestionar alumnos →</Link></small></article>
          <article><span>Profesores activos</span><strong>{metrics?.activeTeachers ?? '—'}</strong><small><Link to="/admin/profesores">Gestionar equipo →</Link></small></article>
          <article><span>Archivos alumnos</span><strong>{metrics?.activeStudentFiles ?? '—'}</strong><small>Documentación privada activa</small></article>
          <article><span>Artículos</span><strong>{metrics?.blogPosts ?? '—'}</strong><small>{metrics ? `${metrics.blogDrafts} borradores` : 'Actualizando…'}</small></article>
        </section>

        <section className="admin-dashboard-priorities" aria-labelledby="admin-priorities-title">
          <div className="admin-dashboard-section-heading">
            <div>
              <span className="eyebrow">TRABAJO DIARIO</span>
              <h3 id="admin-priorities-title">Qué necesita atención</h3>
            </div>
            <p>Accesos directos a las tareas habituales de gestión.</p>
          </div>

          <div className="admin-action-grid">
            <article className="admin-action-card admin-action-featured">
              <span className="action-icon">MSG</span>
              <div><span className="eyebrow eyebrow-light">CONTACTOS</span><h3>Solicitudes de información</h3><p>Revisa mensajes de la web y controla si están nuevos, contactados o cerrados.</p></div>
              <Link to="/admin/contactos">Abrir bandeja →</Link>
            </article>
            <article className="admin-action-card admin-action-academic">
              <span className="action-icon">CLASE</span>
              <div><span className="eyebrow">ACADEMIA</span><h3>Clases y agenda</h3><p>Programa sesiones, revisa grupos y prepara el acceso presencial u online.</p></div>
              <Link to="/admin/clases">Gestionar clases →</Link>
            </article>
            <article className="admin-action-card admin-action-academic">
              <span className="action-icon">ALUM</span>
              <div><span className="eyebrow">ALUMNOS</span><h3>Gestión académica</h3><p>Altas, matrículas, grupos y seguimiento de las cuentas de alumno.</p></div>
              <Link to="/admin/alumnos">Ver alumnos →</Link>
            </article>
          </div>
        </section>

        <section className="admin-dashboard-content-tools" aria-labelledby="admin-content-tools-title">
          <div className="admin-dashboard-section-heading">
            <div>
              <span className="eyebrow">WEB Y CONTENIDO</span>
              <h3 id="admin-content-tools-title">Publicación y comunicación</h3>
            </div>
            <p>Herramientas de contenido que no necesitan interrumpir la gestión académica diaria.</p>
          </div>

          <div className="admin-action-grid admin-action-grid-secondary">
            <article className="admin-action-card">
              <span className="action-icon">WEB</span>
              <div><span className="eyebrow">CMS</span><h3>Editar página de inicio</h3><p>Cambia textos, llamadas a la acción, secciones e imágenes sin editar código.</p></div>
              <Link to="/admin/web">Abrir editor →</Link>
            </article>
            <article className="admin-action-card">
              <span className="action-icon">BLOG</span>
              <div><span className="eyebrow">CONTENIDO</span><h3>Blog</h3><p>Crea borradores, publica artículos y controla portada, autor y SEO.</p></div>
              <Link to="/admin/blog">Ver artículos →</Link>
            </article>
            <article className="admin-action-card">
              <span className="action-icon">IMG</span>
              <div><span className="eyebrow">MULTIMEDIA</span><h3>Biblioteca de imágenes</h3><p>Sube, reutiliza y organiza fotografías para la web y el blog.</p></div>
              <Link to="/admin/multimedia">Gestionar →</Link>
            </article>
          </div>
        </section>

        <div className="dashboard-two-columns admin-columns">
          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">WEB PÚBLICA</span><h3>Contenido editable</h3></div><span className="status success">Preparado</span></div>
            <div className="settings-list">
              <Link to="/admin/web"><span><strong>Portada</strong><small>Título, subtítulo, botones e imagen principal</small></span><b>→</b></Link>
              <Link to="/admin/web/sobre-nosotros"><span><strong>Sobre nosotros</strong><small>Historia, enfoque y valores</small></span><b>→</b></Link>
              <Link to="/admin/profesores/publicos"><span><strong>Profesores web</strong><small>Perfiles públicos sin exponer datos privados</small></span><b>→</b></Link>
              <Link to="/admin/configuracion"><span><strong>Identidad y contacto</strong><small>Logo, canales y datos generales</small></span><b>→</b></Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">BLOG</span><h3>Últimos contenidos</h3></div><Link to="/admin/blog">Gestionar</Link></div>
            <div className="content-list">
              {metrics?.recentPosts.map((post) => (
                <div key={post.id}>
                  <span className={`content-state ${post.status === 'PUBLISHED' ? 'published' : 'draft'}`}>{post.status === 'PUBLISHED' ? 'Publicado' : post.status === 'DRAFT' ? 'Borrador' : 'Archivado'}</span>
                  <div>
                    <strong>{post.title}</strong>
                    <small>{post.expand?.category?.name || 'Blog'} · {formatUpdated(post.updated)}</small>
                  </div>
                </div>
              ))}
              {metrics && metrics.recentPosts.length === 0 && (
                <div><span className="content-state draft">Vacío</span><div><strong>Todavía no hay artículos</strong><small>Crea el primero desde Blog.</small></div></div>
              )}
              {!metrics && !error && (
                <div><span className="content-state draft">...</span><div><strong>Actualizando Dashboard</strong><small>Actualizando datos de la academia.</small></div></div>
              )}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}
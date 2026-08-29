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
      <div className="dashboard-content">
        <div className="admin-intro">
          <div>
            <span className="eyebrow">CONTROL DE LA ACADEMIA</span>
            <h2>Gestiona la web y la plataforma sin tocar GitHub.</h2>
            <p>La plataforma conecta contenido público, academia, alumnos y solicitudes desde un único panel.</p>
          </div>
          <Link className="button button-primary" to="/admin/contactos">Ver solicitudes</Link>
        </div>

        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="metric-grid">
          <article><span>Solicitudes nuevas</span><strong>{metrics?.newContacts ?? '—'}</strong><small><Link to="/admin/contactos">Abrir bandeja →</Link></small></article>
          <article><span>Alumnos activos</span><strong>{metrics?.activeStudents ?? '—'}</strong><small>Usuarios STUDENT activos</small></article>
          <article><span>Profesores activos</span><strong>{metrics?.activeTeachers ?? '—'}</strong><small>Usuarios TEACHER activos</small></article>
          <article><span>Artículos</span><strong>{metrics?.blogPosts ?? '—'}</strong><small>{metrics ? `${metrics.blogDrafts} borradores` : 'Actualizando…'}</small></article>
          <article><span>Archivos alumnos</span><strong>{metrics?.activeStudentFiles ?? '—'}</strong><small>Archivos privados activos</small></article>
        </section>

        <div className="admin-action-grid">
          <article className="admin-action-card admin-action-featured">
            <span className="action-icon">WEB</span>
            <div><span className="eyebrow eyebrow-light">CMS</span><h3>Editar página de inicio</h3><p>Cambia textos, llamadas a la acción, secciones e imágenes sin editar código.</p></div>
            <Link to="/admin/web">Abrir editor →</Link>
          </article>
          <article className="admin-action-card">
            <span className="action-icon">MSG</span>
            <div><span className="eyebrow">CONTACTOS</span><h3>Solicitudes de información</h3><p>Revisa mensajes de la web y controla si están nuevos, contactados o cerrados.</p></div>
            <Link to="/admin/contactos">Abrir bandeja →</Link>
          </article>
          <article className="admin-action-card">
            <span className="action-icon">IMG</span>
            <div><span className="eyebrow">MULTIMEDIA</span><h3>Biblioteca de imágenes</h3><p>Sube, reutiliza y organiza fotografías para la web y el blog.</p></div>
            <Link to="/admin/multimedia">Gestionar →</Link>
          </article>
          <article className="admin-action-card">
            <span className="action-icon">BLOG</span>
            <div><span className="eyebrow">CONTENIDO</span><h3>Blog</h3><p>Crea borradores, publica artículos y controla portada, autor y SEO.</p></div>
            <Link to="/admin/blog">Ver artículos →</Link>
          </article>
        </div>

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

import { Link } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import { adminNav } from './adminNav'

export default function AdminDashboard() {
  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content">
        <div className="admin-intro">
          <div>
            <span className="eyebrow">CONTROL DE LA ACADEMIA</span>
            <h2>Gestiona la web y la plataforma sin tocar GitHub.</h2>
            <p>La V3 ya separa contenido público, blog y multimedia para que después cada acción se guarde en PocketBase.</p>
          </div>
          <Link className="button button-primary" to="/admin/blog">+ Nuevo artículo</Link>
        </div>

        <section className="metric-grid">
          <article><span>Alumnos activos</span><strong>36</strong><small>+3 este mes</small></article>
          <article><span>Profesores</span><strong>3</strong><small>Todos activos</small></article>
          <article><span>Artículos</span><strong>12</strong><small>2 borradores</small></article>
          <article><span>Archivos</span><strong>284</strong><small>Demo · SSD pendiente</small></article>
        </section>

        <div className="admin-action-grid">
          <article className="admin-action-card admin-action-featured">
            <span className="action-icon">WEB</span>
            <div><span className="eyebrow eyebrow-light">CMS</span><h3>Editar página de inicio</h3><p>Cambia textos, llamadas a la acción, secciones e imágenes sin editar código.</p></div>
            <Link to="/admin/web">Abrir editor →</Link>
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
              <Link to="/admin/web"><span><strong>Programas</strong><small>Kids, Teens, Adultos y Exámenes</small></span><b>→</b></Link>
              <Link to="/admin/web"><span><strong>Contacto</strong><small>Teléfono, email, horarios y ubicación</small></span><b>→</b></Link>
              <Link to="/admin/web"><span><strong>Identidad</strong><small>Logo, colores y datos generales</small></span><b>→</b></Link>
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading"><div><span className="eyebrow">BLOG</span><h3>Últimos contenidos</h3></div><Link to="/admin/blog">Nuevo</Link></div>
            <div className="content-list">
              <div><span className="content-state published">Publicado</span><div><strong>5 formas de ganar confianza al hablar</strong><small>Speaking · hoy</small></div></div>
              <div><span className="content-state draft">Borrador</span><div><strong>Guía B1 para septiembre</strong><small>Exams · editado ayer</small></div></div>
              <div><span className="content-state published">Publicado</span><div><strong>Vocabulario sin listas infinitas</strong><small>Vocabulary · hace 4 días</small></div></div>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

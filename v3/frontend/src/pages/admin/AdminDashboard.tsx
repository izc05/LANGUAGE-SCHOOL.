import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import DashboardShell from '../../components/DashboardShell'
import { countNewContactRequests } from '../../services/pocketbase/contactRequests'
import { adminNav } from './adminNav'

export default function AdminDashboard() {
  const [newContacts, setNewContacts] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    countNewContactRequests()
      .then((count) => { if (mounted) setNewContacts(count) })
      .catch(() => { if (mounted) setNewContacts(null) })
    return () => { mounted = false }
  }, [])

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content">
        <div className="admin-intro">
          <div>
            <span className="eyebrow">CONTROL DE LA ACADEMIA</span>
            <h2>Gestiona la web y la plataforma sin tocar GitHub.</h2>
            <p>La V3 conecta contenido público, academia y solicitudes con PocketBase desde un único panel.</p>
          </div>
          <Link className="button button-primary" to="/admin/contactos">Ver solicitudes</Link>
        </div>

        <section className="metric-grid">
          <article><span>Solicitudes nuevas</span><strong>{newContacts ?? '—'}</strong><small><Link to="/admin/contactos">Abrir bandeja →</Link></small></article>
          <article><span>Alumnos activos</span><strong>36</strong><small>Demo visual · se sustituirá por métrica real</small></article>
          <article><span>Profesores</span><strong>3</strong><small>Demo visual · se sustituirá por métrica real</small></article>
          <article><span>Artículos</span><strong>12</strong><small>Demo visual · se sustituirá por métrica real</small></article>
          <article><span>Archivos</span><strong>284</strong><small>Demo visual · SSD pendiente</small></article>
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
            <div className="panel-heading"><div><span className="eyebrow">CONTACTO</span><h3>Seguimiento comercial</h3></div><Link to="/admin/contactos">Ver todas</Link></div>
            <div className="content-list">
              <div><span className="content-state draft">Nuevas</span><div><strong>{newContacts ?? '—'} pendientes de revisar</strong><small>Mensajes recibidos desde el formulario público</small></div></div>
              <div><span className="content-state published">Flujo</span><div><strong>NEW → CONTACTED → CLOSED</strong><small>Sin eliminar el histórico de la solicitud</small></div></div>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

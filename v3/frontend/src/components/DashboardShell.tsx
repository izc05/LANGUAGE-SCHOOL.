import type { ReactNode } from 'react'
import { Link } from 'react-router'

type DashboardShellProps = {
  role: 'Alumno' | 'Profesor' | 'Administrador'
  name: string
  nav: string[]
  children: ReactNode
}

export default function DashboardShell({ role, name, nav, children }: DashboardShellProps) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" to="/">
          <span className="brand-mark">LS</span>
          <span><strong>Language School</strong><small>{role}</small></span>
        </Link>

        <nav className="dashboard-nav" aria-label={`Menú de ${role}`}>
          {nav.map((item, index) => (
            <button className={index === 0 ? 'active' : ''} type="button" key={item}>
              <span className="nav-dot" /> {item}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/">Volver a la web</Link>
          <small>Vista de desarrollo · PocketBase pendiente</small>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <span className="eyebrow">{role}</span>
            <h1>Hola, {name}</h1>
          </div>
          <div className="user-chip">
            <span>{name.charAt(0)}</span>
            <div><strong>{name}</strong><small>{role}</small></div>
          </div>
        </header>
        {children}
      </section>
    </div>
  )
}

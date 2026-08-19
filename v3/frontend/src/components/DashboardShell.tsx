import { Fragment, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import BackendStatusBanner from './BackendStatusBanner'
import { useBackendHealth } from '../hooks/useBackendHealth'
import { useAcademyBrand } from '../hooks/useAcademyBrand'
import { useAuth } from '../features/auth/AuthProvider'
import type { UserRole } from '../services/pocketbase/types'

type NavItem = string | { label: string; to: string; section?: string }

type DashboardShellProps = {
  role: 'Alumno' | 'Profesor' | 'Administrador'
  name: string
  nav: readonly NavItem[]
  children: ReactNode
}

function roleLabel(role: UserRole): DashboardShellProps['role'] {
  if (role === 'ADMIN') return 'Administrador'
  if (role === 'TEACHER') return 'Profesor'
  return 'Alumno'
}

export default function DashboardShell({ role, name, nav, children }: DashboardShellProps) {
  const navigate = useNavigate()
  const { academyName, logoUrl, initials } = useAcademyBrand()
  const { unavailable, retry } = useBackendHealth()
  const { user, isDemoMode, logout } = useAuth()

  const effectiveRole = !isDemoMode && user ? roleLabel(user.role) : role
  const effectiveName = !isDemoMode && user
    ? [user.name, user.surname].filter(Boolean).join(' ').trim() || user.email
    : name
  const roleClass = effectiveRole === 'Alumno'
    ? 'dashboard-shell-student'
    : effectiveRole === 'Profesor'
      ? 'dashboard-shell-teacher'
      : 'dashboard-shell-admin'

  function handleLogout() {
    logout()
    navigate('/acceso', { replace: true })
  }

  return (
    <div className={`dashboard-shell ${roleClass}`}>
      <a className="skip-link" href="#main-content">Saltar al contenido</a>
      <aside className="dashboard-sidebar">
        <Link className="brand dashboard-brand" to="/" aria-label={`${academyName} - Inicio`}>
          {logoUrl
            ? <img className="brand-logo-image" src={logoUrl} alt="" />
            : <span className="brand-mark">{initials}</span>}
          <span><strong>{academyName}</strong><small>{effectiveRole}</small></span>
        </Link>

        <nav className="dashboard-nav" aria-label={`Menú de ${effectiveRole}`}>
          {nav.map((item, index) => {
            if (typeof item === 'string') {
              return (
                <button className={index === 0 ? 'active' : ''} type="button" key={item}>
                  <span className="nav-dot" /> {item}
                </button>
              )
            }

            return (
              <Fragment key={item.to}>
                {item.section && <span className="dashboard-nav-section" aria-hidden="true">{item.section}</span>}
                <NavLink
                  to={item.to}
                  end
                  className={({ isActive }) => isActive ? 'active' : undefined}
                >
                  <span className="nav-dot" /> {item.label}
                </NavLink>
              </Fragment>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <Link to="/">Volver a la web</Link>
          <small>{isDemoMode ? 'Vista de desarrollo · modo demo' : 'Sesión segura · acceso privado'}</small>
        </div>
      </aside>

      <section className="dashboard-main" id="main-content" tabIndex={-1}>
        <BackendStatusBanner visible={unavailable} onRetry={() => void retry()} />
        <header className="dashboard-topbar">
          <div>
            <span className="eyebrow">{effectiveRole}</span>
            <h1>Hola, {effectiveName}</h1>
          </div>
          <div className="session-actions">
            <div className="user-chip">
              <span>{effectiveName.charAt(0).toUpperCase()}</span>
              <div><strong>{effectiveName}</strong><small>{effectiveRole}</small></div>
            </div>
            {!isDemoMode && (
              <button className="session-logout" type="button" onClick={handleLogout}>Cerrar sesión</button>
            )}
          </div>
        </header>
        {children}
      </section>
    </div>
  )
}
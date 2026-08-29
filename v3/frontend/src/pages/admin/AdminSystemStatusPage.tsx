import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { appMode, pocketBaseUrl } from '../../config/environment'
import { checkBackendHealth, type BackendHealth } from '../../services/pocketbase/health'
import { adminNav } from './adminNav'

function formatCheckedAt(value: string): string {
  if (!value) return 'Todavía no comprobado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'medium' }).format(date)
}

function publicApiOrigin(): string {
  try {
    const url = new URL(pocketBaseUrl, window.location.origin)
    return url.origin
  } catch {
    return 'Configuración no válida'
  }
}

export default function AdminSystemStatusPage() {
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apiOrigin = useMemo(publicApiOrigin, [])

  async function refresh() {
    setChecking(true)
    setError(null)
    try {
      const result = await checkBackendHealth(5000)
      setHealth(result)
      if (!result.ok) setError('PocketBase no está respondiendo correctamente.')
    } catch {
      setError('No se ha podido comprobar el estado del backend.')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page system-status-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">SISTEMA · DIAGNÓSTICO</span>
            <h2>Estado de la plataforma</h2>
            <p>Comprobación rápida de la conexión entre el frontend y PocketBase sin mostrar credenciales ni datos de sesión.</p>
          </div>
          <button className="button button-primary" type="button" onClick={() => void refresh()} disabled={checking}>
            {checking ? 'Comprobando…' : 'Volver a comprobar'}
          </button>
        </header>

        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="system-status-grid">
          <article className="panel system-status-card">
            <span className="eyebrow">BACKEND</span>
            <div className="system-status-value">
              <span className={`system-status-dot ${health?.ok ? 'ok' : 'down'}`} aria-hidden="true" />
              <strong>{health ? (health.ok ? 'Operativo' : 'No disponible') : 'Comprobando'}</strong>
            </div>
            <small>Endpoint `/api/health`</small>
          </article>

          <article className="panel system-status-card">
            <span className="eyebrow">LATENCIA</span>
            <strong className="system-status-number">{health ? `${health.latencyMs} ms` : '—'}</strong>
            <small>Tiempo de respuesta de la última comprobación</small>
          </article>

          <article className="panel system-status-card">
            <span className="eyebrow">MODO</span>
            <strong className="system-status-number">{appMode}</strong>
            <small>{appMode === 'connected' ? 'Frontend conectado a PocketBase' : 'Datos de demostración'}</small>
          </article>

          <article className="panel system-status-card">
            <span className="eyebrow">API</span>
            <strong className="system-status-origin">{apiOrigin}</strong>
            <small>Solo se muestra el origen público; nunca tokens o contraseñas.</small>
          </article>
        </section>

        <section className="panel system-status-detail">
          <div className="panel-heading"><div><span className="eyebrow">ÚLTIMA COMPROBACIÓN</span><h3>{formatCheckedAt(health?.checkedAt || '')}</h3></div></div>
          <div className="system-status-checklist">
            <div><span>Frontend</span><strong>Aplicación cargada</strong></div>
            <div><span>PocketBase</span><strong>{health?.ok ? 'Health-check correcto' : 'Pendiente / sin respuesta'}</strong></div>
            <div><span>Modo de datos</span><strong>{appMode === 'connected' ? 'Connected' : 'Demo'}</strong></div>
            <div><span>Secretos</span><strong>No se muestran en esta pantalla</strong></div>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

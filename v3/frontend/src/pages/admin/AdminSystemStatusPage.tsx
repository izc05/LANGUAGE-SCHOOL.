import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { appMode, pocketBaseUrl } from '../../config/environment'
import { checkBackendHealth, type BackendHealth } from '../../services/pocketbase/health'
import { listPlacementAdminTests, type PlacementAdminTest } from '../../services/pocketbase/placementAdmin'
import { getZoomIntegrationStatus, type ZoomIntegrationStatus } from '../../services/pocketbase/zoomIntegration'
import { adminNav } from './adminNav'

type DiagnosticState<T> = {
  status: 'loading' | 'ready' | 'unavailable'
  value: T | null
}

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

function loadingDiagnostic<T>(): DiagnosticState<T> {
  return { status: 'loading', value: null }
}

export default function AdminSystemStatusPage() {
  const [health, setHealth] = useState<BackendHealth | null>(null)
  const [zoom, setZoom] = useState<DiagnosticState<ZoomIntegrationStatus>>(loadingDiagnostic)
  const [placement, setPlacement] = useState<DiagnosticState<PlacementAdminTest>>(loadingDiagnostic)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apiOrigin = useMemo(publicApiOrigin, [])

  async function refresh() {
    setChecking(true)
    setError(null)
    setZoom(loadingDiagnostic())
    setPlacement(loadingDiagnostic())

    const [healthResult, zoomResult, testsResult] = await Promise.allSettled([
      checkBackendHealth(5000),
      getZoomIntegrationStatus(),
      listPlacementAdminTests(),
    ])

    if (healthResult.status === 'fulfilled') {
      setHealth(healthResult.value)
      if (!healthResult.value.ok) setError('PocketBase no está respondiendo correctamente.')
    } else {
      setHealth(null)
      setError('No se ha podido comprobar el estado del backend.')
    }

    setZoom(zoomResult.status === 'fulfilled'
      ? { status: 'ready', value: zoomResult.value }
      : { status: 'unavailable', value: null })

    if (testsResult.status === 'fulfilled') {
      setPlacement({
        status: 'ready',
        value: testsResult.value.find((test) => test.status === 'PUBLISHED') ?? null,
      })
    } else {
      setPlacement({ status: 'unavailable', value: null })
    }

    setChecking(false)
  }

  useEffect(() => {
    void refresh()
  }, [])

  const zoomLabel = zoom.status === 'loading'
    ? 'Comprobando'
    : zoom.status === 'unavailable'
      ? 'No disponible'
      : zoom.value?.configured
        ? 'Preparado'
        : 'Pendiente'

  const placementLabel = placement.status === 'loading'
    ? 'Comprobando'
    : placement.status === 'unavailable'
      ? 'No disponible'
      : placement.value
        ? 'Publicado'
        : 'Sin publicar'

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page system-status-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">SISTEMA · DIAGNÓSTICO</span>
            <h2>Estado de la plataforma</h2>
            <p>Comprobación segura de los servicios críticos sin mostrar credenciales ni datos de sesión.</p>
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
            <small>Solo se muestra el origen público.</small>
          </article>

          <article className="panel system-status-card" data-testid="system-zoom-status">
            <span className="eyebrow">ZOOM</span>
            <strong className="system-status-number">{zoomLabel}</strong>
            <small>
              {zoom.status === 'ready' && zoom.value
                ? `API ${zoom.value.meetingCreationConfigured ? 'lista' : 'pendiente'} · SDK ${zoom.value.meetingSdkConfigured ? 'listo' : 'pendiente'}`
                : 'Estado seguro de configuración server-side'}
            </small>
          </article>

          <article className="panel system-status-card" data-testid="system-placement-status">
            <span className="eyebrow">TEST DE NIVEL</span>
            <strong className="system-status-number">{placementLabel}</strong>
            <small>
              {placement.status === 'ready' && placement.value
                ? `${placement.value.version} · ${placement.value.algorithmVersion}`
                : 'Versión académica activa'}
            </small>
          </article>
        </section>

        <section className="panel system-status-detail">
          <div className="panel-heading"><div><span className="eyebrow">ÚLTIMA COMPROBACIÓN</span><h3>{formatCheckedAt(health?.checkedAt || '')}</h3></div></div>
          <div className="system-status-checklist">
            <div><span>Frontend</span><strong>Aplicación cargada</strong></div>
            <div><span>PocketBase</span><strong>{health?.ok ? 'Health-check correcto' : 'Pendiente / sin respuesta'}</strong></div>
            <div><span>Modo de datos</span><strong>{appMode === 'connected' ? 'Connected' : 'Demo'}</strong></div>
            <div><span>Zoom</span><strong>{zoomLabel}</strong></div>
            <div><span>Test de nivel</span><strong>{placementLabel}</strong></div>
            <div><span>Secretos</span><strong>No se muestran en esta pantalla</strong></div>
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

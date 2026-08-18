import { useEffect, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import { getZoomIntegrationStatus, type ZoomIntegrationStatus } from '../../services/pocketbase/zoomIntegration'
import { adminNav } from './adminNav'

const demoStatus: ZoomIntegrationStatus = {
  provider: 'zoom',
  source: 'server_environment',
  apiConfigured: false,
  meetingSdkConfigured: false,
  configured: false,
}

export default function AdminZoomIntegrationPage() {
  const { isDemoMode } = useAuth()
  const [status, setStatus] = useState<ZoomIntegrationStatus | null>(isDemoMode ? demoStatus : null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    getZoomIntegrationStatus()
      .then((result) => { if (mounted) setStatus(result) })
      .catch(() => { if (mounted) setError('No se ha podido comprobar la configuración de Zoom en el servidor.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page zoom-integration-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CAMPUS · VIDEOCONFERENCIA</span>
            <h2>Integración con Zoom</h2>
            <p>Comprueba si el servidor tiene preparada la API de Zoom y el Meeting SDK. Las credenciales nunca se muestran ni se guardan en el navegador.</p>
          </div>
        </header>

        {loading && <div className="cms-notice" role="status">Comprobando Zoom…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {status && (
          <>
            <section className={`zoom-connection-card ${status.configured ? 'is-ready' : 'is-pending'}`}>
              <div>
                <span className="eyebrow">ESTADO DEL SERVIDOR</span>
                <h3>{status.configured ? 'Zoom preparado para conectar el Campus.' : 'Credenciales de Zoom pendientes.'}</h3>
                <p>{status.configured ? 'La API y el Meeting SDK están configurados en el servidor. El siguiente paso será crear reuniones desde las clases.' : 'La estructura segura ya está lista. Falta añadir las credenciales privadas al servidor antes de crear o incrustar reuniones reales.'}</p>
              </div>
              <span className={`zoom-status-pill ${status.configured ? 'success' : 'warning'}`}>{status.configured ? 'Preparado' : 'Pendiente'}</span>
            </section>

            <section className="zoom-capability-grid" aria-label="Estado técnico de Zoom">
              <article><span>01</span><div><small>ZOOM API</small><strong>{status.apiConfigured ? 'Configurada' : 'Pendiente'}</strong><p>Creación y gestión de reuniones desde el servidor.</p></div></article>
              <article><span>02</span><div><small>MEETING SDK</small><strong>{status.meetingSdkConfigured ? 'Configurado' : 'Pendiente'}</strong><p>Videoclase incrustada dentro del Campus.</p></div></article>
              <article><span>03</span><div><small>SEGURIDAD</small><strong>Servidor</strong><p>Los secretos permanecen fuera de React y del CMS.</p></div></article>
            </section>

            <section className="panel zoom-next-step-panel">
              <div className="panel-heading"><div><span className="eyebrow">SIGUIENTE PASO</span><h3>Conectar la cuenta de la academia</h3></div></div>
              <div className="zoom-next-step-copy">
                <p>Cuando dispongamos de las credenciales de la cuenta Zoom de Language School, se añadirán únicamente al entorno del servidor.</p>
                <code>ZOOM_ACCOUNT_ID · ZOOM_CLIENT_ID · ZOOM_CLIENT_SECRET</code>
                <code>ZOOM_MEETING_SDK_CLIENT_ID · ZOOM_MEETING_SDK_CLIENT_SECRET</code>
                <p className="muted">Admin solo consulta si están configuradas; nunca puede leer sus valores.</p>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

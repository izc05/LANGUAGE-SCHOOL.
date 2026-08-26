import { useEffect, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  checkZoomApiConnection,
  getZoomIntegrationStatus,
  type ZoomConnectionCheck,
  type ZoomIntegrationStatus,
} from '../../services/pocketbase/zoomIntegration'
import { adminNav } from './adminNav'

const demoStatus: ZoomIntegrationStatus = {
  provider: 'zoom',
  source: 'server_environment',
  apiConfigured: false,
  hostUserConfigured: false,
  meetingCreationConfigured: false,
  meetingSdkConfigured: false,
  configured: false,
}

export default function AdminZoomIntegrationPage() {
  const { isDemoMode } = useAuth()
  const [status, setStatus] = useState<ZoomIntegrationStatus | null>(isDemoMode ? demoStatus : null)
  const [connection, setConnection] = useState<ZoomConnectionCheck | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [checking, setChecking] = useState(false)
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

  async function handleConnectionCheck() {
    if (isDemoMode || !status?.apiConfigured) return
    setChecking(true)
    setError(null)
    setConnection(null)
    try {
      setConnection(await checkZoomApiConnection())
    } catch {
      setError('No se ha podido completar la prueba de conexión con Zoom.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page zoom-integration-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CAMPUS · VIDEOCONFERENCIA</span>
            <h2>Integración con Zoom</h2>
            <p>Comprueba si el servidor puede crear reuniones y autorizar el Meeting SDK. Las credenciales nunca se muestran ni se guardan en el navegador.</p>
          </div>
        </header>

        {loading && <div className="cms-notice" role="status">Comprobando Zoom…</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        {status && (
          <>
            <section className={`zoom-connection-card ${status.configured ? 'is-ready' : 'is-pending'}`}>
              <div>
                <span className="eyebrow">ESTADO DEL SERVIDOR</span>
                <h3>{status.configured ? 'Zoom preparado para conectar el Campus.' : 'Configuración de Zoom pendiente.'}</h3>
                <p>{status.configured ? 'Creación de reuniones y Meeting SDK están preparados en el servidor.' : 'La estructura segura ya está lista. Completa la cuenta anfitriona, las credenciales API y el Meeting SDK en el servidor.'}</p>
              </div>
              <span className={`zoom-status-pill ${status.configured ? 'success' : 'warning'}`}>{status.configured ? 'Preparado' : 'Pendiente'}</span>
            </section>

            <section className="zoom-capability-grid" aria-label="Estado técnico de Zoom">
              <article><span>01</span><div><small>ZOOM API</small><strong>{status.apiConfigured ? 'Configurada' : 'Pendiente'}</strong><p>Server-to-Server OAuth para operar contra la API de la cuenta.</p></div></article>
              <article><span>02</span><div><small>ANFITRIÓN</small><strong>{status.hostUserConfigured ? 'Configurado' : 'Pendiente'}</strong><p>Usuario Zoom que será propietario de las reuniones creadas por Language School.</p></div></article>
              <article><span>03</span><div><small>CREAR REUNIONES</small><strong>{status.meetingCreationConfigured ? 'Preparado' : 'Pendiente'}</strong><p>API y anfitrión disponibles para programar Zoom desde Aula online.</p></div></article>
              <article><span>04</span><div><small>MEETING SDK</small><strong>{status.meetingSdkConfigured ? 'Configurado' : 'Pendiente'}</strong><p>Autorización de la videoclase incrustada dentro del Campus.</p></div></article>
            </section>

            <section className="panel zoom-api-check-panel">
              <div className="panel-heading"><div><span className="eyebrow">SERVER-TO-SERVER OAUTH</span><h3>Comprobar conexión con la cuenta Zoom</h3></div></div>
              <div className="zoom-api-check-copy">
                <p>La prueba solicita un token temporal directamente desde PocketBase y consulta la identidad de la cuenta. El token y las credenciales no se devuelven al navegador.</p>
                <button className="button button-primary" type="button" onClick={() => void handleConnectionCheck()} disabled={!status.apiConfigured || checking || isDemoMode}>
                  {checking ? 'Comprobando…' : status.apiConfigured ? 'Probar conexión API' : 'Añade primero las credenciales'}
                </button>
                {connection?.connected && <div className="zoom-check-result success" role="status"><strong>Conexión correcta.</strong><span>{connection.accountUser?.displayName || 'Cuenta Zoom'} · {connection.accountUser?.id || 'ID verificado'}</span></div>}
                {connection && !connection.connected && <div className="zoom-check-result warning" role="status"><strong>No se ha conectado.</strong><span>{connection.reason === 'missing_credentials' ? 'Faltan credenciales en el servidor.' : connection.reason === 'oauth_failed' ? 'Zoom ha rechazado la autenticación OAuth.' : connection.reason === 'api_failed' ? 'OAuth funciona, pero la llamada a la API ha fallado.' : 'No se ha podido contactar con Zoom.'}</span></div>}
                {!status.apiConfigured && <small className="muted">Esta comprobación se habilitará cuando `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID` y `ZOOM_CLIENT_SECRET` estén definidos en el servidor.</small>}
              </div>
            </section>

            <section className="panel zoom-next-step-panel">
              <div className="panel-heading"><div><span className="eyebrow">CONFIGURACIÓN PRIVADA</span><h3>Variables que necesita el servidor</h3></div></div>
              <div className="zoom-next-step-copy">
                <p>Las credenciales y el usuario anfitrión de la cuenta Zoom de Language School se añaden únicamente al entorno del servidor.</p>
                <code>ZOOM_ACCOUNT_ID · ZOOM_CLIENT_ID · ZOOM_CLIENT_SECRET · ZOOM_HOST_USER_ID</code>
                <code>ZOOM_MEETING_SDK_CLIENT_ID · ZOOM_MEETING_SDK_CLIENT_SECRET</code>
                <p className="muted">Admin solo consulta si existen y puede probar la conexión. Nunca puede leer sus valores.</p>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardShell>
  )
}

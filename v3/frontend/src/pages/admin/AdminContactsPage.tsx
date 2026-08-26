import { useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  demoContactRequests,
  listContactRequests,
  updateContactRequestStatus,
  type ContactRequestRecord,
  type ContactRequestStatus,
} from '../../services/pocketbase/contactRequests'
import { adminNav } from './adminNav'

type Filter = 'ALL' | ContactRequestStatus

const filters: { label: string; value: Filter }[] = [
  { label: 'Todas', value: 'ALL' },
  { label: 'Nuevas', value: 'NEW' },
  { label: 'Contactadas', value: 'CONTACTED' },
  { label: 'Cerradas', value: 'CLOSED' },
]

const statusLabels: Record<ContactRequestStatus, string> = {
  NEW: 'Nueva',
  CONTACTED: 'Contactada',
  CLOSED: 'Cerrada',
}

function formatDate(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export default function AdminContactsPage() {
  const [requests, setRequests] = useState<ContactRequestRecord[]>(isDemoMode ? demoContactRequests : [])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [loading, setLoading] = useState(!isDemoMode)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoading(true)
    listContactRequests('ALL')
      .then((records) => { if (mounted) setRequests(records) })
      .catch(() => { if (mounted) setError('No se han podido cargar las solicitudes de contacto.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const counts = useMemo(() => ({
    ALL: requests.length,
    NEW: requests.filter((item) => item.status === 'NEW').length,
    CONTACTED: requests.filter((item) => item.status === 'CONTACTED').length,
    CLOSED: requests.filter((item) => item.status === 'CLOSED').length,
  }), [requests])

  const visible = useMemo(
    () => filter === 'ALL' ? requests : requests.filter((item) => item.status === filter),
    [filter, requests],
  )

  async function setStatus(record: ContactRequestRecord, status: ContactRequestStatus) {
    setError(null)
    setNotice(null)
    setUpdatingId(record.id)

    if (isDemoMode) {
      setRequests((current) => current.map((item) => item.id === record.id ? { ...item, status } : item))
      setUpdatingId(null)
      setNotice(`Modo demo: solicitud marcada como ${statusLabels[status].toLowerCase()}.`)
      return
    }

    try {
      const updated = await updateContactRequestStatus(record.id, status)
      setRequests((current) => current.map((item) => item.id === updated.id ? updated : item))
      setNotice(`Solicitud de ${record.name} marcada como ${statusLabels[status].toLowerCase()}.`)
    } catch {
      setError('No se ha podido cambiar el estado de la solicitud.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page contacts-admin-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CONTACTO · BANDEJA</span>
            <h2>Solicitudes de información</h2>
            <p>Todo mensaje enviado desde la web entra aquí. El histórico se conserva y solo cambia su estado.</p>
          </div>
          <span className={`status ${counts.NEW > 0 ? 'warning' : 'success'}`}>{counts.NEW} nuevas</span>
        </header>

        {notice && <div className="cms-notice success-notice" role="status">{notice}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="contact-filter-bar" aria-label="Filtrar solicitudes">
          {filters.map((item) => (
            <button
              className={`contact-filter ${filter === item.value ? 'active' : ''}`}
              type="button"
              key={item.value}
              onClick={() => setFilter(item.value)}
            >
              <span>{item.label}</span>
              <strong>{counts[item.value]}</strong>
            </button>
          ))}
        </div>

        {loading && <div className="panel public-empty-state">Cargando solicitudes…</div>}
        {!loading && visible.length === 0 && <div className="panel public-empty-state">No hay solicitudes en este estado.</div>}

        <div className="contact-request-list">
          {visible.map((request) => (
            <article className={`panel contact-request-card status-${request.status.toLowerCase()}`} key={request.id}>
              <div className="contact-request-head">
                <div>
                  <span className="eyebrow">{request.interest || 'INFORMACIÓN GENERAL'}</span>
                  <h3>{request.name}</h3>
                  <small>Recibida {formatDate(request.created)}</small>
                </div>
                <span className={`contact-request-status ${request.status.toLowerCase()}`}>{statusLabels[request.status]}</span>
              </div>

              {request.placement_level && (
                <div className="contact-placement-context" aria-label={`Resultado de test ${request.placement_level}`}>
                  <div><span>TEST DE NIVEL ASOCIADO</span><strong>{request.placement_level}</strong></div>
                  <div><span>Puntuación</span><strong>{Math.round(request.placement_score ?? 0)}%</strong></div>
                  <p>Resultado adjuntado por el servidor desde el intento del visitante; no procede de un campo editable del formulario.</p>
                </div>
              )}

              <div className="contact-request-channels">
                <a href={`mailto:${request.email}`}><span>Email</span><strong>{request.email}</strong></a>
                {request.phone
                  ? <a href={`tel:${request.phone}`}><span>Teléfono</span><strong>{request.phone}</strong></a>
                  : <div><span>Teléfono</span><strong>No indicado</strong></div>}
              </div>

              <div className="contact-request-message">
                <span>Mensaje</span>
                <p>{request.message}</p>
              </div>

              <div className="contact-request-actions">
                {request.status !== 'NEW' && (
                  <button className="button button-ghost" type="button" disabled={updatingId === request.id} onClick={() => void setStatus(request, 'NEW')}>Marcar nueva</button>
                )}
                {request.status !== 'CONTACTED' && (
                  <button className="button button-outline" type="button" disabled={updatingId === request.id} onClick={() => void setStatus(request, 'CONTACTED')}>Marcar contactada</button>
                )}
                {request.status !== 'CLOSED' && (
                  <button className="button button-primary" type="button" disabled={updatingId === request.id} onClick={() => void setStatus(request, 'CLOSED')}>Cerrar solicitud</button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}

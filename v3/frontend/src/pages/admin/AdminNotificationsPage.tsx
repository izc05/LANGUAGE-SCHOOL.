import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import {
  listAdminNotifications,
  listNotificationRecipients,
  sendAdminNotifications,
  type AdminNotificationRecord,
  type AdminNotificationType,
  type NotificationRecipientRole,
} from '../../services/pocketbase/adminNotifications'
import type { AppUser } from '../../services/pocketbase/types'
import { adminNav } from './adminNav'

const types: { value: AdminNotificationType; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'CLASS', label: 'Clase' },
  { value: 'MATERIAL', label: 'Material' },
  { value: 'ASSIGNMENT', label: 'Tarea' },
  { value: 'SYSTEM', label: 'Sistema' },
]

function fullName(user?: AppUser): string {
  if (!user) return 'Destinatario'
  return [user.name, user.surname].filter(Boolean).join(' ').trim() || user.email
}

function formatDate(value: string): string {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function AdminNotificationsPage() {
  const [recipients, setRecipients] = useState<AppUser[]>([])
  const [history, setHistory] = useState<AdminNotificationRecord[]>([])
  const [audience, setAudience] = useState<NotificationRecipientRole>('STUDENT')
  const [recipientMode, setRecipientMode] = useState<'ONE' | 'ALL'>('ONE')
  const [recipientId, setRecipientId] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState<AdminNotificationType>('GENERAL')
  const [loading, setLoading] = useState(!isDemoMode)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    if (isDemoMode) {
      const recipients = await listNotificationRecipients(audience)
      setRecipients(recipients)
      setRecipientId(recipients[0]?.id ?? '')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [recipients, records] = await Promise.all([
        listNotificationRecipients(audience),
        listAdminNotifications(),
      ])
      setRecipients(recipients)
      setHistory(records)
      setRecipientId((current) => current || recipients[0]?.id || '')
    } catch {
      setError('No se ha podido cargar el centro de avisos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [audience])

  const activeRecipients = recipients.length
  const audienceLabel = audience === 'TEACHER' ? 'profesorado' : 'alumnado'
  const singularAudienceLabel = audience === 'TEACHER' ? 'profesor' : 'alumno'
  const unreadHistory = useMemo(() => history.filter((item) => !item.read_at).length, [history])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setError(null)

    const cleanTitle = title.trim()
    const cleanBody = body.trim()
    const recipientIds = recipientMode === 'ALL' ? recipients.map((recipient) => recipient.id) : [recipientId]

    if (!cleanTitle || !cleanBody) {
      setError('Escribe un título y un mensaje.')
      return
    }

    if (recipientIds.filter(Boolean).length === 0) {
      setError(`No hay ${audienceLabel} activo disponible para recibir el aviso.`)
      return
    }

    setSending(true)
    try {
      const sent = await sendAdminNotifications({ recipientIds, title: cleanTitle, body: cleanBody, type })
      setNotice(`Aviso enviado a ${sent} ${sent === 1 ? singularAudienceLabel : audienceLabel}.`)
      setTitle('')
      setBody('')
      setType('GENERAL')
      if (!isDemoMode) setHistory(await listAdminNotifications())
    } catch {
      setError('No se ha podido enviar el aviso.')
    } finally {
      setSending(false)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page notifications-admin-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">COMUNICACIÓN · AVISOS</span>
            <h2>Centro de avisos</h2>
            <p>Envía mensajes dentro de los espacios privados de alumnado y profesorado sin depender de WhatsApp o correo.</p>
          </div>
          <div className="notification-admin-metrics">
            <span className="status info">{activeRecipients} {audience === 'TEACHER' ? (activeRecipients === 1 ? 'profesor activo' : 'profesores activos') : (activeRecipients === 1 ? 'alumno activo' : 'alumnos activos')}</span>
            {!isDemoMode && <span className="status warning">{unreadHistory} sin leer</span>}
          </div>
        </header>

        {notice && <div className="cms-notice success-notice" role="status">{notice}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="notification-admin-grid">
          <form className="panel cms-form notification-compose" onSubmit={handleSubmit}>
            <div className="panel-heading"><div><span className="eyebrow">NUEVO AVISO</span><h3>Redactar mensaje</h3></div></div>

            <fieldset className="notification-recipient-mode">
              <legend>Destinatarios</legend>
              <label><input type="radio" name="audience" checked={audience === 'STUDENT'} onChange={() => { setAudience('STUDENT'); setRecipientId('') }} /> Alumnado</label>
              <label><input type="radio" name="audience" checked={audience === 'TEACHER'} onChange={() => { setAudience('TEACHER'); setRecipientId('') }} /> Profesorado</label>
            </fieldset>

            <fieldset className="notification-recipient-mode">
              <legend>Alcance</legend>
              <label><input type="radio" name="recipientMode" checked={recipientMode === 'ONE'} onChange={() => setRecipientMode('ONE')} /> Un {singularAudienceLabel}</label>
              <label><input type="radio" name="recipientMode" checked={recipientMode === 'ALL'} onChange={() => setRecipientMode('ALL')} /> Todo el {audienceLabel} activo</label>
            </fieldset>

            {recipientMode === 'ONE' && (
              <label className="field-stack">
                <span>{audience === 'TEACHER' ? 'Profesor' : 'Alumno'}</span>
                <select value={recipientId} onChange={(event) => setRecipientId(event.target.value)} disabled={loading || recipients.length === 0}>
                  {recipients.length === 0 && <option value="">Sin {audienceLabel} activo</option>}
                  {recipients.map((recipient) => <option value={recipient.id} key={recipient.id}>{fullName(recipient)}</option>)}
                </select>
              </label>
            )}

            {recipientMode === 'ALL' && <div className="notification-audience-note">Se crearán {activeRecipients} avisos individuales, uno para cada persona activa del {audienceLabel}.</div>}

            <label className="field-stack"><span>Tipo</span><select value={type} onChange={(event) => setType(event.target.value as AdminNotificationType)}>{types.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className="field-stack"><span>Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={220} required /></label>
            <label className="field-stack"><span>Mensaje</span><textarea rows={7} value={body} onChange={(event) => setBody(event.target.value)} maxLength={3000} required /></label>
            <button className="button button-primary" type="submit" disabled={sending || loading}>{sending ? 'Enviando…' : 'Enviar aviso'}</button>
          </form>

          <section className="panel notification-history">
            <div className="panel-heading"><div><span className="eyebrow">HISTÓRICO</span><h3>Últimos avisos</h3></div></div>
            {loading && <div className="public-empty-state">Cargando avisos…</div>}
            {!loading && history.length === 0 && <div className="public-empty-state">Todavía no hay avisos enviados desde ADMIN.</div>}
            <div className="notification-history-list">
              {history.map((record) => (
                <article key={record.id}>
                  <div>
                    <span className="notification-type-chip">{record.type}</span>
                    <strong>{record.title}</strong>
                  </div>
                  <p>{record.body}</p>
                  <small>{fullName(record.expand?.recipient)} · {formatDate(record.created)} · {record.read_at ? 'Leído' : 'Sin leer'}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

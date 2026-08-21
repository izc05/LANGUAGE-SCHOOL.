import { useEffect, useState } from 'react'
import {
  getAdminAccountInvitationStatus,
  reissueAdminAccountInvitation,
  revokeAdminAccountInvitation,
  type AdminAccountInvitationStatus,
  type AdminAccountInvitationStatusResponse,
} from '../services/pocketbase/accountInvitations'
import type { UserStatus } from '../services/pocketbase/types'

type Props = {
  userId: string
  accountStatus: UserStatus
  isDemoMode: boolean
}

function invitationLabel(status?: AdminAccountInvitationStatus): string {
  if (status === 'PENDING') return 'Pendiente'
  if (status === 'EXPIRED') return 'Caducada'
  if (status === 'USED') return 'Utilizada'
  if (status === 'REVOKED') return 'Revocada'
  return 'Sin invitación'
}

function accountLabel(status: UserStatus): string {
  if (status === 'ACTIVE') return 'Cuenta activada'
  if (status === 'INVITED') return 'Pendiente de activación'
  if (status === 'SUSPENDED') return 'Cuenta suspendida'
  return 'Cuenta no activa'
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('No se ha podido copiar el enlace.')
}

export default function AdminAccountInvitationCard({ userId, accountStatus, isDemoMode }: Props) {
  const [status, setStatus] = useState<AdminAccountInvitationStatusResponse | null>(
    isDemoMode
      ? { userId, accountStatus, invitationStatus: accountStatus === 'INVITED' ? 'PENDING' : 'NONE' }
      : null,
  )
  const [activationUrl, setActivationUrl] = useState('')
  const [loading, setLoading] = useState(!isDemoMode)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode || !userId) return
    let mounted = true
    setLoading(true)
    getAdminAccountInvitationStatus(userId)
      .then((record) => { if (mounted) setStatus(record) })
      .catch(() => { if (mounted) setError('No se ha podido consultar el estado de la invitación.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode, userId])

  const effectiveAccountStatus = status?.accountStatus || accountStatus
  const canManageInvitation = effectiveAccountStatus === 'INVITED' && !isDemoMode

  async function refreshStatus() {
    const record = await getAdminAccountInvitationStatus(userId)
    setStatus(record)
    return record
  }

  async function reissue() {
    if (!canManageInvitation) return
    setBusy(true); setError(null); setMessage(null); setActivationUrl('')
    try {
      const issued = await reissueAdminAccountInvitation(userId)
      setActivationUrl(issued.activationUrl)
      await refreshStatus()
      setMessage(issued.emailSent
        ? 'Invitación regenerada y enviada. El enlace anterior ya no es válido.'
        : 'Invitación regenerada. El correo no se ha podido enviar; puedes entregar el enlace manualmente.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se ha podido regenerar la invitación.')
    } finally { setBusy(false) }
  }

  async function revoke() {
    if (!canManageInvitation || !window.confirm('¿Revocar la invitación pendiente? El enlace actual dejará de funcionar.')) return
    setBusy(true); setError(null); setMessage(null)
    try {
      await revokeAdminAccountInvitation(userId)
      setActivationUrl('')
      await refreshStatus()
      setMessage('Invitación revocada. Puedes generar una nueva cuando la necesites.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se ha podido revocar la invitación.')
    } finally { setBusy(false) }
  }

  async function copyActivationLink() {
    if (!activationUrl) return
    try {
      await copyText(activationUrl)
      setError(null)
      setMessage('Enlace de activación copiado.')
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'No se ha podido copiar el enlace.')
    }
  }

  return (
    <article className="panel phase14-profile-card">
      <div className="panel-heading"><div><span className="eyebrow">ACCESO</span><h3>Cuenta e invitación</h3></div></div>
      <div className="phase14-data-grid">
        <div><span>Cuenta</span><strong>{accountLabel(effectiveAccountStatus)}</strong></div>
        <div><span>Invitación</span><strong>{loading ? 'Consultando…' : invitationLabel(status?.invitationStatus)}</strong></div>
        <div><span>Caduca</span><strong>{formatDateTime(status?.expiresAt)}</strong></div>
        <div><span>Último envío</span><strong>{formatDateTime(status?.sentAt)}</strong></div>
      </div>

      {effectiveAccountStatus === 'INVITED' && <p className="phase14-private-notes">El alumno debe crear su propia contraseña desde un enlace de un solo uso. Administración no puede ver ni establecer esa contraseña.</p>}
      {effectiveAccountStatus === 'ACTIVE' && <p className="phase14-private-notes">La cuenta ya fue activada por el alumno. No es necesario gestionar ninguna contraseña desde Administración.</p>}

      {message && <div className="cms-notice success-notice" role="status">{message}</div>}
      {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

      {activationUrl && <div className="phase14-bio"><span>Enlace manual de activación</span><p><a href={activationUrl} target="_blank" rel="noreferrer">{activationUrl}</a></p><div className="phase14-profile-actions"><button type="button" onClick={() => void copyActivationLink()}>Copiar enlace</button></div></div>}

      {canManageInvitation && <div className="phase14-profile-actions">
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void reissue()}>{busy ? 'Procesando…' : status?.invitationStatus === 'PENDING' ? 'Regenerar / reenviar invitación' : 'Generar nueva invitación'}</button>
        {status?.invitationStatus === 'PENDING' && <button type="button" disabled={busy} onClick={() => void revoke()}>Revocar invitación</button>}
      </div>}
    </article>
  )
}

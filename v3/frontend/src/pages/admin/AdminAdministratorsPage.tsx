import { type FormEvent, useEffect, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { isDemoMode } from '../../config/environment'
import { getCurrentUser } from '../../services/pocketbase/auth'
import {
  inviteAdminAccount,
  listAdminAccounts,
  resendAdminAccountInvitation,
  revokeAdminInvitation,
  type AdminAccountRow,
} from '../../services/pocketbase/adminAccounts'
import { adminNav } from './adminNav'
import { formatLastAccess } from '../../utils/lastAccess'

type InviteForm = {
  name: string
  surname: string
  email: string
  phone: string
}

const emptyForm: InviteForm = { name: '', surname: '', email: '', phone: '' }

function accountStatusLabel(status: AdminAccountRow['status']): string {
  if (status === 'ACTIVE') return 'Activo'
  if (status === 'INVITED') return 'Pendiente de activación'
  if (status === 'SUSPENDED') return 'Suspendido'
  return 'Inactivo'
}

function invitationLabel(status: AdminAccountRow['invitationStatus']): string {
  if (status === 'PENDING') return 'Invitación pendiente'
  if (status === 'EXPIRED') return 'Invitación caducada'
  if (status === 'USED') return 'Invitación utilizada'
  if (status === 'REVOKED') return 'Invitación revocada'
  return 'Sin invitación pendiente'
}

function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function AdminAdministratorsPage() {
  const currentAdmin = getCurrentUser()
  const [accounts, setAccounts] = useState<AdminAccountRow[]>([])
  const [form, setForm] = useState<InviteForm>(emptyForm)
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    if (isDemoMode) return
    setLoading(true)
    try {
      setAccounts(await listAdminAccounts())
    } catch {
      setError('No se ha podido cargar la lista de administradores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isDemoMode) {
      setAccounts(currentAdmin ? [{
        id: currentAdmin.id,
        email: currentAdmin.email,
        name: currentAdmin.name,
        surname: currentAdmin.surname,
        phone: currentAdmin.phone || '',
        status: currentAdmin.status,
        invitationStatus: 'NONE',
        lastAccessAt: currentAdmin.last_access_at,
      }] : [])
      return
    }
    void refresh()
  }, [])

  function setField<K extends keyof InviteForm>(key: K, value: InviteForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setNotice(null)
    setError(null)
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setNotice(null)
    setError(null)

    if (!form.name.trim() || !form.surname.trim() || !form.email.trim()) {
      setError('Nombre, apellidos y email son obligatorios.')
      return
    }

    if (isDemoMode) {
      setNotice('Vista de demostración: la invitación no se ha enviado ni se ha creado ninguna cuenta real.')
      return
    }

    setSaving(true)
    try {
      const issued = await inviteAdminAccount(form)
      setForm(emptyForm)
      setNotice(issued.emailSent
        ? 'Administrador invitado. El enlace privado de activación se ha enviado únicamente a su correo.'
        : 'Administrador invitado, pero el correo no se ha podido enviar. Por seguridad el enlace privado no se muestra: revisa SMTP y regenera la invitación.')
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se ha podido crear la invitación de administrador.')
    } finally {
      setSaving(false)
    }
  }

  async function resend(account: AdminAccountRow) {
    if (isDemoMode || busyId) return
    setBusyId(account.id)
    setNotice(null)
    setError(null)
    try {
      const issued = await resendAdminAccountInvitation(account.id)
      setNotice(issued.emailSent
        ? `Nueva invitación enviada únicamente a ${account.email}. El enlace anterior ha quedado invalidado.`
        : `Se ha rotado la invitación de ${account.email}, pero el correo no se ha podido enviar. El enlace secreto no se muestra; revisa SMTP y vuelve a reenviar.`)
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se ha podido reenviar la invitación.')
    } finally {
      setBusyId(null)
    }
  }

  async function revoke(account: AdminAccountRow) {
    if (isDemoMode || busyId || !window.confirm(`¿Revocar la invitación pendiente de ${account.email}?`)) return
    setBusyId(account.id)
    setNotice(null)
    setError(null)
    try {
      await revokeAdminInvitation(account.id)
      setNotice(`Invitación de ${account.email} revocada. El enlace actual ya no puede utilizarse.`)
      await refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No se ha podido revocar la invitación.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page admin-administrators-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">SISTEMA · SEGURIDAD</span>
            <h2>Administradores</h2>
            <p>Gestiona quién puede acceder a Administración sin compartir ni establecer contraseñas de otras personas.</p>
          </div>
          <span className="status info">2FA obligatorio</span>
        </header>

        <div className="cms-notice" role="note">
          <strong>Acceso protegido.</strong> Cada nuevo administrador recibe por email un enlace secreto que no se muestra a quien invita, crea su propia contraseña y deberá completar el segundo factor al iniciar sesión. Ningún administrador puede ver ni sustituir las credenciales de otro.
        </div>
        {loading && <div className="cms-notice" role="status">Cargando administradores…</div>}
        {notice && <div className="cms-notice success-notice" role="status">{notice}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="admin-settings-grid">
          <form className="panel cms-form" onSubmit={handleInvite}>
            <div className="panel-heading"><div><span className="eyebrow">NUEVO ACCESO</span><h3>Invitar administrador</h3></div></div>
            <p className="muted">Aquí no se solicita contraseña ni se muestra el token de activación. La persona invitada recibirá su enlace privado directamente por email.</p>
            <div className="field-row">
              <label className="field-stack"><span>Nombre</span><input autoComplete="given-name" value={form.name} onChange={(event) => setField('name', event.target.value)} required /></label>
              <label className="field-stack"><span>Apellidos</span><input autoComplete="family-name" value={form.surname} onChange={(event) => setField('surname', event.target.value)} required /></label>
            </div>
            <label className="field-stack"><span>Email</span><input type="email" autoComplete="email" value={form.email} onChange={(event) => setField('email', event.target.value)} required /></label>
            <label className="field-stack"><span>Teléfono <small>(opcional)</small></span><input type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setField('phone', event.target.value)} /></label>
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Creando invitación…' : 'Enviar invitación segura'}</button>
            {isDemoMode && <small className="muted">Vista de demostración: no se crean cuentas reales.</small>}
          </form>

          <section className="panel cms-form">
            <div className="panel-heading"><div><span className="eyebrow">REGLAS</span><h3>Qué protege esta gestión</h3></div></div>
            <div className="system-status-checklist">
              <div><span>Contraseña</span><strong>La elige únicamente el titular</strong></div>
              <div><span>Segundo factor</span><strong>Obligatorio para todos los ADMIN</strong></div>
              <div><span>Invitación</span><strong>Un solo uso · 48 horas</strong></div>
              <div><span>Enlace secreto</span><strong>Solo se entrega al email invitado</strong></div>
              <div><span>Reenvío</span><strong>Invalida el enlace anterior</strong></div>
              <div><span>Credenciales ajenas</span><strong>No modificables por otro ADMIN</strong></div>
              <div><span>Perfil académico</span><strong>No se crea para administradores</strong></div>
            </div>
          </section>
        </div>

        <section className="panel cms-form">
          <div className="panel-heading">
            <div><span className="eyebrow">ACCESOS ADMIN</span><h3>{accounts.length} {accounts.length === 1 ? 'administrador' : 'administradores'}</h3></div>
            {!isDemoMode && <button type="button" onClick={() => void refresh()} disabled={loading}>Actualizar</button>}
          </div>

          <div className="phase14-directory-list">
            {accounts.map((account) => {
              const isCurrent = currentAdmin?.id === account.id
              const canManageInvitation = account.status === 'INVITED'
              return (
                <article className="phase14-directory-card" key={account.id} data-testid="admin-account-row">
                  <div className="phase14-directory-main">
                    <div>
                      <span className="eyebrow">{isCurrent ? 'TU CUENTA' : 'ADMINISTRADOR'}</span>
                      <h3>{account.name} {account.surname}</h3>
                      <p>{account.email}{account.phone ? ` · ${account.phone}` : ''}</p>
                    </div>
                    <span className={`status ${account.status === 'ACTIVE' ? 'success' : 'info'}`}>{accountStatusLabel(account.status)}</span>
                  </div>

                  <div className="phase14-data-grid">
                    <div><span>Cuenta</span><strong>{accountStatusLabel(account.status)}</strong></div>
                    <div><span>Activación</span><strong>{invitationLabel(account.invitationStatus)}</strong></div>
                    <div><span>Caduca</span><strong>{formatDate(account.invitationExpiresAt)}</strong></div>
                    <div><span>Último envío</span><strong>{formatDate(account.invitationSentAt)}</strong></div>
                    <div><span>Último acceso</span><strong>{formatLastAccess(account.lastAccessAt)}</strong></div>
                  </div>

                  {isCurrent && <p className="phase14-private-notes">Esta es tu sesión actual. Desde aquí no se muestra ni se modifica ninguna contraseña.</p>}
                  {canManageInvitation && <div className="phase14-profile-actions">
                    <button className="button button-primary" type="button" disabled={busyId === account.id || isDemoMode} onClick={() => void resend(account)}>{busyId === account.id ? 'Procesando…' : 'Regenerar / reenviar invitación'}</button>
                    {account.invitationStatus === 'PENDING' && <button type="button" disabled={busyId === account.id || isDemoMode} onClick={() => void revoke(account)}>Revocar invitación</button>}
                  </div>}
                </article>
              )
            })}
            {!loading && accounts.length === 0 && <div className="cms-notice">No se han encontrado cuentas de administrador.</div>}
          </div>
        </section>
      </div>
    </DashboardShell>
  )
}

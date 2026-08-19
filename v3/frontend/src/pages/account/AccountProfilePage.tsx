import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import { getUserAvatarUrl, updateMyUserProfile } from '../../services/pocketbase/userProfile'
import { studentNav } from '../student/studentNav'
import { teacherNav } from '../teacher/teacherNav'

type Portal = 'STUDENT' | 'TEACHER'

type Props = { portal: Portal }

export default function AccountProfilePage({ portal }: Props) {
  const { user, isDemoMode } = useAuth()
  const fallback = portal === 'STUDENT'
    ? { name: 'Emma', surname: 'Demo', email: 'alumno@demo.local', phone: '' }
    : { name: 'Alex', surname: 'Teacher', email: 'profesor@demo.local', phone: '' }

  const [name, setName] = useState(user?.name || fallback.name)
  const [surname, setSurname] = useState(user?.surname || fallback.surname)
  const [phone, setPhone] = useState(user?.phone || fallback.phone)
  const [avatar, setAvatar] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState(user ? getUserAvatarUrl(user) : '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setSurname(user.surname || '')
    setPhone(user.phone || '')
    setPreviewUrl(getUserAvatarUrl(user))
  }, [user])

  useEffect(() => {
    if (!avatar) return
    const nextUrl = URL.createObjectURL(avatar)
    setPreviewUrl(nextUrl)
    return () => URL.revokeObjectURL(nextUrl)
  }, [avatar])

  const fullName = useMemo(() => [name, surname].filter(Boolean).join(' ').trim() || 'Mi perfil', [name, surname])
  const nav = portal === 'STUDENT' ? studentNav : teacherNav
  const roleLabel = portal === 'STUDENT' ? 'Alumno' : 'Profesor'
  const email = user?.email || fallback.email
  const status = user?.status || 'ACTIVE'

  function handleAvatar(event: ChangeEvent<HTMLInputElement>) {
    setAvatar(event.target.files?.[0] ?? null)
    setMessage(null)
    setError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!name.trim() || !surname.trim()) {
      setError('Nombre y apellidos son obligatorios.')
      return
    }

    if (isDemoMode) {
      setMessage('Modo demo: cambios simulados correctamente.')
      return
    }

    setSaving(true)
    try {
      await updateMyUserProfile({ name, surname, phone, avatar })
      setAvatar(null)
      setMessage('Perfil actualizado correctamente.')
    } catch {
      setError('No se ha podido actualizar el perfil. Revisa los datos e inténtalo de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell role={roleLabel} name={fullName} nav={[...nav]}>
      <div className={`dashboard-content account-profile-page${portal === 'STUDENT' ? ' account-profile-student10' : ' account-profile-teacher11'}`}>
        <header className={`cms-page-heading${portal === 'STUDENT' ? ' account-profile-heading10' : ' account-profile-heading-teacher11'}`}>
          <div>
            <span className="eyebrow">CUENTA · MI PERFIL</span>
            <h2>Tu información personal</h2>
            <p>{portal === 'STUDENT' ? 'Mantén actualizados tus datos de contacto y tu avatar. El email, rol y estado de la cuenta siguen protegidos por la academia.' : 'Actualiza tus datos de contacto y tu imagen de perfil. El email, el rol y el estado permanecen protegidos por la academia.'}</p>
          </div>
          <span className="status success">{status === 'ACTIVE' ? 'Cuenta activa' : status}</span>
        </header>

        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <div className="account-profile-grid">
          <aside className="panel account-profile-summary">
            <div className="account-avatar-large">
              {previewUrl
                ? <img src={previewUrl} alt={`Avatar de ${fullName}`} />
                : <span aria-hidden="true">{name.charAt(0).toUpperCase()}{surname.charAt(0).toUpperCase()}</span>}
            </div>
            <div>
              <span className="eyebrow">{roleLabel}</span>
              <h3>{fullName}</h3>
              <p>{email}</p>
            </div>
            <div className="account-protected-note">
              <strong>Datos protegidos</strong>
              <span>El email, el rol y el estado de la cuenta requieren gestión administrativa.</span>
            </div>
          </aside>

          <form className="panel cms-form account-profile-form" onSubmit={handleSubmit}>
            <div className="panel-heading"><div><span className="eyebrow">EDITAR</span><h3>Datos básicos</h3></div></div>
            <div className="field-row">
              <label className="field-stack"><span>Nombre</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
              <label className="field-stack"><span>Apellidos</span><input value={surname} onChange={(event) => setSurname(event.target.value)} required /></label>
            </div>
            <label className="field-stack"><span>Email</span><input value={email} readOnly aria-readonly="true" /></label>
            <label className="field-stack"><span>Teléfono</span><input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Teléfono de contacto" /></label>
            <label className="field-stack"><span>Avatar</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatar} /></label>
            {avatar && <small className="muted">Nuevo archivo: {avatar.name}</small>}
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
          </form>
        </div>
      </div>
    </DashboardShell>
  )
}

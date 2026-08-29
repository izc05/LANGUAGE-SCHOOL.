import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import { useAuth } from '../../features/auth/AuthProvider'
import { listAdminUsers } from '../../services/pocketbase/adminAcademic'
import type { AppUser } from '../../services/pocketbase/types'
import type { TeacherProfileRecord } from '../../services/pocketbase/teacherPortal'
import {
  getTeacherPhotoUrl,
  listAdminTeacherProfiles,
  teacherSpecialties,
  updateAdminTeacherPublicProfile,
} from '../../services/pocketbase/teacherProfiles'
import { adminNav } from './adminNav'

type ProfileEditorProps = {
  profile: TeacherProfileRecord
  user?: AppUser
  demo: boolean
  onSaved: (record: TeacherProfileRecord) => void
}

function ProfileEditor({ profile, user, demo, onSaved }: ProfileEditorProps) {
  const fallbackName = [user?.name, user?.surname].filter(Boolean).join(' ').trim()
  const [displayName, setDisplayName] = useState(profile.display_name || fallbackName)
  const [headline, setHeadline] = useState(profile.headline || 'English Teacher')
  const [bio, setBio] = useState(profile.bio || '')
  const [specialties, setSpecialties] = useState(teacherSpecialties(profile).join(', '))
  const [sortOrder, setSortOrder] = useState(Number(profile.sort_order) || 100)
  const [isPublic, setIsPublic] = useState(Boolean(profile.public_profile))
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const photoUrl = getTeacherPhotoUrl(profile)

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    setPhoto(event.target.files?.[0] ?? null)
    setMessage(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)

    if (!displayName.trim()) {
      setError('El nombre público no puede quedar vacío.')
      return
    }

    if (demo) {
      setMessage('Modo demo: cambios simulados en esta vista.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateAdminTeacherPublicProfile(profile, {
        display_name: displayName,
        headline,
        bio,
        specialties: specialties.split(',').map((value) => value.trim()).filter(Boolean),
        public_profile: isPublic,
        active: true,
        sort_order: sortOrder,
        publicPhoto: photo,
      })
      setPhoto(null)
      onSaved(updated)
      setMessage('Perfil público guardado correctamente.')
    } catch {
      setError('No se ha podido guardar el perfil público.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel public-teacher-admin-card" onSubmit={handleSubmit}>
      <div className="public-teacher-admin-heading">
        <div className="public-teacher-admin-avatar">
          {photoUrl ? <img src={photoUrl} alt="" /> : <span>{(displayName || 'LS').charAt(0).toUpperCase()}</span>}
        </div>
        <div>
          <span className="eyebrow">PERFIL PÚBLICO</span>
          <h3>{fallbackName || displayName}</h3>
          <small>{user?.email || 'Cuenta docente'}</small>
        </div>
        <span className={`status ${isPublic ? 'success' : 'warning'}`}>{isPublic ? 'Visible' : 'Oculto'}</span>
      </div>

      {message && <div className="cms-notice success-notice">{message}</div>}
      {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

      <div className="admin-create-grid teacher-public-fields">
        <div><label>Nombre visible</label><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></div>
        <div><label>Titular</label><input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="Dirección académica · English Teacher" /></div>
        <div className="span-two"><label>Biografía</label><textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} /></div>
        <div className="span-two"><label>Especialidades</label><input value={specialties} onChange={(event) => setSpecialties(event.target.value)} placeholder="Speaking, B1, Kids" /></div>
        <div><label>Orden</label><input type="number" min="0" value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></div>
        <label className="check-field teacher-public-check"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /><span>Mostrar en la web</span></label>
        <div className="span-two"><label>Fotografía pública</label><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} /><small>{photo ? photo.name : 'Mantener fotografía actual'}</small></div>
      </div>

      <div className="teacher-public-actions">
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar perfil público'}</button>
        <a className="button button-ghost" href="/profesores" target="_blank" rel="noreferrer">Ver página pública ↗</a>
      </div>
    </form>
  )
}

export default function AdminTeacherPublicProfilesPage() {
  const { isDemoMode } = useAuth()
  const [users, setUsers] = useState<AppUser[]>([])
  const [profiles, setProfiles] = useState<TeacherProfileRecord[]>([])
  const [loading, setLoading] = useState(!isDemoMode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) {
      setLoading(false)
      return
    }

    let mounted = true
    Promise.all([listAdminUsers('TEACHER'), listAdminTeacherProfiles()])
      .then(([teacherUsers, teacherProfiles]) => {
        if (!mounted) return
        setUsers(teacherUsers)
        setProfiles(teacherProfiles)
      })
      .catch(() => { if (mounted) setError('No se han podido cargar los perfiles públicos.') })
      .finally(() => { if (mounted) setLoading(false) })

    return () => { mounted = false }
  }, [isDemoMode])

  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users])

  function updateLocal(record: TeacherProfileRecord) {
    setProfiles((current) => current.map((item) => item.id === record.id ? record : item))
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">WEB · PROFESORES</span>
            <h2>Perfiles públicos del equipo</h2>
            <p>Estos datos son independientes de la cuenta privada del profesor. Email y teléfono no se publican.</p>
          </div>
          <a className="button button-ghost" href="/profesores" target="_blank" rel="noreferrer">Vista pública ↗</a>
        </header>

        {loading && <div className="cms-notice">Cargando perfiles…</div>}
        {error && <div className="cms-notice auth-error">{error}</div>}

        <div className="public-teacher-admin-grid">
          {profiles.map((profile) => (
            <ProfileEditor
              key={profile.id}
              profile={profile}
              user={userById.get(profile.user)}
              demo={isDemoMode}
              onSaved={updateLocal}
            />
          ))}
          {!loading && profiles.length === 0 && <div className="panel public-empty-state">No hay perfiles docentes todavía. Crea primero un profesor desde “Profesores”.</div>}
        </div>
      </div>
    </DashboardShell>
  )
}

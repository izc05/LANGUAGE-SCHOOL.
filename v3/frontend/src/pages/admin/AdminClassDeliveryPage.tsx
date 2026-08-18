import { useEffect, useMemo, useState, type FormEvent } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import {
  effectiveDeliveryMode,
  listAdminClassesForDelivery,
  updateAdminClassDelivery,
} from '../../services/pocketbase/adminClassDelivery'
import type { ClassDeliveryMode, ClassRecord, CourseRecord, GroupRecord } from '../../services/pocketbase/studentPortal'
import { adminNav } from './adminNav'

type DeliveryClass = ClassRecord & {
  expand?: {
    group?: GroupRecord & { expand?: { course?: CourseRecord } }
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha pendiente'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(date)
}

function modeLabel(mode: ClassDeliveryMode): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

const demoClass: DeliveryClass = {
  id: 'demo-delivery', collectionId: '', collectionName: 'classes', created: '', updated: '',
  group: 'demo-group', teacher: 'demo-teacher', starts_at: '2026-08-20T18:00:00+02:00', ends_at: '2026-08-20T19:00:00+02:00',
  topic: 'Speaking · Travel & experiences', description: '', status: 'SCHEDULED', delivery_mode: 'HYBRID',
  location_text: 'Aula 2', online_join_url: 'https://example.com/language-school-class',
  expand: { group: { id: 'demo-group', collectionId: '', collectionName: 'groups', created: '', updated: '', name: 'Adultos B1', course: 'demo-course', teacher: 'demo-teacher', academic_year: '2026/27', schedule_text: '', capacity: 8, status: 'ACTIVE', expand: { course: { id: 'demo-course', collectionId: '', collectionName: 'courses', created: '', updated: '', title: 'Adult English B1', slug: 'adult-english-b1', level: 'B1', description: '', status: 'ACTIVE', public_visible: true } } } },
}

export default function AdminClassDeliveryPage() {
  const { isDemoMode } = useAuth()
  const [classes, setClasses] = useState<DeliveryClass[]>(isDemoMode ? [demoClass] : [])
  const [selectedId, setSelectedId] = useState<string | null>(isDemoMode ? demoClass.id : null)
  const [mode, setMode] = useState<ClassDeliveryMode>('IN_PERSON')
  const [locationText, setLocationText] = useState('')
  const [onlineJoinUrl, setOnlineJoinUrl] = useState('')
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    listAdminClassesForDelivery()
      .then((records) => {
        if (!mounted) return
        setClasses(records as DeliveryClass[])
        const upcoming = [...records]
          .filter((record) => record.status === 'SCHEDULED')
          .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())[0]
        setSelectedId(upcoming?.id || records[0]?.id || null)
      })
      .catch(() => { if (mounted) setError('No se han podido cargar las clases.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const selectedClass = classes.find((record) => record.id === selectedId) || null

  useEffect(() => {
    if (!selectedClass) return
    setMode(effectiveDeliveryMode(selectedClass))
    setLocationText(selectedClass.location_text || '')
    setOnlineJoinUrl(selectedClass.online_join_url || '')
    setError(null)
    setMessage(null)
  }, [selectedClass?.id])

  const orderedClasses = useMemo(() => [...classes].sort((a, b) => {
    const aUpcoming = a.status === 'SCHEDULED' && new Date(a.starts_at).getTime() >= Date.now()
    const bUpcoming = b.status === 'SCHEDULED' && new Date(b.starts_at).getTime() >= Date.now()
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1
    return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()
  }), [classes])

  const counts = useMemo(() => ({
    inPerson: classes.filter((record) => effectiveDeliveryMode(record) === 'IN_PERSON').length,
    online: classes.filter((record) => effectiveDeliveryMode(record) === 'ONLINE').length,
    hybrid: classes.filter((record) => effectiveDeliveryMode(record) === 'HYBRID').length,
  }), [classes])

  async function saveDelivery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedClass) return
    setError(null)
    setMessage(null)

    if (isDemoMode) {
      setClasses((current) => current.map((record) => record.id === selectedClass.id ? {
        ...record,
        delivery_mode: mode,
        location_text: mode === 'ONLINE' ? '' : locationText.trim(),
        online_join_url: mode === 'IN_PERSON' ? '' : onlineJoinUrl.trim(),
      } : record))
      setMessage('Modalidad preparada en la demostración.')
      return
    }

    setSaving(true)
    try {
      const updated = await updateAdminClassDelivery(selectedClass, { deliveryMode: mode, locationText, onlineJoinUrl })
      setClasses((current) => current.map((record) => record.id === updated.id ? updated as DeliveryClass : record))
      setMessage('Modalidad de la clase actualizada.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se ha podido actualizar la modalidad.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page class-delivery-admin-page">
        <header className="cms-page-heading">
          <div>
            <span className="eyebrow">CAMPUS · AULA</span>
            <h2>Modalidad de las clases</h2>
            <p>Decide si cada sesión es presencial, online o híbrida. Esta es la base sobre la que conectaremos Zoom en la siguiente fase.</p>
          </div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando clases…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="class-delivery-metrics" aria-label="Resumen de modalidades">
          <article><span>Presenciales</span><strong>{counts.inPerson}</strong></article>
          <article><span>Online</span><strong>{counts.online}</strong></article>
          <article><span>Híbridas</span><strong>{counts.hybrid}</strong></article>
        </section>

        <div className="class-delivery-admin-grid">
          <section className="panel class-delivery-list-panel">
            <div className="panel-heading"><div><span className="eyebrow">SESIONES</span><h3>Clases registradas</h3></div><span className="status info">{classes.length}</span></div>
            <div className="class-delivery-list">
              {orderedClasses.map((record) => {
                const currentMode = effectiveDeliveryMode(record)
                const group = record.expand?.group
                return (
                  <button key={record.id} type="button" className={record.id === selectedId ? 'active' : ''} onClick={() => setSelectedId(record.id)}>
                    <time>{formatDate(record.starts_at)}</time>
                    <span><strong>{record.topic}</strong><small>{group?.name || 'Grupo'} · {group?.expand?.course?.title || 'Curso'}</small></span>
                    <b className={`class-mode class-mode-${currentMode.toLowerCase()}`}>{modeLabel(currentMode)}</b>
                  </button>
                )
              })}
              {!loading && classes.length === 0 && <PortalEmptyState compact title="Todavía no hay clases" description="Las sesiones aparecerán aquí en cuanto se programen desde Clases o desde el portal del profesor." />}
            </div>
          </section>

          <section className="panel class-delivery-editor-panel">
            {!selectedClass ? <PortalEmptyState title="Selecciona una clase" description="Elige una sesión para definir dónde y cómo se imparte." /> : (
              <>
                <div className="panel-heading"><div><span className="eyebrow">CONFIGURACIÓN DE AULA</span><h3>{selectedClass.topic}</h3><p>{formatDate(selectedClass.starts_at)} · {selectedClass.expand?.group?.name || 'Grupo'}</p></div></div>
                <form className="class-delivery-form" onSubmit={saveDelivery}>
                  <fieldset>
                    <legend>Modalidad</legend>
                    <div className="class-mode-picker">
                      {(['IN_PERSON', 'ONLINE', 'HYBRID'] as const).map((value) => (
                        <label key={value} className={mode === value ? 'active' : ''}>
                          <input type="radio" name="delivery_mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
                          <strong>{modeLabel(value)}</strong>
                          <small>{value === 'IN_PERSON' ? 'Solo en la academia' : value === 'ONLINE' ? 'Solo videoclase' : 'Aula física + videoclase'}</small>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {mode !== 'ONLINE' && <div><label htmlFor="class-location">Lugar / aula</label><input id="class-location" value={locationText} onChange={(event) => setLocationText(event.target.value)} placeholder="Ej. Aula 2 · Language School" /></div>}
                  {mode !== 'IN_PERSON' && <div><label htmlFor="class-online-url">Acceso online</label><input id="class-online-url" type="url" value={onlineJoinUrl} onChange={(event) => setOnlineJoinUrl(event.target.value)} placeholder="https://…" /><small className="muted">Temporalmente puede ser un enlace https. Cuando conectemos Zoom se generará desde la plataforma.</small></div>}

                  <div className="class-delivery-preview">
                    <span className={`class-mode class-mode-${mode.toLowerCase()}`}>{modeLabel(mode)}</span>
                    {mode !== 'ONLINE' && <span>📍 {locationText.trim() || 'Lugar pendiente'}</span>}
                    {mode !== 'IN_PERSON' && <span>◉ {onlineJoinUrl.trim() ? 'Acceso online preparado' : 'Acceso online pendiente'}</span>}
                  </div>

                  <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar modalidad'}</button>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  )
}

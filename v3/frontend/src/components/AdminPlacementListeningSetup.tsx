import { type FormEvent, useState } from 'react'
import { createPlacementListeningDraft, type PlacementAdminTest } from '../services/pocketbase/placementAdmin'

type Props = {
  tests: PlacementAdminTest[]
  disabled?: boolean
  onCreated: (testId: string) => Promise<void> | void
}

function messageFrom(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message?: unknown }).message || 'No se ha podido crear la versión Listening.')
  return 'No se ha podido crear la versión Listening.'
}

export default function AdminPlacementListeningSetup({ tests, disabled = false, onCreated }: Props) {
  const [sourceId, setSourceId] = useState('')
  const [name, setName] = useState('Test de nivel Language School · Listening')
  const [version, setVersion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const eligible = tests.filter((test) => test.algorithmVersion === 'cefr-v1' || test.algorithmVersion === 'cefr-v2-listening')
  const resolvedSource = sourceId || eligible.find((test) => test.status === 'PUBLISHED')?.id || eligible[0]?.id || ''

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!resolvedSource || !name.trim() || !version.trim() || busy || disabled) return
    setBusy(true); setError('')
    try {
      const created = await createPlacementListeningDraft({ sourceTestId: resolvedSource, name: name.trim(), version: version.trim() })
      setVersion('')
      await onCreated(created.testId)
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusy(false) }
  }

  return (
    <section className="panel placement-listening-setup" aria-labelledby="placement-listening-setup-title">
      <div className="panel-heading"><div><span className="eyebrow">NUEVA REVISIÓN · LISTENING</span><h3 id="placement-listening-setup-title">Preparar comprensión oral</h3></div><span className="status info">cefr-v2</span></div>
      <p className="muted">Crea una revisión DRAFT con 6 preguntas de comprensión oral por intento y un banco inicial de 24 guiones. Los audios se cargan después y son obligatorios antes de publicar.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label>Partir de<select value={resolvedSource} onChange={(event) => setSourceId(event.target.value)} disabled={disabled || busy || eligible.length === 0}>{eligible.map((test) => <option key={test.id} value={test.id}>{test.version} · {test.status}{test.algorithmVersion === 'cefr-v2-listening' ? ' · Listening' : ''}</option>)}</select></label>
        <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} required disabled={disabled || busy} /></label>
        <label>Versión<input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="2026.09-listening-v1" required disabled={disabled || busy} /></label>
        <button className="button button-primary" type="submit" disabled={disabled || busy || !resolvedSource}>{busy ? 'Preparando…' : 'Preparar Listening'}</button>
      </form>
      {eligible.length === 0 && <div className="cms-notice auth-error">Necesitas una versión de test existente para preparar Listening.</div>}
      {error && <div className="cms-notice auth-error" role="alert">{error}</div>}
    </section>
  )
}
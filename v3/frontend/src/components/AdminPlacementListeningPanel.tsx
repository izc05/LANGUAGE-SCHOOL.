import { useEffect, useMemo, useState } from 'react'
import {
  deletePlacementListeningAudio,
  fetchPlacementListeningAdminAudio,
  getPlacementListeningStatus,
  publishPlacementListeningTest,
  updatePlacementListeningQuestion,
  uploadPlacementListeningAudio,
  type PlacementAdminQuestion,
  type PlacementListeningStatus,
} from '../services/pocketbase/placementAdmin'
import type { CefrLevel } from '../services/pocketbase/placementTest'

const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function messageFrom(error: unknown): string {
  if (typeof error === 'object' && error && 'message' in error) return String((error as { message?: unknown }).message || 'No se ha podido completar la operación.')
  return 'No se ha podido completar la operación.'
}

type Props = {
  testId: string
  canEdit: boolean
  version: string
  onPublished: () => Promise<void> | void
  onStatus?: (status: PlacementListeningStatus | null) => void
}

export default function AdminPlacementListeningPanel({ testId, canEdit, version, onPublished, onStatus }: Props) {
  const [status, setStatus] = useState<PlacementListeningStatus | null>(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState<PlacementAdminQuestion | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewId, setPreviewId] = useState('')

  const load = async () => {
    setError('')
    try {
      const next = await getPlacementListeningStatus(testId)
      setStatus(next)
      onStatus?.(next)
    } catch (cause) {
      setStatus(null)
      onStatus?.(null)
      setError(messageFrom(cause))
    }
  }

  useEffect(() => {
    setEditing(null)
    setMessage('')
    void load()
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // previewUrl is revoked explicitly when changed; testId is the lifecycle boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId])

  const byLevel = useMemo(() => {
    const grouped = new Map<CefrLevel, PlacementAdminQuestion[]>()
    LEVELS.forEach((level) => grouped.set(level, []))
    status?.listeningQuestions.forEach((question) => grouped.get(question.cefrLevel)?.push(question))
    return grouped
  }, [status])

  const handleUpload = async (question: PlacementAdminQuestion, file?: File) => {
    if (!file || !canEdit) return
    setBusyId(question.id); setError(''); setMessage('')
    try {
      await uploadPlacementListeningAudio(question.id, file)
      setMessage(`Audio de ${question.code} guardado.`)
      await load()
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusyId('') }
  }

  const handleDeleteAudio = async (question: PlacementAdminQuestion) => {
    if (!canEdit || !question.hasAudio || !window.confirm(`Retirar el audio de ${question.code}?`)) return
    setBusyId(question.id); setError(''); setMessage('')
    try {
      await deletePlacementListeningAudio(question.id)
      if (previewId === question.id && previewUrl) {
        URL.revokeObjectURL(previewUrl); setPreviewUrl(''); setPreviewId('')
      }
      setMessage(`Audio de ${question.code} retirado.`)
      await load()
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusyId('') }
  }

  const handlePreview = async (question: PlacementAdminQuestion) => {
    if (!question.hasAudio) return
    setBusyId(question.id); setError('')
    try {
      const blob = await fetchPlacementListeningAdminAudio(question.id)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const next = URL.createObjectURL(blob)
      setPreviewUrl(next); setPreviewId(question.id)
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusyId('') }
  }

  const handleSaveQuestion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editing || !canEdit) return
    const form = new FormData(event.currentTarget)
    const options = ['a', 'b', 'c', 'd'].map((id) => ({ id, label: String(form.get(`option-${id}`) || '').trim() }))
    setBusyId(editing.id); setError(''); setMessage('')
    try {
      await updatePlacementListeningQuestion(editing.id, {
        code: String(form.get('code') || '').trim(),
        skill: 'LISTENING',
        cefrLevel: String(form.get('level') || 'A1') as CefrLevel,
        prompt: String(form.get('prompt') || '').trim(),
        passage: String(form.get('passage') || '').trim(),
        options,
        correctOptionId: String(form.get('correct') || 'a'),
        internalExplanation: String(form.get('explanation') || '').trim(),
        weight: Number(form.get('weight') || 1),
        active: form.get('active') === 'on',
        adminOrder: Number(form.get('order') || 0),
      })
      setEditing(null)
      setMessage('Pregunta Listening actualizada.')
      await load()
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusyId('') }
  }

  const handlePublish = async () => {
    if (!canEdit || !status?.validation.ready || !window.confirm(`Publicar ${version}? Los audios y preguntas quedarán congelados en esta versión.`)) return
    setBusyId('publish'); setError(''); setMessage('')
    try {
      await publishPlacementListeningTest(testId)
      setMessage(`Versión ${version} publicada con Listening.`)
      await load()
      await onPublished()
    } catch (cause) { setError(messageFrom(cause)) } finally { setBusyId('') }
  }

  if (!status && !error) return <section className="panel placement-listening-admin"><div className="cms-notice" role="status">Cargando Listening…</div></section>

  return (
    <section className="panel placement-listening-admin" aria-labelledby="placement-listening-admin-title">
      <div className="panel-heading">
        <div><span className="eyebrow">LISTENING · DIAGNÓSTICO</span><h3 id="placement-listening-admin-title">Comprensión oral</h3></div>
        {status && <span className={`status ${status.validation.ready ? 'success' : 'info'}`}>{status.validation.listeningWithAudio}/24 audios</span>}
      </div>
      <p className="muted">Los guiones y respuestas son internos. El alumno recibe únicamente el audio protegido, el enunciado y las opciones.</p>
      {message && <div className="cms-notice success-notice" role="status">{message}</div>}
      {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

      {status && (
        <>
          <div className={`placement-validation ${status.validation.ready ? 'ready' : 'pending'}`}>
            <div><strong>{status.validation.ready ? 'Listening preparado para publicar' : 'Faltan audios o requisitos'}</strong><span>{status.validation.listeningWithAudio} de {status.validation.listeningCount} preguntas Listening tienen audio.</span></div>
            {!status.validation.ready && <ul>{status.validation.errors.filter((item) => item.includes('LISTENING') || item.toLowerCase().includes('audio')).slice(0, 8).map((item) => <li key={item}>{item}</li>)}</ul>}
            {canEdit && <button className="button button-primary" type="button" disabled={!status.validation.ready || busyId === 'publish'} onClick={() => void handlePublish()}>{busyId === 'publish' ? 'Publicando…' : 'Publicar versión Listening'}</button>}
          </div>

          <div className="placement-listening-levels">
            {LEVELS.map((level) => (
              <section key={level} className="placement-listening-level">
                <div className="placement-listening-level-heading"><strong>{level}</strong><span>{byLevel.get(level)?.filter((question) => question.hasAudio).length || 0}/4 audios</span></div>
                <div className="placement-listening-question-list">
                  {(byLevel.get(level) || []).map((question) => (
                    <article key={question.id} className={!question.active ? 'inactive' : ''}>
                      <div><strong>{question.code}</strong><p>{question.prompt}</p><small>{question.hasAudio ? `Audio: ${question.audioName || 'cargado'}` : 'Sin audio'}</small></div>
                      <div className="placement-listening-admin-actions">
                        {question.hasAudio && <button type="button" onClick={() => void handlePreview(question)} disabled={busyId === question.id}>Escuchar</button>}
                        {canEdit && <label className="placement-listening-upload"><span>{question.hasAudio ? 'Sustituir' : 'Subir audio'}</span><input type="file" accept="audio/mpeg,audio/mp4,audio/wav,.mp3,.m4a,.wav" disabled={Boolean(busyId)} onChange={(event) => { void handleUpload(question, event.target.files?.[0]); event.currentTarget.value = '' }} /></label>}
                        {canEdit && question.hasAudio && <button type="button" onClick={() => void handleDeleteAudio(question)} disabled={busyId === question.id}>Retirar</button>}
                        {canEdit && <button type="button" onClick={() => setEditing(question)}>Editar</button>}
                      </div>
                      {previewId === question.id && previewUrl && <audio controls preload="metadata" src={previewUrl} aria-label={`Previsualización de ${question.code}`} />}
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {editing && canEdit && (
            <form className="placement-listening-editor" onSubmit={(event) => void handleSaveQuestion(event)}>
              <div className="panel-heading"><div><span className="eyebrow">EDITAR LISTENING</span><h3>{editing.code}</h3></div><button type="button" className="button button-secondary" onClick={() => setEditing(null)}>Cancelar</button></div>
              <div className="placement-question-fields">
                <label>Código<input name="code" defaultValue={editing.code} required /></label>
                <label>Nivel<select name="level" defaultValue={editing.cefrLevel}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
                <label>Orden<input name="order" type="number" min={0} defaultValue={editing.adminOrder} /></label>
                <label>Peso<input name="weight" type="number" min={0.1} max={100} step={0.1} defaultValue={editing.weight} /></label>
                <label className="placement-active-check"><input name="active" type="checkbox" defaultChecked={editing.active} />Activa</label>
              </div>
              <label>Enunciado<textarea name="prompt" rows={3} defaultValue={editing.prompt} required /></label>
              <label>Transcripción interna <small>(nunca se muestra durante el test)</small><textarea name="passage" rows={5} defaultValue={editing.passage} required /></label>
              <fieldset className="placement-options-editor"><legend>Opciones de respuesta</legend>{['a', 'b', 'c', 'd'].map((id) => <label key={id}><span>{id.toUpperCase()}</span><input name={`option-${id}`} defaultValue={editing.options.find((option) => option.id === id)?.label || ''} required /></label>)}<label>Correcta<select name="correct" defaultValue={editing.correctOptionId}>{['a', 'b', 'c', 'd'].map((id) => <option key={id} value={id}>{id.toUpperCase()}</option>)}</select></label></fieldset>
              <label>Explicación interna<textarea name="explanation" rows={3} defaultValue={editing.internalExplanation} /></label>
              <button className="button button-primary" type="submit" disabled={busyId === editing.id}>{busyId === editing.id ? 'Guardando…' : 'Guardar Listening'}</button>
            </form>
          )}
        </>
      )}
    </section>
  )
}
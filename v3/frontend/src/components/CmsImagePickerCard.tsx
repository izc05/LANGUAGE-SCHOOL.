import { type ChangeEvent, useMemo, useState } from 'react'
import { createMedia, getMediaUrl, type MediaRecord } from '../services/pocketbase/media'

type CmsImagePickerCardProps = {
  label: string
  hint: string
  selectedId: string
  mediaOptions: MediaRecord[]
  disabled?: boolean
  demoMode?: boolean
  onSelect: (id: string, record?: MediaRecord) => void
  onUploaded: (record: MediaRecord) => void
  slotKey?: string
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function cleanAltText(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
}

export default function CmsImagePickerCard({
  label,
  hint,
  selectedId,
  mediaOptions,
  disabled = false,
  demoMode = false,
  onSelect,
  onUploaded,
  slotKey,
}: CmsImagePickerCardProps) {
  const [uploading, setUploading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [demoPreviewUrl, setDemoPreviewUrl] = useState<string | null>(null)

  const selected = useMemo(
    () => mediaOptions.find((item) => item.id === selectedId),
    [mediaOptions, selectedId],
  )
  const selectedUrl = selected ? getMediaUrl(selected, '500x320') : demoPreviewUrl || ''

  function resetFeedback() {
    setMessage(null)
    setError(null)
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading || disabled) return

    resetFeedback()

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Solo se admiten imágenes JPG, PNG o WebP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('La imagen supera el límite de 8 MB.')
      return
    }

    if (demoMode) {
      if (demoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(demoPreviewUrl)
      setDemoPreviewUrl(URL.createObjectURL(file))
      setMessage('Modo demo: vista previa preparada. No se guardará al recargar.')
      return
    }

    setUploading(true)
    try {
      const record = await createMedia({
        title: file.name,
        file,
        altText: cleanAltText(file.name),
        usage: 'WEBSITE',
        mediaType: 'IMAGE',
      })
      onUploaded(record)
      onSelect(record.id, record)
      setPickerOpen(false)
      setMessage('Imagen subida a Multimedia y seleccionada. Publica los cambios para activarla.')
    } catch {
      setError('No se ha podido subir la imagen. Puedes volver a intentarlo o elegir una existente.')
    } finally {
      setUploading(false)
    }
  }

  function chooseExisting(id: string) {
    resetFeedback()
    const record = mediaOptions.find((item) => item.id === id)
    onSelect(id, record)
    setDemoPreviewUrl(null)
    if (id) setMessage('Imagen de Multimedia seleccionada. Publica los cambios para activarla.')
  }

  function removeSelection() {
    resetFeedback()
    if (demoPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(demoPreviewUrl)
    setDemoPreviewUrl(null)
    setPickerOpen(false)
    onSelect('')
    setMessage('Imagen quitada. Al publicar volverá el fallback premium.')
  }

  return (
    <article className="cms-image-picker-card" data-image-slot={slotKey || label} data-selected={Boolean(selectedId)}>
      <div
        className={`cms-image-picker-preview${selectedUrl ? ' has-image' : ''}`}
        style={selectedUrl ? { backgroundImage: `url(${selectedUrl})` } : undefined}
        aria-label={`Vista previa actual de ${label}`}
      >
        {!selectedUrl && <div><strong>FALLBACK</strong><span>Visual premium automático</span></div>}
        {uploading && <div className="cms-image-uploading" role="status"><span className="cms-image-spinner" aria-hidden="true" />Subiendo…</div>}
      </div>

      <div className="cms-image-picker-copy">
        <div><strong>{label}</strong><small>{hint}</small></div>
        <div className="cms-image-picker-actions">
          <label className={`button button-primary cms-image-upload-button${uploading ? ' is-loading' : ''}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUpload}
              disabled={disabled || uploading}
              aria-label={`Subir/Cambiar imagen: ${label}`}
            />
            {uploading ? 'Subiendo…' : selectedId || demoPreviewUrl ? 'Cambiar imagen' : 'Subir imagen'}
          </label>
          <button
            className="button button-ghost"
            type="button"
            onClick={() => { resetFeedback(); setPickerOpen((current) => !current) }}
            disabled={disabled || uploading || mediaOptions.length === 0}
            aria-expanded={pickerOpen}
          >
            Elegir de Multimedia
          </button>
          {(selectedId || demoPreviewUrl) && (
            <button className="cms-image-remove" type="button" onClick={removeSelection} disabled={disabled || uploading}>
              Quitar imagen
            </button>
          )}
        </div>

        {pickerOpen && (
          <label className="cms-image-existing-picker">
            <span>Imagen existente</span>
            <select
              value={selectedId}
              onChange={(event) => chooseExisting(event.target.value)}
              disabled={disabled || uploading}
              aria-label={`Elegir imagen existente para ${label}`}
            >
              <option value="">Usar fallback premium</option>
              {mediaOptions.map((item) => <option key={item.id} value={item.id}>{item.title || item.file}</option>)}
            </select>
          </label>
        )}

        {message && <small className="cms-image-feedback success" role="status">{message}</small>}
        {error && <small className="cms-image-feedback error" role="alert">{error}</small>}
      </div>
    </article>
  )
}

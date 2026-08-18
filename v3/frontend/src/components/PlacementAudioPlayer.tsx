import { useEffect, useState } from 'react'
import { fetchPlacementAudio } from '../services/pocketbase/placementTest'

type PlacementAudioPlayerProps = {
  attemptId: string
  questionId: string
  publicToken?: string
}

export default function PlacementAudioPlayer({ attemptId, questionId, publicToken }: PlacementAudioPlayerProps) {
  const [audioUrl, setAudioUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let objectUrl = ''
    setAudioUrl('')
    setLoading(true)
    setError('')

    void fetchPlacementAudio(attemptId, questionId, publicToken)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setAudioUrl(objectUrl)
      })
      .catch(() => {
        if (active) setError('No hemos podido cargar el audio. Comprueba la conexión e inténtalo de nuevo.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attemptId, publicToken, questionId])

  return (
    <div className="placement-listening-player" data-listening-audio>
      <div className="placement-listening-player-copy">
        <span className="eyebrow">COMPRENSIÓN ORAL</span>
        <strong>Escucha el audio antes de responder.</strong>
        <small>Puedes reproducirlo de nuevo si lo necesitas. El audio no empieza automáticamente.</small>
      </div>
      {loading && <p className="placement-listening-status" role="status">Cargando audio…</p>}
      {error && <p className="placement-listening-error" role="alert">{error}</p>}
      {audioUrl && (
        <audio controls preload="metadata" src={audioUrl} aria-label="Audio de la pregunta de comprensión oral">
          Tu navegador no permite reproducir este audio.
        </audio>
      )}
    </div>
  )
}
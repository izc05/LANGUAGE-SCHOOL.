import { useEffect, useRef, useState } from 'react'
import { loadJitsiExternalApi, type JitsiExternalApi } from '../services/jitsiExternalApi'

type JitsiClassroomProps = {
  domain: string
  roomName: string
  displayName: string
  onConferenceJoined?: () => void
  onConferenceLeft?: () => void
  onError?: (error: Error) => void
}

export default function JitsiClassroom({
  domain,
  roomName,
  displayName,
  onConferenceJoined,
  onConferenceLeft,
  onError,
}: JitsiClassroomProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let api: JitsiExternalApi | null = null

    const reportError = (message: string) => {
      if (!active) return
      setLoading(false)
      onError?.(new Error(message))
    }

    void loadJitsiExternalApi()
      .then((JitsiMeetExternalAPI) => {
        if (!active || !containerRef.current) return
        api = new JitsiMeetExternalAPI(domain, {
          roomName,
          width: '100%',
          height: '100%',
          parentNode: containerRef.current,
          lang: 'es',
          userInfo: { displayName },
          configOverwrite: {
            prejoinConfig: { enabled: true },
            startWithAudioMuted: true,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          },
          onload: () => {
            if (!active) return
            const iframe = api?.getIFrame?.() || containerRef.current?.querySelector('iframe')
            iframe?.setAttribute('allow', 'camera; microphone; fullscreen; display-capture; autoplay')
            iframe?.setAttribute('title', 'Aula Jitsi de Language School')
            setLoading(false)
          },
        })

        api.addListener('videoConferenceJoined', () => { if (active) onConferenceJoined?.() })
        api.addListener('videoConferenceLeft', () => { if (active) onConferenceLeft?.() })
        api.addListener('readyToClose', () => { if (active) onConferenceLeft?.() })
        api.addListener('cameraError', () => reportError('Jitsi no ha podido acceder a la cámara.'))
        api.addListener('micError', () => reportError('Jitsi no ha podido acceder al micrófono.'))
      })
      .catch((error) => {
        reportError(error instanceof Error ? error.message : 'No se ha podido iniciar Jitsi.')
      })

    return () => {
      active = false
      api?.dispose()
    }
  }, [displayName, domain, onConferenceJoined, onConferenceLeft, onError, roomName])

  return (
    <div className="jitsi-classroom" aria-label="Videoclase Jitsi">
      {loading && <div className="jitsi-classroom-loading" role="status">Preparando el aula Jitsi…</div>}
      <div className="jitsi-classroom-frame" ref={containerRef} />
    </div>
  )
}


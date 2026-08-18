import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMyClass, type ClassRecord } from '../../services/pocketbase/studentPortal'
import { getStudentZoomSdkAuthorization } from '../../services/pocketbase/studentZoomMeeting'
import { configureZoomMeetingSdk, loadZoomMeetingSdk, type ZoomClientViewApi } from '../../services/zoomMeetingSdkCdn'

type JoinState = 'idle' | 'authorizing' | 'loading-sdk' | 'joining' | 'joined' | 'error'

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Horario pendiente'
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error) {
    const candidate = error as { response?: { message?: unknown }; data?: { message?: unknown }; message?: unknown }
    if (typeof candidate.response?.message === 'string' && candidate.response.message) return candidate.response.message
    if (typeof candidate.data?.message === 'string' && candidate.data.message) return candidate.data.message
    if (typeof candidate.message === 'string' && candidate.message) return candidate.message
  }
  return 'No se ha podido preparar el aula online. Inténtalo de nuevo o usa el acceso externo.'
}

async function joinWithZoomClient(
  zoom: ZoomClientViewApi,
  authorization: Awaited<ReturnType<typeof getStudentZoomSdkAuthorization>>,
): Promise<void> {
  configureZoomMeetingSdk(zoom)
  try {
    await zoom.i18n?.load('es-ES')
  } catch {
    // Zoom can still render with its default language if the language asset fails.
  }

  await new Promise<void>((resolve, reject) => {
    zoom.init({
      leaveUrl: `${window.location.origin}/alumno/clases`,
      patchJsMedia: true,
      disableCORP: !window.crossOriginIsolated,
      success: () => {
        zoom.join({
          signature: authorization.signature,
          meetingNumber: authorization.meetingNumber,
          userName: authorization.userName,
          passWord: authorization.password || '',
          success: () => resolve(),
          error: (error) => reject(error),
        })
      },
      error: (error) => reject(error),
    })
  })
}

export default function StudentOnlineClassPage() {
  const { classId = '' } = useParams()
  const { isDemoMode } = useAuth()
  const [classRecord, setClassRecord] = useState<ClassRecord | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [pageError, setPageError] = useState<string | null>(isDemoMode ? 'El aula Zoom solo está disponible en modo conectado.' : null)
  const [joinState, setJoinState] = useState<JoinState>('idle')
  const [joinError, setJoinError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode || !classId) return
    let mounted = true
    setLoading(true)
    getMyClass(classId)
      .then((record) => {
        if (mounted) setClassRecord(record)
      })
      .catch(() => {
        if (mounted) setPageError('No hemos podido cargar esta clase o ya no pertenece a tu calendario activo.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [classId, isDemoMode])

  const courseTitle = classRecord?.expand?.group?.expand?.course?.title || classRecord?.expand?.group?.expand?.course?.level || 'Language School'
  const groupName = classRecord?.expand?.group?.name || 'Tu grupo'
  const mode = classRecord?.delivery_mode || 'IN_PERSON'
  const canUseOnlineClass = Boolean(classRecord && classRecord.status === 'SCHEDULED' && (mode === 'ONLINE' || mode === 'HYBRID'))
  const busy = joinState === 'authorizing' || joinState === 'loading-sdk' || joinState === 'joining'

  const joinLabel = useMemo(() => {
    if (joinState === 'authorizing') return 'Comprobando tu acceso…'
    if (joinState === 'loading-sdk') return 'Cargando Zoom…'
    if (joinState === 'joining') return 'Entrando en la clase…'
    if (joinState === 'joined') return 'Aula iniciada'
    return 'Entrar al aula Zoom'
  }, [joinState])

  const handleJoin = async () => {
    if (!classId || !canUseOnlineClass || busy) return
    setJoinError(null)
    try {
      setJoinState('authorizing')
      const authorization = await getStudentZoomSdkAuthorization(classId)
      setJoinState('loading-sdk')
      const zoom = await loadZoomMeetingSdk()
      setJoinState('joining')
      await joinWithZoomClient(zoom, authorization)
      setJoinState('joined')
    } catch (error) {
      setJoinState('error')
      setJoinError(getErrorMessage(error))
    }
  }

  return (
    <main className="student-online-class-document">
      <div className="student-online-class-page">
        <header className="student-online-class-heading">
          <div className="student-online-class-heading-copy">
            <a className="student-online-class-brand" href="/alumno/clases" aria-label="Volver a Language School">
              <strong>LANGUAGE</strong><span>School</span><small>ROCÍO RUIZ</small>
            </a>
            <span className="eyebrow">AULA ONLINE</span>
            <h1>{classRecord?.topic || 'Tu clase online'}</h1>
            <p>Accede a tu sesión Zoom sin compartir credenciales privadas. La autorización se genera en el servidor y caduca automáticamente.</p>
          </div>
          <a className="button secondary" href="/alumno/clases">← Volver a Mis clases</a>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando aula…</div>}
        {pageError && <div className="cms-notice auth-error" role="alert">{pageError}</div>}

        {classRecord && (
          <section className="panel student-online-class-card" aria-labelledby="online-class-title">
            <div className="student-online-class-summary">
              <div>
                <span className="eyebrow">PRÓXIMA SESIÓN</span>
                <h2 id="online-class-title">{classRecord.topic || 'Clase de inglés'}</h2>
                <p>{courseTitle} · {groupName}</p>
              </div>
              <div className="student-online-class-time">
                <strong>{formatDateTime(classRecord.starts_at)}</strong>
                <span>{mode === 'HYBRID' ? 'Clase híbrida' : mode === 'ONLINE' ? 'Clase online' : 'Clase presencial'}</span>
              </div>
            </div>

            {canUseOnlineClass ? (
              <div className="student-online-class-actions">
                <div className="student-online-class-explainer">
                  <strong>Entrar dentro de Language School</strong>
                  <p>Zoom se abrirá en esta misma pestaña. Al salir de la reunión volverás automáticamente a Mis clases.</p>
                </div>
                <button className="button primary" type="button" onClick={handleJoin} disabled={busy || joinState === 'joined'}>
                  {joinLabel}
                </button>
                {classRecord.online_join_url && (
                  <a className="button secondary" href={classRecord.online_join_url} target="_blank" rel="noreferrer">
                    Abrir con Zoom ↗
                  </a>
                )}
              </div>
            ) : (
              <div className="cms-notice">Esta sesión no está disponible como aula online.</div>
            )}

            {joinError && (
              <div className="cms-notice auth-error student-online-class-error" role="alert">
                <strong>No hemos podido abrir el aula dentro de Language School.</strong>
                <span>{joinError}</span>
                {classRecord.online_join_url && <span>Puedes usar el botón «Abrir con Zoom» como alternativa.</span>}
              </div>
            )}

            <div className="student-online-class-privacy">
              <strong>Privacidad y seguridad</strong>
              <p>Language School no envía el Client Secret de Zoom al navegador. La firma de acceso es temporal y solo se entrega a un alumno con matrícula activa para esta clase.</p>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

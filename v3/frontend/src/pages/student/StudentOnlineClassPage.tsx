import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import JitsiClassroom from '../../components/JitsiClassroom'
import { useAuth } from '../../features/auth/AuthProvider'
import { getMyClass, type ClassDeliveryMode, type ClassRecord } from '../../services/pocketbase/studentPortal'
import { getStudentZoomSdkAuthorization } from '../../services/pocketbase/studentZoomMeeting'
import { configureZoomMeetingSdk, loadZoomMeetingSdk, type ZoomClientViewApi } from '../../services/zoomMeetingSdkCdn'
import { getJitsiJoinAuthorization, type JitsiJoinAuthorization } from '../../services/pocketbase/jitsiClassroom'
import { getOnlineClassProvider, onlineClassProviderLabel } from '../../utils/onlineClassProvider'

type JoinState = 'idle' | 'authorizing' | 'loading-sdk' | 'joining' | 'joined' | 'error'

type DemoClassView = {
  id: string
  topic: string
  startsAt: string
  courseTitle: string
  groupName: string
  mode: ClassDeliveryMode
  locationText: string
}

const demoClass: DemoClassView = {
  id: 'demo-u1',
  topic: 'Travel & experiences',
  startsAt: '2026-08-20T18:00:00+02:00',
  courseTitle: 'Adult English B1',
  groupName: 'B1 Evening',
  mode: 'HYBRID',
  locationText: 'Aula 2',
}

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
  const demoSession = isDemoMode && classId === demoClass.id ? demoClass : null
  const [classRecord, setClassRecord] = useState<ClassRecord | null>(null)
  const [loading, setLoading] = useState(!isDemoMode)
  const [pageError, setPageError] = useState<string | null>(null)
  const [joinState, setJoinState] = useState<JoinState>('idle')
  const [joinError, setJoinError] = useState<string | null>(null)
  const [jitsiAuthorization, setJitsiAuthorization] = useState<JitsiJoinAuthorization | null>(null)
  const [jitsiLoading, setJitsiLoading] = useState(false)

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

  const topic = demoSession?.topic || classRecord?.topic || 'Tu clase online'
  const courseTitle = demoSession?.courseTitle || classRecord?.expand?.group?.expand?.course?.title || classRecord?.expand?.group?.expand?.course?.level || 'Language School'
  const groupName = demoSession?.groupName || classRecord?.expand?.group?.name || 'Tu grupo'
  const mode = demoSession?.mode || classRecord?.delivery_mode || 'IN_PERSON'
  const locationText = demoSession?.locationText || classRecord?.location_text || ''
  const startsAt = demoSession?.startsAt || classRecord?.starts_at || ''
  const onlineJoinUrl = classRecord?.online_join_url || ''
  const onlineProvider = getOnlineClassProvider(onlineJoinUrl, classRecord?.video_provider)
  const showSession = Boolean(demoSession || classRecord)
  const canUseOnlineClass = Boolean(classRecord && classRecord.status === 'SCHEDULED' && (mode === 'ONLINE' || mode === 'HYBRID'))
  const canUseZoomClass = canUseOnlineClass && onlineProvider === 'ZOOM'
  const canUseJitsiClass = canUseOnlineClass && onlineProvider === 'JITSI'
  const busy = joinState === 'authorizing' || joinState === 'loading-sdk' || joinState === 'joining'

  const joinLabel = useMemo(() => {
    if (joinState === 'authorizing') return 'Comprobando tu acceso…'
    if (joinState === 'loading-sdk') return 'Cargando Zoom…'
    if (joinState === 'joining') return 'Entrando en la clase…'
    if (joinState === 'joined') return 'Aula iniciada'
    return 'Entrar en clase'
  }, [joinState])

  const handleJoin = async () => {
    if (isDemoMode || !classId || !canUseZoomClass || busy) return
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

  const handleJoinJitsi = async () => {
    if (isDemoMode || !classId || !canUseJitsiClass || jitsiLoading) return
    setJoinError(null)
    setJitsiLoading(true)
    try {
      setJitsiAuthorization(await getJitsiJoinAuthorization(classId))
    } catch (error) {
      setJoinError(getErrorMessage(error))
    } finally {
      setJitsiLoading(false)
    }
  }

  const handleJitsiError = useCallback((error: Error) => {
    setJoinError(error.message || 'No se ha podido abrir el aula Jitsi.')
  }, [])

  return (
    <main className="student-online-class-document student-online-class-phase10b">
      <div className="student-online-class-page">
        <header className="student-online-class-heading student-online-class-heading10">
          <div className="student-online-class-heading-copy">
            <Link className="student-online-class-brand" to="/alumno/clases" aria-label="Volver a Language School">
              <strong>LANGUAGE</strong><span>School</span><small>ROCÍO RUIZ</small>
            </Link>
            <span className="eyebrow">AULA ONLINE</span>
            <h1>{topic}</h1>
            <p>Esta es la antesala de tu sesión. Comprueba la clase y entra desde aquí; Language School prepara el acceso de forma segura.</p>
          </div>
          <Link className="button secondary" to="/alumno/clases">← Volver a Mis clases</Link>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando aula…</div>}
        {pageError && <div className="cms-notice auth-error" role="alert">{pageError}</div>}
        {isDemoMode && !demoSession && <div className="cms-notice">Esta aula de demostración no está disponible.</div>}

        {showSession && (
          <section className="student-online-session10" aria-labelledby="online-class-title">
            <div className="student-online-session10-main">
              <div className="student-online-class-summary student-online-class-summary10">
                <div>
                  <span className="eyebrow">TU SESIÓN</span>
                  <h2 id="online-class-title">{topic}</h2>
                  <p>{courseTitle} · {groupName}</p>
                </div>
                <div className="student-online-class-time">
                  <strong>{formatDateTime(startsAt)}</strong>
                  <span>{mode === 'HYBRID' ? 'Clase híbrida' : mode === 'ONLINE' ? 'Clase online' : 'Clase presencial'}</span>
                </div>
              </div>

              {demoSession ? (
                <div className="student-online-class-actions student-online-class-actions10">
                  <div className="student-online-class-explainer">
                    <span className="eyebrow">VISTA DEMO</span>
                    <strong>La transición te ha llevado al aula correcta</strong>
                    <p>En la web conectada, este mismo punto abrirá la videoclase configurada por la academia.</p>
                  </div>
                  <button className="button primary student-online-join10" type="button" disabled>
                    Videoclase real · modo conectado
                  </button>
                </div>
              ) : canUseJitsiClass ? (
                jitsiAuthorization ? (
                  <div className="jitsi-classroom-shell">
                    <div className="jitsi-classroom-notice"><span>◉</span><span>Si el profesor todavía no ha iniciado la sala, Jitsi te mantendrá esperando al moderador. No compartas el enlace del aula.</span></div>
                    <JitsiClassroom domain={jitsiAuthorization.domain} roomName={jitsiAuthorization.roomName} displayName={jitsiAuthorization.displayName} onError={handleJitsiError} />
                  </div>
                ) : (
                  <div className="student-online-class-actions student-online-class-actions10">
                    <div className="student-online-class-explainer">
                      <span className="eyebrow">AULA LANGUAGE SCHOOL</span>
                      <strong>Tu clase con Jitsi está preparada</strong>
                      <p>La videollamada se abrirá aquí dentro. Si eres el primero, espera a que el profesor entre como moderador.</p>
                    </div>
                    <button className="button primary student-online-join10" type="button" onClick={() => void handleJoinJitsi()} disabled={jitsiLoading}>
                      {jitsiLoading ? 'Comprobando tu acceso…' : 'Entrar en clase'}
                    </button>
                  </div>
                )
              ) : canUseOnlineClass && onlineProvider !== 'ZOOM' && onlineJoinUrl ? (
                <div className="student-online-class-actions student-online-class-actions10">
                  <div className="student-online-class-explainer">
                    <span className="eyebrow">{onlineClassProviderLabel(onlineProvider).toUpperCase()}</span>
                    <strong>Tu videoclase está preparada</strong>
                    <p>Al pulsar el botón se abrirá la plataforma en una pestaña nueva. Si la reunión requiere admisión, espera a que el profesor te dé acceso.</p>
                  </div>
                  <a className="button primary student-online-join10" href={onlineJoinUrl} target="_blank" rel="noreferrer">
                    Entrar en clase ↗
                  </a>
                </div>
              ) : canUseZoomClass ? (
                <div className="student-online-class-actions student-online-class-actions10">
                  <div className="student-online-class-explainer">
                    <span className="eyebrow">CUANDO QUIERAS ENTRAR</span>
                    <strong>Tu aula se abre dentro de Language School</strong>
                    <p>Al pulsar el botón prepararemos Zoom en esta misma pestaña. Al salir volverás a Mis clases.</p>
                  </div>
                  <button className="button primary student-online-join10" type="button" onClick={handleJoin} disabled={busy || joinState === 'joined'}>
                    {joinLabel}
                  </button>
                  {onlineJoinUrl && (
                    <a className="button secondary student-online-fallback10" href={onlineJoinUrl} target="_blank" rel="noreferrer">
                      Abrir en otra pestaña ↗
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
                  {onlineJoinUrl && <span>Puedes usar el acceso en otra pestaña como alternativa.</span>}
                </div>
              )}
            </div>

            <aside className="student-online-session10-side" aria-label="Información del aula">
              <span className="student-online-session10-number">AULA</span>
              <div><small>CURSO</small><strong>{courseTitle}</strong></div>
              <div><small>GRUPO</small><strong>{groupName}</strong></div>
              <div><small>MODALIDAD</small><strong>{mode === 'HYBRID' ? 'Híbrida' : mode === 'ONLINE' ? 'Online' : 'Presencial'}</strong></div>
              {mode === 'HYBRID' && locationText && <div><small>AULA FÍSICA</small><strong>{locationText}</strong></div>}
              {!demoSession && canUseOnlineClass && <div><small>VIDEOLLAMADA</small><strong>{onlineClassProviderLabel(onlineProvider)}</strong></div>}
              <div className="student-online-class-privacy student-online-class-privacy10">
                <strong>{demoSession ? 'Vista de demostración' : onlineProvider === 'JITSI' ? 'Acceso verificado por Language School' : onlineProvider === 'GOOGLE_MEET' ? 'Acceso mediante Google Meet' : 'Acceso protegido'}</strong>
                <p>{demoSession
                  ? 'La conexión real permanece desactivada en esta preview local.'
                  : onlineProvider === 'JITSI'
                    ? 'Language School comprueba tu matrícula antes de entregar la sala. meet.jit.si gestiona la videollamada y el profesor actúa como moderador.'
                  : onlineProvider === 'GOOGLE_MEET'
                    ? 'El enlace se abre directamente en Google Meet. Language School no necesita almacenar tu contraseña ni credenciales privadas de Google.'
                    : 'Tu autorización es temporal y personal. Las credenciales privadas de Zoom permanecen en el servidor.'}</p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  )
}

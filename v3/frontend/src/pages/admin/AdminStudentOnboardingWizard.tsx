import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { CefrLevel } from '../../services/pocketbase/placementTest'
import {
  AdminStudentOnboardingError,
  createAdminStudentOnboarding,
  hasStudentGroupLevelMismatch,
  loadAdminStudentOnboardingCatalog,
  type StudentOnboardingGroupOption,
  type StudentOnboardingLevelMode,
} from '../../services/pocketbase/adminStudentOnboarding'
import './admin-student-onboarding-wizard.css'

type WizardCourse = { id: string; title: string; level: string }
type WizardCatalog = { courses: WizardCourse[]; groups: StudentOnboardingGroupOption[] }
type WizardStep = 0 | 1 | 2 | 3 | 4
type WizardCompletion = {
  userId: string
  emailSent: boolean
  activationUrl: string
  expiresAt: string
  group: StudentOnboardingGroupOption
  levelMismatch: boolean
}

type Props = {
  isDemoMode: boolean
  onCancel: () => void
}

const cefrLevels: CefrLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const stepLabels = ['Identidad', 'Nivel', 'Curso', 'Grupo / aula', 'Revisión'] as const

const demoCatalog: WizardCatalog = {
  courses: [
    { id: 'demo-course-b1', title: 'Adult English B1', level: 'B1' },
    { id: 'demo-course-b2', title: 'Cambridge B2 First', level: 'B2' },
  ],
  groups: [
    {
      id: 'demo-group-b1',
      name: 'B1 Evening',
      courseId: 'demo-course-b1',
      courseTitle: 'Adult English B1',
      targetLevel: 'B1',
      teacherId: 'demo-teacher-rocio',
      teacherName: 'Rocío Ruiz',
      scheduleText: 'Martes y jueves · 18:00–19:00',
      deliveryMode: 'HYBRID',
      capacity: 10,
      occupied: 7,
      availableSeats: 3,
      status: 'ACTIVE',
    },
    {
      id: 'demo-group-b1-morning',
      name: 'B1 Morning',
      courseId: 'demo-course-b1',
      courseTitle: 'Adult English B1',
      targetLevel: 'B1',
      teacherId: 'demo-teacher-laura',
      teacherName: 'Laura Martín',
      scheduleText: 'Lunes y miércoles · 10:00–11:00',
      deliveryMode: 'IN_PERSON',
      capacity: 8,
      occupied: 8,
      availableSeats: 0,
      status: 'ACTIVE',
    },
    {
      id: 'demo-group-b2',
      name: 'B2 First · Afternoon',
      courseId: 'demo-course-b2',
      courseTitle: 'Cambridge B2 First',
      targetLevel: 'B2',
      teacherId: 'demo-teacher-rocio',
      teacherName: 'Rocío Ruiz',
      scheduleText: 'Lunes y miércoles · 17:00–18:30',
      deliveryMode: 'ONLINE',
      capacity: 10,
      occupied: 5,
      availableSeats: 5,
      status: 'ACTIVE',
    },
  ],
}

function deliveryLabel(mode: StudentOnboardingGroupOption['deliveryMode']): string {
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'HYBRID') return 'Híbrida'
  return 'Presencial'
}

function levelModeTitle(mode: StudentOnboardingLevelMode): string {
  if (mode === 'INITIAL') return 'Nivel inicial de academia'
  if (mode === 'TEST') return 'Test de nivel pendiente'
  return 'Sin evaluar todavía'
}

function levelModeDescription(mode: StudentOnboardingLevelMode): string {
  if (mode === 'INITIAL') return 'Registra una valoración inicial en el histórico académico.'
  if (mode === 'TEST') return 'El alumno completará el test de nivel desde su Campus tras activar la cuenta.'
  return 'No inventamos un nivel. Podrá evaluarse más adelante.'
}

export default function AdminStudentOnboardingWizard({ isDemoMode, onCancel }: Props) {
  const [step, setStep] = useState<WizardStep>(0)
  const [catalog, setCatalog] = useState<WizardCatalog | null>(isDemoMode ? demoCatalog : null)
  const [loadingCatalog, setLoadingCatalog] = useState(!isDemoMode)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [partialUserId, setPartialUserId] = useState<string | null>(null)
  const [completion, setCompletion] = useState<WizardCompletion | null>(null)
  const [copyStatus, setCopyStatus] = useState('')

  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [notesPrivate, setNotesPrivate] = useState('')
  const [levelMode, setLevelMode] = useState<StudentOnboardingLevelMode>('UNEVALUATED')
  const [initialLevel, setInitialLevel] = useState<CefrLevel | ''>('')
  const [levelNotes, setLevelNotes] = useState('')
  const [courseId, setCourseId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [acknowledgeLevelMismatch, setAcknowledgeLevelMismatch] = useState(false)

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    setLoadingCatalog(true)
    loadAdminStudentOnboardingCatalog()
      .then((loaded) => {
        if (!mounted) return
        setCatalog({
          courses: loaded.courses.map((course) => ({ id: course.id, title: course.title, level: course.level })),
          groups: loaded.groups,
        })
      })
      .catch((error) => {
        if (mounted) setCatalogError(error instanceof Error ? error.message : 'No se ha podido cargar la oferta académica.')
      })
      .finally(() => { if (mounted) setLoadingCatalog(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  const selectedCourse = catalog?.courses.find((course) => course.id === courseId)
  const availableGroups = useMemo(
    () => (catalog?.groups || []).filter((group) => group.courseId === courseId),
    [catalog, courseId],
  )
  const selectedGroup = availableGroups.find((group) => group.id === groupId)
  const mismatch = Boolean(
    selectedGroup &&
    levelMode === 'INITIAL' &&
    initialLevel &&
    hasStudentGroupLevelMismatch(initialLevel, selectedGroup.targetLevel),
  )

  useEffect(() => {
    setGroupId('')
    setAcknowledgeLevelMismatch(false)
  }, [courseId])

  useEffect(() => {
    setAcknowledgeLevelMismatch(false)
  }, [initialLevel, levelMode, groupId])

  function validateStep(current: WizardStep): string | null {
    if (current === 0) {
      if (!name.trim() || !surname.trim() || !email.trim()) return 'Completa nombre, apellidos y email antes de continuar.'
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Introduce un email válido.'
    }
    if (current === 1 && levelMode === 'INITIAL' && !initialLevel) return 'Selecciona el nivel inicial de academia.'
    if (current === 2 && !courseId) return 'Selecciona el curso antes de continuar.'
    if (current === 3) {
      if (!selectedGroup) return 'Selecciona un grupo disponible.'
      if (selectedGroup.availableSeats <= 0) return 'Ese grupo está completo. Selecciona otro grupo.'
    }
    return null
  }

  function nextStep() {
    const validation = validateStep(step)
    if (validation) { setSubmitError(validation); return }
    setSubmitError(null)
    setStep((value) => Math.min(4, value + 1) as WizardStep)
  }

  function previousStep() {
    setSubmitError(null)
    setStep((value) => Math.max(0, value - 1) as WizardStep)
  }

  async function submitOnboarding() {
    if (!selectedGroup || !selectedCourse) return
    if (mismatch && !acknowledgeLevelMismatch) {
      setSubmitError('Confirma expresamente la asignación de nivel antes de completar la matrícula.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    setPartialUserId(null)
    try {
      if (isDemoMode) {
        setCompletion({
          userId: 'demo-new-student',
          emailSent: false,
          activationUrl: `${window.location.origin}/activar-cuenta?token=demo-seguro`,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          group: selectedGroup,
          levelMismatch: mismatch,
        })
        return
      }

      const result = await createAdminStudentOnboarding({
        email,
        name,
        surname,
        phone,
        birthDate,
        guardianName,
        guardianPhone,
        notesPrivate,
        levelMode,
        initialLevel,
        levelNotes,
        courseId,
        groupId,
        acknowledgeLevelMismatch,
      })
      setCompletion({
        userId: result.userId,
        emailSent: result.invitation.emailSent,
        activationUrl: result.invitation.activationUrl,
        expiresAt: result.invitation.expiresAt,
        group: result.group,
        levelMismatch: result.levelMismatch,
      })
    } catch (error) {
      if (error instanceof AdminStudentOnboardingError) {
        setPartialUserId(error.userId)
        setSubmitError(error.message)
      } else {
        setSubmitError(error instanceof Error ? error.message : 'No se ha podido completar el alta del alumno.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function copyActivationUrl() {
    if (!completion?.activationUrl) return
    try {
      await navigator.clipboard.writeText(completion.activationUrl)
      setCopyStatus('Enlace copiado')
    } catch {
      setCopyStatus('Selecciona y copia el enlace manualmente')
    }
  }

  if (completion) {
    return (
      <section className="student-onboarding-card student-onboarding-success" aria-labelledby="student-onboarding-result-title">
        <div className="student-onboarding-success-mark" aria-hidden="true">✓</div>
        <div className="student-onboarding-success-copy">
          <span className="eyebrow">ALTA PREPARADA</span>
          <h3 id="student-onboarding-result-title">Alumno matriculado e invitación preparada</h3>
          <p>La cuenta queda pendiente de activación. La contraseña la elegirá el propio alumno o su familia desde el enlace seguro.</p>
        </div>

        <div className="student-onboarding-result-grid">
          <article><small>ALUMNO</small><strong>{name} {surname}</strong><span>{email}</span></article>
          <article><small>CURSO / GRUPO</small><strong>{completion.group.courseTitle}</strong><span>{completion.group.name}</span></article>
          <article><small>PROFESOR</small><strong>{completion.group.teacherName}</strong><span>Heredado del grupo</span></article>
          <article><small>ESTADO</small><strong>Pendiente de activación</strong><span>{completion.emailSent ? 'Invitación enviada por email' : 'Enlace disponible para copiar'}</span></article>
        </div>

        {completion.levelMismatch && (
          <div className="student-onboarding-warning compact" role="status">
            <strong>Asignación pedagógica confirmada</strong>
            <span>La matrícula conserva la confirmación explícita de que nivel y grupo no coinciden.</span>
          </div>
        )}

        {completion.activationUrl && (
          <div className="student-onboarding-invite-link">
            <div><span className="eyebrow">ENLACE DE ACTIVACIÓN</span><p>{completion.emailSent ? 'También puedes copiarlo si necesitas enviarlo manualmente.' : 'No se ha enviado correo desde este entorno. Copia el enlace temporal de forma segura.'}</p></div>
            <div className="student-onboarding-link-row">
              <input value={completion.activationUrl} readOnly aria-label="Enlace de activación" />
              <button className="button button-primary" type="button" onClick={copyActivationUrl}>Copiar enlace</button>
            </div>
            {copyStatus && <small role="status">{copyStatus}</small>}
          </div>
        )}

        <div className="student-onboarding-footer result-actions">
          <button type="button" onClick={onCancel}>Cerrar</button>
          {!isDemoMode && <Link className="button button-primary" to={`/admin/alumnos/${encodeURIComponent(completion.userId)}`}>Ver ficha del alumno →</Link>}
        </div>
      </section>
    )
  }

  return (
    <section className="student-onboarding-card" aria-labelledby="student-onboarding-title">
      <div className="student-onboarding-hero">
        <div>
          <span className="eyebrow">ALTA GUIADA · CUENTA SEGURA</span>
          <h3 id="student-onboarding-title">Nuevo alumno</h3>
          <p>Prepara identidad, nivel y matrícula. Administración nunca conoce ni escribe la contraseña del alumno.</p>
        </div>
        <div className="student-onboarding-security"><span aria-hidden="true">◌</span><strong>Invitación segura</strong><small>Contraseña elegida por el usuario</small></div>
      </div>

      <ol className="student-onboarding-steps" aria-label="Pasos del alta de alumno">
        {stepLabels.map((label, index) => (
          <li key={label} className={index === step ? 'active' : index < step ? 'done' : ''} aria-current={index === step ? 'step' : undefined}>
            <span>{index < step ? '✓' : index + 1}</span><small>{label}</small>
          </li>
        ))}
      </ol>

      {loadingCatalog && <div className="cms-notice" role="status">Cargando cursos y grupos disponibles…</div>}
      {catalogError && <div className="cms-notice auth-error" role="alert">{catalogError}</div>}
      {submitError && <div className="cms-notice auth-error" role="alert">{submitError}</div>}
      {partialUserId && (
        <div className="student-onboarding-warning" role="alert">
          <strong>La cuenta invitada ya existe</strong>
          <span>No vuelvas a crear el alumno. Revisa su ficha y completa desde allí el paso pendiente.</span>
          <Link to={`/admin/alumnos/${encodeURIComponent(partialUserId)}`}>Abrir ficha creada →</Link>
        </div>
      )}

      {!loadingCatalog && !catalogError && (
        <div className="student-onboarding-body">
          {step === 0 && (
            <div className="student-onboarding-section">
              <div className="student-onboarding-section-heading"><span className="eyebrow">01 · IDENTIDAD</span><h4>Datos del alumno</h4><p>Solo necesitamos los datos de contacto. La cuenta se creará como invitada.</p></div>
              <div className="student-onboarding-form-grid">
                <label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="given-name" required /></label>
                <label>Apellidos<input value={surname} onChange={(event) => setSurname(event.target.value)} autoComplete="family-name" required /></label>
                <label className="wide">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
                <label>Teléfono<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></label>
                <label>Fecha de nacimiento<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
                <label>Nombre tutor/a<input value={guardianName} onChange={(event) => setGuardianName(event.target.value)} /></label>
                <label>Teléfono tutor/a<input type="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} /></label>
                <label className="wide">Notas privadas<textarea rows={3} value={notesPrivate} onChange={(event) => setNotesPrivate(event.target.value)} placeholder="Información interna útil para Administración" /></label>
              </div>
              <div className="student-onboarding-password-note"><strong>Sin contraseña inicial</strong><span>El alumno recibirá una invitación y elegirá su propia contraseña al activar la cuenta.</span></div>
            </div>
          )}

          {step === 1 && (
            <div className="student-onboarding-section">
              <div className="student-onboarding-section-heading"><span className="eyebrow">02 · NIVEL</span><h4>¿Cómo empezamos su evaluación?</h4><p>El nivel forma parte del histórico académico. Si todavía no lo sabemos, lo dejamos expresamente sin evaluar.</p></div>
              <div className="student-onboarding-choice-grid">
                {(['UNEVALUATED', 'TEST', 'INITIAL'] as StudentOnboardingLevelMode[]).map((mode) => (
                  <label key={mode} className={`student-onboarding-choice${levelMode === mode ? ' selected' : ''}`}>
                    <input type="radio" name="levelMode" value={mode} checked={levelMode === mode} onChange={() => setLevelMode(mode)} />
                    <span className="choice-dot" aria-hidden="true" />
                    <strong>{levelModeTitle(mode)}</strong>
                    <small>{levelModeDescription(mode)}</small>
                  </label>
                ))}
              </div>
              {levelMode === 'INITIAL' && (
                <div className="student-onboarding-initial-level">
                  <label>Nivel inicial<select value={initialLevel} onChange={(event) => setInitialLevel(event.target.value as CefrLevel | '')}><option value="">Selecciona A1–C2</option>{cefrLevels.map((level) => <option value={level} key={level}>{level}</option>)}</select></label>
                  <label>Observación<textarea rows={3} value={levelNotes} onChange={(event) => setLevelNotes(event.target.value)} placeholder="Ej. entrevista inicial, experiencia previa…" /></label>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="student-onboarding-section">
              <div className="student-onboarding-section-heading"><span className="eyebrow">03 · CURSO</span><h4>Selecciona el programa</h4><p>Solo aparecen cursos activos. El grupo se elegirá en el siguiente paso.</p></div>
              <div className="student-onboarding-course-grid">
                {(catalog?.courses || []).map((course) => (
                  <button key={course.id} type="button" className={`student-onboarding-course${courseId === course.id ? ' selected' : ''}`} onClick={() => setCourseId(course.id)}>
                    <span>{course.level || 'Curso'}</span><strong>{course.title}</strong><small>{(catalog?.groups || []).filter((group) => group.courseId === course.id && group.availableSeats > 0).length} grupos con plaza</small>
                  </button>
                ))}
                {(catalog?.courses || []).length === 0 && <PortalEmptyCourse />}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="student-onboarding-section">
              <div className="student-onboarding-section-heading"><span className="eyebrow">04 · GRUPO / AULA</span><h4>Grupo, horario y profesor</h4><p>El profesor se hereda del grupo. No puede seleccionarse uno distinto de forma independiente.</p></div>
              <div className="student-onboarding-group-list">
                {availableGroups.map((group) => (
                  <button key={group.id} type="button" disabled={group.availableSeats <= 0} className={`student-onboarding-group${groupId === group.id ? ' selected' : ''}${group.availableSeats <= 0 ? ' full' : ''}`} onClick={() => setGroupId(group.id)}>
                    <div className="group-top"><span className="level-pill">{group.targetLevel}</span><span>{deliveryLabel(group.deliveryMode)}</span><span>{group.availableSeats > 0 ? `${group.availableSeats} plazas` : 'Completo'}</span></div>
                    <strong>{group.name}</strong>
                    <p>{group.scheduleText}</p>
                    <div className="group-teacher"><small>PROFESOR HEREDADO</small><b>{group.teacherName}</b></div>
                    <div className="group-capacity"><span style={{ width: `${Math.min(100, (group.occupied / Math.max(1, group.capacity)) * 100)}%` }} /></div>
                    <small>{group.occupied}/{group.capacity} alumnos</small>
                  </button>
                ))}
                {availableGroups.length === 0 && <div className="student-onboarding-empty"><strong>No hay grupos activos para este curso</strong><span>Vuelve al paso anterior y selecciona otro programa.</span></div>}
              </div>
            </div>
          )}

          {step === 4 && selectedGroup && selectedCourse && (
            <div className="student-onboarding-section">
              <div className="student-onboarding-section-heading"><span className="eyebrow">05 · REVISIÓN</span><h4>Confirma antes de crear la cuenta</h4><p>Este resumen es la última comprobación. Después se prepara la matrícula y se emite la invitación segura.</p></div>
              <div className="student-onboarding-review-grid">
                <article><small>IDENTIDAD</small><strong>{name} {surname}</strong><span>{email}</span>{phone && <span>{phone}</span>}</article>
                <article><small>NIVEL</small><strong>{levelModeTitle(levelMode)}</strong><span>{levelMode === 'INITIAL' ? initialLevel : levelMode === 'TEST' ? 'Pendiente de test' : 'Sin nivel asignado'}</span></article>
                <article><small>CURSO</small><strong>{selectedCourse.title}</strong><span>{selectedCourse.level || 'Programa activo'}</span></article>
                <article><small>GRUPO / MODALIDAD</small><strong>{selectedGroup.name}</strong><span>{selectedGroup.scheduleText} · {deliveryLabel(selectedGroup.deliveryMode)}</span></article>
                <article className="teacher-review"><small>PROFESOR</small><strong>{selectedGroup.teacherName}</strong><span>Asignado automáticamente desde el grupo</span></article>
                <article><small>PLAZAS</small><strong>{selectedGroup.availableSeats} disponibles</strong><span>{selectedGroup.occupied}/{selectedGroup.capacity} ocupadas</span></article>
              </div>

              {mismatch && (
                <label className={`student-onboarding-warning mismatch-confirm${acknowledgeLevelMismatch ? ' confirmed' : ''}`}>
                  <input type="checkbox" checked={acknowledgeLevelMismatch} onChange={(event) => setAcknowledgeLevelMismatch(event.target.checked)} />
                  <span><strong>Confirmar asignación con diferencia de nivel</strong><small>El nivel inicial es {initialLevel} y el grupo tiene nivel objetivo {selectedGroup.targetLevel}. Marca esta casilla solo si la asignación es intencionada.</small></span>
                </label>
              )}

              <div className="student-onboarding-final-note"><strong>Qué ocurrirá al confirmar</strong><span>1. Se crea la cuenta INVITED. 2. Se registra el nivel inicial si procede. 3. Se matricula en el grupo. 4. Se emite la invitación para que el alumno elija su contraseña.</span></div>
            </div>
          )}
        </div>
      )}

      <div className="student-onboarding-footer">
        <div>{step === 0 ? <button type="button" onClick={onCancel}>Cancelar alta</button> : <button type="button" onClick={previousStep} disabled={submitting}>← Atrás</button>}</div>
        <div className="student-onboarding-footer-progress"><span>Paso {step + 1} de 5</span></div>
        <div>{step < 4 ? <button className="button button-primary" type="button" onClick={nextStep} disabled={loadingCatalog || Boolean(catalogError)}>Continuar →</button> : <button className="button button-primary" type="button" onClick={submitOnboarding} disabled={submitting || (mismatch && !acknowledgeLevelMismatch)}>{submitting ? 'Preparando alta…' : 'Confirmar alta e invitación'}</button>}</div>
      </div>
    </section>
  )
}

function PortalEmptyCourse() {
  return <div className="student-onboarding-empty"><strong>No hay cursos activos</strong><span>Activa al menos un curso antes de crear una matrícula.</span></div>
}

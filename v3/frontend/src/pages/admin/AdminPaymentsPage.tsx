import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardShell from '../../components/DashboardShell'
import PortalEmptyState from '../../components/PortalEmptyState'
import { useAuth } from '../../features/auth/AuthProvider'
import { listAdminEnrollments, listAdminUsers, type AdminEnrollmentRecord } from '../../services/pocketbase/adminAcademic'
import {
  cancelAdminPayment,
  createAdminMonthlyPaymentsForGroup,
  createAdminPayment,
  effectivePaymentStatus,
  listAdminPayments,
  markAdminPaymentPaid,
  paymentCoverageUntil,
  refundAdminPayment,
  type BillingMode,
  type EffectivePaymentStatus,
  type PaymentMethod,
  type StudentPaymentRecord,
} from '../../services/pocketbase/adminPayments'
import type { GroupRecord } from '../../services/pocketbase/studentPortal'
import type { AppUser } from '../../services/pocketbase/types'
import { downloadPaymentsExcel } from '../../utils/paymentExcel'
import { adminNav } from './adminNav'

type PaymentFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'

const currency = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

function dateOnly(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function monthStart(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function monthEnd(date = new Date()): string {
  return dateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12))
}

function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthBounds(value: string): { start: string; end: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) return { start: monthStart(), end: monthEnd() }
  const year = Number(match[1])
  const month = Number(match[2])
  const lastDay = new Date(year, month, 0, 12).getDate()
  return { start: `${value}-01`, end: `${value}-${String(lastDay).padStart(2, '0')}` }
}

function formatDate(value?: string): string {
  if (!value) return '—'
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

function studentName(user?: AppUser): string {
  if (!user) return 'Alumno'
  return [user.name, user.surname].filter(Boolean).join(' ') || user.email
}

function modeLabel(mode: BillingMode): string {
  return mode === 'INTENSIVE' ? 'Intensivo' : 'Mensual'
}

function methodLabel(method?: PaymentMethod | ''): string {
  if (method === 'CASH') return 'Efectivo'
  if (method === 'CARD') return 'Tarjeta'
  if (method === 'TRANSFER') return 'Transferencia'
  if (method === 'BIZUM') return 'Bizum'
  if (method === 'OTHER') return 'Otro'
  return 'Sin método'
}

function effectiveLabel(status: EffectivePaymentStatus): string {
  if (status === 'PAID') return 'Pagado'
  if (status === 'OVERDUE') return 'Vencido'
  if (status === 'CANCELLED') return 'Cancelado'
  if (status === 'REFUNDED') return 'Reembolsado'
  return 'Pendiente'
}

const demoStudent: AppUser = { id: 'pay-demo-student', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'emma@example.com', name: 'Emma', surname: 'Martín', role: 'STUDENT', status: 'ACTIVE', phone: '' }
const demoStudent2: AppUser = { id: 'pay-demo-student-2', collectionId: '', collectionName: 'users', created: '', updated: '', expand: {}, email: 'daniel@example.com', name: 'Daniel', surname: 'López', role: 'STUDENT', status: 'ACTIVE', phone: '' }
const demoGroup: GroupRecord = { id: 'pay-demo-group', collectionId: '', collectionName: 'groups', created: '', updated: '', expand: {}, name: 'Adultos B1', course: 'demo-course', teacher: 'demo-teacher', academic_year: '2026/27', schedule_text: 'M/J 18:00', capacity: 8, status: 'ACTIVE' }
const demoEnrollment: AdminEnrollmentRecord = { id: 'pay-demo-enrollment', collectionId: '', collectionName: 'enrollments', created: '', updated: '', student: demoStudent.id, group: demoGroup.id, status: 'ACTIVE', joined_at: '', ended_at: '', expand: { student: demoStudent, group: demoGroup } }
const demoEnrollment2: AdminEnrollmentRecord = { id: 'pay-demo-enrollment-2', collectionId: '', collectionName: 'enrollments', created: '', updated: '', student: demoStudent2.id, group: demoGroup.id, status: 'ACTIVE', joined_at: '', ended_at: '', expand: { student: demoStudent2, group: demoGroup } }

function demoPayments(): StudentPaymentRecord[] {
  const now = new Date()
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12)
  return [
    {
      id: 'pay-demo-1', collectionId: '', collectionName: 'student_payments', created: '', updated: '',
      student: demoStudent.id, enrollment: demoEnrollment.id, billing_mode: 'MONTHLY', amount_cents: 5500,
      period_start: monthStart(now), period_end: monthEnd(now), due_date: `${monthKey(now)}-05`, status: 'PAID',
      paid_at: `${monthKey(now)}-03`, payment_method: 'BIZUM', reference: '', notes: '', recorded_by: 'demo-admin',
      expand: { student: demoStudent, enrollment: demoEnrollment },
    },
    {
      id: 'pay-demo-2', collectionId: '', collectionName: 'student_payments', created: '', updated: '',
      student: demoStudent2.id, enrollment: demoEnrollment2.id, billing_mode: 'MONTHLY', amount_cents: 5500,
      period_start: monthStart(now), period_end: monthEnd(now), due_date: `${monthKey(now)}-05`, status: 'PENDING',
      paid_at: '', payment_method: '', reference: '', notes: '', recorded_by: 'demo-admin',
      expand: { student: demoStudent2, enrollment: demoEnrollment2 },
    },
    {
      id: 'pay-demo-3', collectionId: '', collectionName: 'student_payments', created: '', updated: '',
      student: demoStudent.id, enrollment: demoEnrollment.id, billing_mode: 'MONTHLY', amount_cents: 5500,
      period_start: monthStart(previousMonth), period_end: monthEnd(previousMonth), due_date: `${monthKey(previousMonth)}-05`, status: 'PAID',
      paid_at: `${monthKey(previousMonth)}-02`, payment_method: 'TRANSFER', reference: '', notes: '', recorded_by: 'demo-admin',
      expand: { student: demoStudent, enrollment: demoEnrollment },
    },
  ]
}

export default function AdminPaymentsPage() {
  const { isDemoMode } = useAuth()
  const [students, setStudents] = useState<AppUser[]>(isDemoMode ? [demoStudent, demoStudent2] : [])
  const [enrollments, setEnrollments] = useState<AdminEnrollmentRecord[]>(isDemoMode ? [demoEnrollment, demoEnrollment2] : [])
  const [payments, setPayments] = useState<StudentPaymentRecord[]>(isDemoMode ? demoPayments() : [])
  const [loading, setLoading] = useState(!isDemoMode)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showBatch, setShowBatch] = useState(false)

  const initialStudent = new URLSearchParams(window.location.search).get('alumno') || ''
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<PaymentFilter>('ALL')
  const [groupFilter, setGroupFilter] = useState('ALL')
  const [modeFilter, setModeFilter] = useState<'ALL' | BillingMode>('ALL')
  const [monthFilter, setMonthFilter] = useState(monthKey())
  const [studentFilter, setStudentFilter] = useState(initialStudent || 'ALL')

  const [studentId, setStudentId] = useState(initialStudent)
  const [enrollmentId, setEnrollmentId] = useState('')
  const [billingMode, setBillingMode] = useState<BillingMode>('MONTHLY')
  const [amountEuros, setAmountEuros] = useState('55')
  const [periodStart, setPeriodStart] = useState(monthStart())
  const [periodEnd, setPeriodEnd] = useState(monthEnd())
  const [dueDate, setDueDate] = useState(`${monthKey()}-05`)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [paidAt, setPaidAt] = useState(dateOnly())
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BIZUM')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const [batchGroupId, setBatchGroupId] = useState(isDemoMode ? demoGroup.id : '')
  const [batchMonth, setBatchMonth] = useState(monthKey())
  const [batchAmountEuros, setBatchAmountEuros] = useState('55')
  const [batchDueDate, setBatchDueDate] = useState(`${monthKey()}-05`)
  const [batchReference, setBatchReference] = useState('')
  const [batchNotes, setBatchNotes] = useState('')

  const [payingId, setPayingId] = useState<string | null>(null)
  const [payDate, setPayDate] = useState(dateOnly())
  const [payMethod, setPayMethod] = useState<PaymentMethod>('BIZUM')
  const [payReference, setPayReference] = useState('')

  useEffect(() => {
    if (isDemoMode) return
    let mounted = true
    Promise.all([listAdminUsers('STUDENT'), listAdminEnrollments(), listAdminPayments()])
      .then(([studentRecords, enrollmentRecords, paymentRecords]) => {
        if (!mounted) return
        setStudents(studentRecords)
        setEnrollments(enrollmentRecords)
        setPayments(paymentRecords)
        const preferredStudent = initialStudent && studentRecords.some((record) => record.id === initialStudent) ? initialStudent : studentRecords[0]?.id || ''
        setStudentId(preferredStudent)
        const firstEnrollment = enrollmentRecords.find((record) => record.student === preferredStudent && record.status === 'ACTIVE')
        setEnrollmentId(firstEnrollment?.id || '')
      })
      .catch(() => { if (mounted) setError('No se ha podido cargar el control de pagos.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [isDemoMode])

  useEffect(() => {
    const active = enrollments.find((record) => record.student === studentId && record.status === 'ACTIVE')
    if (active && !enrollments.some((record) => record.id === enrollmentId && record.student === studentId)) setEnrollmentId(active.id)
  }, [enrollmentId, enrollments, studentId])

  const groups = useMemo(() => {
    const map = new Map<string, GroupRecord>()
    enrollments.forEach((record) => { if (record.expand?.group) map.set(record.expand.group.id, record.expand.group) })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [enrollments])

  useEffect(() => {
    if (!groups.length) return
    if (!groups.some((group) => group.id === batchGroupId)) setBatchGroupId(groups[0].id)
  }, [batchGroupId, groups])

  useEffect(() => {
    if (/^\d{4}-\d{2}$/.test(batchMonth)) setBatchDueDate(`${batchMonth}-05`)
  }, [batchMonth])

  const batchPeriod = useMemo(() => monthBounds(batchMonth), [batchMonth])
  const batchEnrollments = useMemo(
    () => enrollments.filter((record) => record.status === 'ACTIVE' && record.group === batchGroupId),
    [batchGroupId, enrollments],
  )
  const existingBatchEnrollmentIds = useMemo(() => new Set(
    payments
      .filter((record) => record.billing_mode === 'MONTHLY' && record.period_start.slice(0, 10) === batchPeriod.start && record.period_end.slice(0, 10) === batchPeriod.end)
      .map((record) => record.enrollment),
  ), [batchPeriod.end, batchPeriod.start, payments])
  const batchExistingCount = batchEnrollments.filter((record) => existingBatchEnrollmentIds.has(record.id)).length
  const batchMissingCount = Math.max(0, batchEnrollments.length - batchExistingCount)

  const visiblePayments = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return payments.filter((record) => {
      const effective = effectivePaymentStatus(record)
      const enrollment = enrollments.find((item) => item.id === record.enrollment) || record.expand?.enrollment
      const group = enrollment?.expand?.group
      const student = students.find((item) => item.id === record.student) || record.expand?.student
      const text = `${studentName(student)} ${student?.email || ''} ${group?.name || ''}`.toLowerCase()
      const matchesQuery = !normalized || text.includes(normalized)
      const matchesStatus = statusFilter === 'ALL' || effective === statusFilter
      const matchesGroup = groupFilter === 'ALL' || enrollment?.group === groupFilter
      const matchesMode = modeFilter === 'ALL' || record.billing_mode === modeFilter
      const matchesStudent = studentFilter === 'ALL' || record.student === studentFilter
      const matchesMonth = !monthFilter || (record.period_start.slice(0, 7) <= monthFilter && record.period_end.slice(0, 7) >= monthFilter)
      return matchesQuery && matchesStatus && matchesGroup && matchesMode && matchesStudent && matchesMonth
    })
  }, [enrollments, groupFilter, modeFilter, monthFilter, payments, query, statusFilter, studentFilter, students])

  const paidThisMonth = payments.filter((record) => record.status === 'PAID' && record.paid_at.slice(0, 7) === monthKey()).reduce((sum, record) => sum + record.amount_cents, 0)
  const pendingTotal = payments.filter((record) => record.status === 'PENDING').reduce((sum, record) => sum + record.amount_cents, 0)
  const overdueTotal = payments.filter((record) => effectivePaymentStatus(record) === 'OVERDUE').reduce((sum, record) => sum + record.amount_cents, 0)
  const activeStudentIds = new Set(enrollments.filter((record) => record.status === 'ACTIVE').map((record) => record.student))
  const studentsCurrent = [...activeStudentIds].filter((id) => {
    const studentPayments = payments.filter((record) => record.student === id)
    return paymentCoverageUntil(studentPayments) >= dateOnly() && !studentPayments.some((record) => effectivePaymentStatus(record) === 'OVERDUE')
  }).length

  const selectedStudentEnrollments = enrollments.filter((record) => record.student === studentId && record.status === 'ACTIVE')

  async function createPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null); setMessage(null)
    const amountCents = Math.round(Number.parseFloat(amountEuros.replace(',', '.')) * 100)
    if (!studentId || !enrollmentId) { setError('Selecciona un alumno y una matrícula activa.'); return }
    if (!Number.isFinite(amountCents) || amountCents <= 0) { setError('Indica un importe válido.'); return }
    if (isDemoMode) { setShowCreate(false); setMessage('Cobro preparado en la demostración. No se ha guardado ningún dato real.'); return }
    setSaving(true)
    try {
      const record = await createAdminPayment({ studentId, enrollmentId, billingMode, amountCents, periodStart, periodEnd, dueDate, alreadyPaid, paidAt, paymentMethod: alreadyPaid ? paymentMethod : undefined, reference, notes })
      setPayments((current) => [record, ...current])
      setShowCreate(false); setReference(''); setNotes(''); setAlreadyPaid(false)
      setMessage(alreadyPaid ? 'Pago registrado correctamente.' : 'Cobro pendiente creado correctamente.')
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : 'No se ha podido crear el cobro.')
    } finally { setSaving(false) }
  }

  async function createMonthlyBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null); setMessage(null)
    const amountCents = Math.round(Number.parseFloat(batchAmountEuros.replace(',', '.')) * 100)
    if (!batchGroupId) { setError('Selecciona un grupo para generar las mensualidades.'); return }
    if (!Number.isFinite(amountCents) || amountCents <= 0) { setError('Indica un importe válido para la mensualidad.'); return }
    if (!batchDueDate) { setError('Indica la fecha de vencimiento.'); return }
    if (batchMissingCount === 0) { setMessage('No hay mensualidades pendientes de generar para ese grupo y mes.'); return }

    setSaving(true)
    try {
      if (isDemoMode) {
        const missingEnrollments = batchEnrollments.filter((record) => !existingBatchEnrollmentIds.has(record.id))
        const created = missingEnrollments.map<StudentPaymentRecord>((enrollment, index) => ({
          id: `demo-batch-${batchMonth}-${enrollment.id}-${index}`,
          collectionId: '', collectionName: 'student_payments', created: '', updated: '',
          student: enrollment.student, enrollment: enrollment.id, billing_mode: 'MONTHLY', amount_cents: amountCents,
          period_start: batchPeriod.start, period_end: batchPeriod.end, due_date: batchDueDate, status: 'PENDING',
          paid_at: '', payment_method: '', reference: batchReference.trim(), notes: batchNotes.trim(), recorded_by: 'demo-admin',
          expand: { student: students.find((student) => student.id === enrollment.student) || enrollment.expand?.student, enrollment },
        }))
        setPayments((current) => [...created, ...current])
        setMessage(`${created.length} mensualidades preparadas en la demostración.`)
      } else {
        const result = await createAdminMonthlyPaymentsForGroup({
          groupId: batchGroupId,
          amountCents,
          periodStart: batchPeriod.start,
          periodEnd: batchPeriod.end,
          dueDate: batchDueDate,
          reference: batchReference,
          notes: batchNotes,
        })
        setPayments((current) => [...result.created, ...current])
        const createdText = `${result.created.length} ${result.created.length === 1 ? 'mensualidad creada' : 'mensualidades creadas'}`
        const skippedText = result.skippedExisting ? ` · ${result.skippedExisting} ya existían` : ''
        setMessage(`${createdText}${skippedText}.`)
      }
      setMonthFilter(batchMonth)
      setGroupFilter(batchGroupId)
      setModeFilter('MONTHLY')
      setStudentFilter('ALL')
      setStatusFilter('ALL')
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : 'No se han podido generar las mensualidades.')
    } finally { setSaving(false) }
  }

  async function confirmPaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const record = payments.find((item) => item.id === payingId)
    if (!record) return
    setError(null); setMessage(null)
    if (isDemoMode) {
      setPayments((current) => current.map((item) => item.id === record.id ? { ...item, status: 'PAID', paid_at: payDate, payment_method: payMethod, reference: payReference } : item))
      setPayingId(null); setMessage('Pago marcado como realizado en la demostración.'); return
    }
    setSaving(true)
    try {
      const updated = await markAdminPaymentPaid(record, { paidAt: payDate, paymentMethod: payMethod, reference: payReference })
      setPayments((current) => current.map((item) => item.id === updated.id ? updated : item))
      setPayingId(null); setPayReference(''); setMessage('Pago registrado correctamente.')
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : 'No se ha podido registrar el pago.')
    } finally { setSaving(false) }
  }

  async function cancelPayment(record: StudentPaymentRecord) {
    if (!window.confirm('¿Cancelar este cobro pendiente? El histórico se conservará.')) return
    if (isDemoMode) { setPayments((current) => current.map((item) => item.id === record.id ? { ...item, status: 'CANCELLED' } : item)); return }
    try { const updated = await cancelAdminPayment(record); setPayments((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage('Cobro cancelado conservando el histórico.') } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'No se ha podido cancelar.') }
  }

  async function refundPayment(record: StudentPaymentRecord) {
    if (!window.confirm('¿Marcar este pago como reembolsado?')) return
    if (isDemoMode) { setPayments((current) => current.map((item) => item.id === record.id ? { ...item, status: 'REFUNDED' } : item)); return }
    try { const updated = await refundAdminPayment(record); setPayments((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage('Pago marcado como reembolsado.') } catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'No se ha podido registrar el reembolso.') }
  }

  function exportCurrentExcel() {
    downloadPaymentsExcel({ records: visiblePayments, students, enrollments, periodLabel: monthFilter || 'todos-los-periodos' })
    setMessage(`Excel preparado con ${visiblePayments.length} ${visiblePayments.length === 1 ? 'registro' : 'registros'} según los filtros actuales.`)
  }

  return (
    <DashboardShell role="Administrador" name="Admin" nav={[...adminNav]}>
      <div className="dashboard-content cms-page admin-payments-page">
        <header className="cms-page-heading phase14-pink-heading">
          <div><span className="eyebrow">ADMINISTRACIÓN · COBROS</span><h2>Pagos de alumnos</h2><p>Controla mensualidades e intensivos, vencimientos, periodos cubiertos y el histórico de cada alumno.</p></div>
          <div className="payment-heading-actions">
            <button className="button phase14-export-button" type="button" onClick={exportCurrentExcel} disabled={visiblePayments.length === 0}>Descargar Excel</button>
            <button className="button payment-batch-trigger" type="button" onClick={() => { setShowBatch((value) => !value); setShowCreate(false) }}>{showBatch ? 'Cerrar lote' : 'Generar mensualidades'}</button>
            <button className="button button-primary" type="button" onClick={() => { setShowCreate((value) => !value); setShowBatch(false) }}>{showCreate ? 'Cerrar' : '+ Nuevo cobro'}</button>
          </div>
        </header>

        {loading && <div className="cms-notice" role="status">Cargando pagos…</div>}
        {message && <div className="cms-notice success-notice" role="status">{message}</div>}
        {error && <div className="cms-notice auth-error" role="alert">{error}</div>}

        <section className="metric-grid payment-metrics">
          <article><span>Cobrado este mes</span><strong>{currency.format(paidThisMonth / 100)}</strong><small>Pagos registrados</small></article>
          <article><span>Pendiente</span><strong>{currency.format(pendingTotal / 100)}</strong><small>Incluye vencidos</small></article>
          <article><span>Vencido</span><strong>{currency.format(overdueTotal / 100)}</strong><small>Fuera de plazo</small></article>
          <article><span>Al corriente</span><strong>{studentsCurrent}</strong><small>Alumnos activos cubiertos hoy</small></article>
        </section>

        {showBatch && <section className="panel admin-payment-batch" aria-label="Generación de mensualidades en lote">
          <div className="panel-heading"><div><span className="eyebrow">GENERACIÓN EN LOTE</span><h3>Mensualidades por grupo</h3><p>Crea solo las obligaciones que faltan para las matrículas activas. Los intensivos siguen gestionándose manualmente por su periodo concreto.</p></div><span className="status info">Solo mensual</span></div>
          <form className="payment-batch-grid" onSubmit={createMonthlyBatch}>
            <label>Grupo<select value={batchGroupId} onChange={(event) => setBatchGroupId(event.target.value)} required><option value="">Selecciona grupo</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
            <label>Mes<input type="month" value={batchMonth} onChange={(event) => setBatchMonth(event.target.value)} required /></label>
            <label>Importe por alumno (€)<input inputMode="decimal" value={batchAmountEuros} onChange={(event) => setBatchAmountEuros(event.target.value)} required /></label>
            <label>Vencimiento<input type="date" value={batchDueDate} onChange={(event) => setBatchDueDate(event.target.value)} required /></label>
            <label>Referencia<input value={batchReference} onChange={(event) => setBatchReference(event.target.value)} placeholder="Opcional" /></label>
            <label>Observaciones<input value={batchNotes} onChange={(event) => setBatchNotes(event.target.value)} placeholder="Opcional" /></label>

            <div className="payment-batch-preview payment-wide" aria-live="polite">
              <div><span>Matrículas activas</span><strong data-testid="batch-active-count">{batchEnrollments.length}</strong></div>
              <div><span>Ya generadas</span><strong data-testid="batch-existing-count">{batchExistingCount}</strong></div>
              <div className="batch-to-create"><span>Se crearán</span><strong data-testid="batch-missing-count">{batchMissingCount}</strong></div>
              <small>Periodo: {formatDate(batchPeriod.start)} → {formatDate(batchPeriod.end)}. Una mensualidad ya existente, aunque esté pagada, cancelada o reembolsada, no se duplica.</small>
            </div>

            <div className="payment-create-actions"><button type="button" onClick={() => setShowBatch(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || batchMissingCount === 0}>{saving ? 'Generando…' : batchMissingCount > 0 ? `Generar ${batchMissingCount} ${batchMissingCount === 1 ? 'mensualidad' : 'mensualidades'}` : 'Nada pendiente de generar'}</button></div>
          </form>
        </section>}

        {showCreate && <section className="panel admin-payment-create">
          <div className="panel-heading"><div><span className="eyebrow">NUEVO COBRO</span><h3>Mensualidad o intensivo</h3></div><span className="status info">Admin only</span></div>
          <form className="payment-create-grid" onSubmit={createPayment}>
            <label>Alumno<select value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">Selecciona alumno</option>{students.map((student) => <option key={student.id} value={student.id}>{studentName(student)}</option>)}</select></label>
            <label>Matrícula<select value={enrollmentId} onChange={(event) => setEnrollmentId(event.target.value)} required><option value="">Selecciona matrícula</option>{selectedStudentEnrollments.map((record) => <option key={record.id} value={record.id}>{record.expand?.group?.name || 'Grupo activo'}</option>)}</select></label>
            <label>Modalidad<select value={billingMode} onChange={(event) => setBillingMode(event.target.value as BillingMode)}><option value="MONTHLY">Mensual</option><option value="INTENSIVE">Intensivo</option></select></label>
            <label>Importe (€)<input inputMode="decimal" value={amountEuros} onChange={(event) => setAmountEuros(event.target.value)} required /></label>
            <label>Inicio del periodo<input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} required /></label>
            <label>Fin del periodo<input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} required /></label>
            <label>Vencimiento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required /></label>
            <label className="payment-paid-toggle"><input type="checkbox" checked={alreadyPaid} onChange={(event) => setAlreadyPaid(event.target.checked)} /> Registrar ya como pagado</label>
            {alreadyPaid && <><label>Fecha de pago<input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} required /></label><label>Método<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}><option value="CASH">Efectivo</option><option value="BIZUM">Bizum</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option><option value="OTHER">Otro</option></select></label></>}
            <label>Referencia<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Opcional" /></label>
            <label className="payment-wide">Observaciones<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></label>
            <div className="payment-create-actions"><button type="button" onClick={() => setShowCreate(false)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : alreadyPaid ? 'Registrar pago' : 'Crear pendiente'}</button></div>
          </form>
        </section>}

        <section className="admin-payments-toolbar" aria-label="Filtros de pagos">
          <label>Buscar<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Alumno, email o grupo" /></label>
          <label>Alumno<select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}><option value="ALL">Todos</option>{students.map((student) => <option value={student.id} key={student.id}>{studentName(student)}</option>)}</select></label>
          <label>Grupo<select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="ALL">Todos</option>{groups.map((group) => <option value={group.id} key={group.id}>{group.name}</option>)}</select></label>
          <label>Modalidad<select value={modeFilter} onChange={(event) => setModeFilter(event.target.value as typeof modeFilter)}><option value="ALL">Todas</option><option value="MONTHLY">Mensual</option><option value="INTENSIVE">Intensivo</option></select></label>
          <label>Mes<input type="month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} /></label>
          <div className="filter-pills payment-wide">{(['ALL', 'PENDING', 'OVERDUE', 'PAID'] as const).map((option) => <button type="button" key={option} className={statusFilter === option ? 'active' : ''} onClick={() => setStatusFilter(option)}>{option === 'ALL' ? 'Todos' : option === 'PENDING' ? 'Pendientes' : option === 'OVERDUE' ? 'Vencidos' : 'Pagados'}</button>)}</div>
        </section>

        <section className="payment-ledger">
          <div className="payment-ledger-heading"><div><span className="eyebrow">HISTÓRICO Y PENDIENTES</span><h3>{visiblePayments.length} registros</h3></div><span className="status info">Importes en EUR</span></div>
          <div className="payment-records">
            {visiblePayments.map((record) => {
              const enrollment = enrollments.find((item) => item.id === record.enrollment) || record.expand?.enrollment
              const student = students.find((item) => item.id === record.student) || record.expand?.student
              const effective = effectivePaymentStatus(record)
              return <article className="payment-record" key={record.id}>
                <div className="payment-student"><strong>{studentName(student)}</strong><small>{enrollment?.expand?.group?.name || 'Matrícula'} · {modeLabel(record.billing_mode)}</small></div>
                <div className="payment-period"><strong>{formatDate(record.period_start)} → {formatDate(record.period_end)}</strong><small>Vence {formatDate(record.due_date)}{record.status === 'PAID' ? ` · ${methodLabel(record.payment_method)} ${formatDate(record.paid_at)}` : ''}</small></div>
                <strong className="payment-amount">{currency.format(record.amount_cents / 100)}</strong>
                <span className={`payment-state ${effective.toLowerCase()}`}>{effectiveLabel(effective)}</span>
                <div className="payment-record-actions">{record.status === 'PENDING' && <><button type="button" onClick={() => { setPayingId(record.id); setPayDate(dateOnly()); setPayReference(record.reference || '') }}>Marcar pagado</button><button type="button" onClick={() => void cancelPayment(record)}>Cancelar</button></>}{record.status === 'PAID' && <button type="button" onClick={() => void refundPayment(record)}>Reembolsar</button>}</div>
              </article>
            })}
            {!loading && visiblePayments.length === 0 && <PortalEmptyState compact title="No hay pagos con estos filtros" description="Cambia el mes o los filtros, o crea el primer cobro del alumno." />}
          </div>

          {payingId && <div className="payment-pay-panel"><form onSubmit={confirmPaid}>
            <label>Fecha de pago<input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} required /></label>
            <label>Método<select value={payMethod} onChange={(event) => setPayMethod(event.target.value as PaymentMethod)}><option value="CASH">Efectivo</option><option value="BIZUM">Bizum</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option><option value="OTHER">Otro</option></select></label>
            <label>Referencia<input value={payReference} onChange={(event) => setPayReference(event.target.value)} /></label>
            <div className="payment-pay-actions"><button type="button" onClick={() => setPayingId(null)}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>Confirmar pago</button></div>
          </form></div>}
        </section>
      </div>
    </DashboardShell>
  )
}

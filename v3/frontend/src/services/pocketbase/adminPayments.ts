import type { RecordModel } from 'pocketbase'
import { getCurrentUser } from './auth'
import { collections } from './collections'
import { pb } from './client'
import type { AdminEnrollmentRecord } from './adminAcademic'
import type { AppUser } from './types'

export type BillingMode = 'MONTHLY' | 'INTENSIVE'
export type PaymentStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'REFUNDED'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'BIZUM' | 'OTHER'
export type EffectivePaymentStatus = PaymentStatus | 'OVERDUE'

export type StudentPaymentRecord = RecordModel & {
  student: string
  enrollment: string
  billing_mode: BillingMode
  amount_cents: number
  period_start: string
  period_end: string
  due_date: string
  status: PaymentStatus
  paid_at: string
  payment_method: PaymentMethod | ''
  reference: string
  notes: string
  recorded_by: string
  expand?: {
    student?: AppUser
    enrollment?: AdminEnrollmentRecord
    recorded_by?: AppUser
  }
}

function requireAdmin(): AppUser {
  const user = getCurrentUser()
  if (!user || user.role !== 'ADMIN') throw new Error('Se requiere una sesión de administrador activa.')
  return user
}

function quote(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function dateOnly(value: string): string {
  const normalized = value.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error('Revisa las fechas del cobro.')
  const date = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(date.getTime())) throw new Error('Revisa las fechas del cobro.')
  return normalized
}

function compareDate(a: string, b: string): number {
  return a.slice(0, 10).localeCompare(b.slice(0, 10))
}

async function assertEnrollmentBelongsToStudent(enrollmentId: string, studentId: string): Promise<AdminEnrollmentRecord> {
  requireAdmin()
  const enrollment = await pb.collection(collections.enrollments).getOne<AdminEnrollmentRecord>(enrollmentId, {
    expand: 'student,group,group.course,group.teacher',
  })
  if (enrollment.student !== studentId) throw new Error('La matrícula seleccionada no pertenece al alumno.')
  return enrollment
}

export function effectivePaymentStatus(record: StudentPaymentRecord, today = new Date()): EffectivePaymentStatus {
  if (record.status !== 'PENDING') return record.status
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return compareDate(record.due_date, current) < 0 ? 'OVERDUE' : 'PENDING'
}

export function paymentCoverageUntil(records: StudentPaymentRecord[]): string {
  return records
    .filter((record) => record.status === 'PAID')
    .reduce((latest, record) => compareDate(record.period_end, latest) > 0 ? record.period_end.slice(0, 10) : latest, '')
}

export function pendingAmountCents(records: StudentPaymentRecord[]): number {
  return records
    .filter((record) => record.status === 'PENDING')
    .reduce((sum, record) => sum + record.amount_cents, 0)
}

export async function listAdminPayments(input?: {
  studentId?: string
  enrollmentId?: string
  status?: PaymentStatus
  billingMode?: BillingMode
  limit?: number
}): Promise<StudentPaymentRecord[]> {
  requireAdmin()
  const filters: string[] = []
  if (input?.studentId) filters.push(`student = "${quote(input.studentId)}"`)
  if (input?.enrollmentId) filters.push(`enrollment = "${quote(input.enrollmentId)}"`)
  if (input?.status) filters.push(`status = "${input.status}"`)
  if (input?.billingMode) filters.push(`billing_mode = "${input.billingMode}"`)

  const result = await pb.collection(collections.studentPayments).getList<StudentPaymentRecord>(1, input?.limit || 500, {
    filter: filters.length ? filters.join(' && ') : undefined,
    sort: '-period_start,-due_date,-created',
    expand: 'student,enrollment,enrollment.group,enrollment.group.course,recorded_by',
  })
  return result.items
}

export async function createAdminPayment(input: {
  studentId: string
  enrollmentId: string
  billingMode: BillingMode
  amountCents: number
  periodStart: string
  periodEnd: string
  dueDate: string
  alreadyPaid?: boolean
  paidAt?: string
  paymentMethod?: PaymentMethod
  reference?: string
  notes?: string
}): Promise<StudentPaymentRecord> {
  const admin = requireAdmin()
  await assertEnrollmentBelongsToStudent(input.enrollmentId, input.studentId)

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 1_000_000) {
    throw new Error('El importe debe ser mayor que cero.')
  }

  const periodStart = dateOnly(input.periodStart)
  const periodEnd = dateOnly(input.periodEnd)
  const dueDate = dateOnly(input.dueDate)
  if (compareDate(periodEnd, periodStart) < 0) throw new Error('El final del periodo no puede ser anterior al inicio.')

  const alreadyPaid = Boolean(input.alreadyPaid)
  if (alreadyPaid && !input.paymentMethod) throw new Error('Indica el método del pago realizado.')
  const paidAt = alreadyPaid ? dateOnly(input.paidAt || new Date().toISOString().slice(0, 10)) : ''

  try {
    return await pb.collection(collections.studentPayments).create<StudentPaymentRecord>({
      student: input.studentId,
      enrollment: input.enrollmentId,
      billing_mode: input.billingMode,
      amount_cents: input.amountCents,
      period_start: periodStart,
      period_end: periodEnd,
      due_date: dueDate,
      status: alreadyPaid ? 'PAID' : 'PENDING',
      paid_at: paidAt,
      payment_method: alreadyPaid ? input.paymentMethod : '',
      reference: input.reference?.trim() || '',
      notes: input.notes?.trim() || '',
      recorded_by: admin.id,
    }, { expand: 'student,enrollment,enrollment.group,enrollment.group.course,recorded_by' })
  } catch (error: unknown) {
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : 0
    if (status === 400) throw new Error('Ya existe un cobro para ese alumno, matrícula, modalidad y periodo, o alguno de los datos no es válido.')
    throw error
  }
}

export async function markAdminPaymentPaid(record: StudentPaymentRecord, input: {
  paidAt: string
  paymentMethod: PaymentMethod
  reference?: string
}): Promise<StudentPaymentRecord> {
  requireAdmin()
  if (record.status !== 'PENDING') throw new Error('Solo los cobros pendientes pueden marcarse como pagados.')
  return pb.collection(collections.studentPayments).update<StudentPaymentRecord>(record.id, {
    status: 'PAID',
    paid_at: dateOnly(input.paidAt),
    payment_method: input.paymentMethod,
    reference: input.reference?.trim() || record.reference || '',
  }, { expand: 'student,enrollment,enrollment.group,enrollment.group.course,recorded_by' })
}

export async function cancelAdminPayment(record: StudentPaymentRecord, notes?: string): Promise<StudentPaymentRecord> {
  requireAdmin()
  if (record.status !== 'PENDING') throw new Error('Solo los cobros pendientes pueden cancelarse.')
  return pb.collection(collections.studentPayments).update<StudentPaymentRecord>(record.id, {
    status: 'CANCELLED',
    notes: notes?.trim() || record.notes || '',
  }, { expand: 'student,enrollment,enrollment.group,enrollment.group.course,recorded_by' })
}

export async function refundAdminPayment(record: StudentPaymentRecord, notes?: string): Promise<StudentPaymentRecord> {
  requireAdmin()
  if (record.status !== 'PAID') throw new Error('Solo un pago realizado puede marcarse como reembolsado.')
  return pb.collection(collections.studentPayments).update<StudentPaymentRecord>(record.id, {
    status: 'REFUNDED',
    notes: notes?.trim() || record.notes || '',
  }, { expand: 'student,enrollment,enrollment.group,enrollment.group.course,recorded_by' })
}

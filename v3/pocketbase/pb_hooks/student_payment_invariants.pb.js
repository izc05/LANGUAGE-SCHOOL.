/// <reference path="../pb_data/types.d.ts" />

function requireActivePaymentAdmin(e) {
  if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') {
    throw new ForbiddenError('Solo Administración activa puede registrar cobros.')
  }
}

function validatePaymentEnrollmentAndDates(e) {
  const studentId = e.record.getString('student')
  const enrollmentId = e.record.getString('enrollment')

  let enrollment
  try { enrollment = e.app.findRecordById('enrollments', enrollmentId) } catch {
    throw new BadRequestError('La matrícula asociada al cobro no existe.')
  }

  if (enrollment.getString('student') !== studentId) {
    throw new BadRequestError('La matrícula seleccionada no pertenece al alumno del cobro.')
  }

  const start = e.record.getDateTime('period_start')
  const end = e.record.getDateTime('period_end')
  if (start.isZero() || end.isZero() || end.before(start)) {
    throw new BadRequestError('El periodo del cobro no es válido.')
  }
}

function requirePaymentEvidence(record) {
  if (record.getDateTime('paid_at').isZero() || !record.getString('payment_method')) {
    throw new BadRequestError('Un pago realizado necesita fecha y método de pago.')
  }
}

function requireImmutablePaymentBase(current, next) {
  const stringFields = ['student', 'enrollment', 'billing_mode', 'recorded_by']
  for (const field of stringFields) {
    if (current.getString(field) !== next.getString(field)) {
      throw new BadRequestError('Los datos base del cobro no pueden reescribirse; registra una corrección mediante su estado.')
    }
  }

  if (current.getInt('amount_cents') !== next.getInt('amount_cents')) {
    throw new BadRequestError('Los datos base del cobro no pueden reescribirse; registra una corrección mediante su estado.')
  }

  const dateFields = ['period_start', 'period_end', 'due_date']
  for (const field of dateFields) {
    if (current.getDateTime(field).compare(next.getDateTime(field)) !== 0) {
      throw new BadRequestError('Los datos base del cobro no pueden reescribirse; registra una corrección mediante su estado.')
    }
  }
}

onRecordCreateRequest((e) => {
  requireActivePaymentAdmin(e)

  if (e.record.getString('recorded_by') !== e.auth.id) {
    throw new BadRequestError('El responsable del cobro debe ser la sesión de Administración actual.')
  }

  const status = e.record.getString('status')
  if (status !== 'PENDING' && status !== 'PAID') {
    throw new BadRequestError('Un cobro nuevo debe crearse como pendiente o pagado.')
  }
  if (status === 'PAID') requirePaymentEvidence(e.record)

  validatePaymentEnrollmentAndDates(e)
  e.next()
}, 'student_payments')

onRecordUpdateRequest((e) => {
  requireActivePaymentAdmin(e)

  let current
  try { current = e.app.findRecordById('student_payments', e.record.id) } catch {
    throw new BadRequestError('El cobro no existe.')
  }

  requireImmutablePaymentBase(current, e.record)

  const before = current.getString('status')
  const after = e.record.getString('status')
  const allowed = before === after ||
    (before === 'PENDING' && (after === 'PAID' || after === 'CANCELLED')) ||
    (before === 'PAID' && after === 'REFUNDED')
  if (!allowed) {
    throw new BadRequestError(`Transición de pago no permitida: ${before} → ${after}.`)
  }

  if (after === 'PAID' || after === 'REFUNDED') requirePaymentEvidence(e.record)

  validatePaymentEnrollmentAndDates(e)
  e.next()
}, 'student_payments')
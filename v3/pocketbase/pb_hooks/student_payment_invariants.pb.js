/// <reference path="../pb_data/types.d.ts" />

function paymentDateOnly(value) {
  return String(value || '').trim().slice(0, 10)
}

function requirePaymentEnrollmentMatch(e) {
  const studentId = e.record.getString('student')
  const enrollmentId = e.record.getString('enrollment')

  let enrollment
  try { enrollment = e.app.findRecordById('enrollments', enrollmentId) } catch {
    throw new BadRequestError('La matrícula asociada al cobro no existe.')
  }

  if (enrollment.getString('student') !== studentId) {
    throw new BadRequestError('La matrícula seleccionada no pertenece al alumno del cobro.')
  }

  const start = paymentDateOnly(e.record.getString('period_start'))
  const end = paymentDateOnly(e.record.getString('period_end'))
  if (!start || !end || end < start) {
    throw new BadRequestError('El periodo del cobro no es válido.')
  }

  if (!e.auth || e.auth.getString('role') !== 'ADMIN' || e.auth.getString('status') !== 'ACTIVE') {
    throw new ForbiddenError('Solo Administración activa puede registrar cobros.')
  }

  e.next()
}

onRecordCreateRequest((e) => {
  if (e.record.getString('recorded_by') !== e.auth.id) {
    throw new BadRequestError('El responsable del cobro debe ser la sesión de Administración actual.')
  }

  const status = e.record.getString('status')
  if (status !== 'PENDING' && status !== 'PAID') {
    throw new BadRequestError('Un cobro nuevo debe crearse como pendiente o pagado.')
  }
  if (status === 'PAID' && (!e.record.getString('paid_at') || !e.record.getString('payment_method'))) {
    throw new BadRequestError('Un pago realizado necesita fecha y método de pago.')
  }

  requirePaymentEnrollmentMatch(e)
}, 'student_payments')

onRecordUpdateRequest((e) => {
  let current
  try { current = e.app.findRecordById('student_payments', e.record.id) } catch {
    throw new BadRequestError('El cobro no existe.')
  }

  const immutableFields = ['student', 'enrollment', 'billing_mode', 'amount_cents', 'period_start', 'period_end', 'due_date', 'recorded_by']
  for (const field of immutableFields) {
    if (String(current.get(field) ?? '') !== String(e.record.get(field) ?? '')) {
      throw new BadRequestError('Los datos base del cobro no pueden reescribirse; registra una corrección mediante su estado.')
    }
  }

  const before = current.getString('status')
  const after = e.record.getString('status')
  const allowed = before === after ||
    (before === 'PENDING' && (after === 'PAID' || after === 'CANCELLED')) ||
    (before === 'PAID' && after === 'REFUNDED')
  if (!allowed) {
    throw new BadRequestError(`Transición de pago no permitida: ${before} → ${after}.`)
  }

  if ((after === 'PAID' || after === 'REFUNDED') && (!e.record.getString('paid_at') || !e.record.getString('payment_method'))) {
    throw new BadRequestError('Un pago realizado necesita fecha y método de pago.')
  }

  requirePaymentEnrollmentMatch(e)
}, 'student_payments')
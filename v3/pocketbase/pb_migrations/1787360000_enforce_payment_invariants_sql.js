migrate((app) => {
  const payments = app.findCollectionByNameOrId('student_payments')
  payments.createRule = '@request.auth.role = "ADMIN" && @request.auth.status = "ACTIVE" && @request.body.recorded_by = @request.auth.id'
  payments.updateRule = '@request.auth.role = "ADMIN" && @request.auth.status = "ACTIVE" && @request.body.student:changed = false && @request.body.enrollment:changed = false && @request.body.billing_mode:changed = false && @request.body.amount_cents:changed = false && @request.body.period_start:changed = false && @request.body.period_end:changed = false && @request.body.due_date:changed = false && @request.body.recorded_by:changed = false'
  app.save(payments)

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_student_payments_enrollment_match_insert
    BEFORE INSERT ON student_payments
    WHEN NOT EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = NEW.enrollment AND e.student = NEW.student
    )
    BEGIN
      SELECT RAISE(ABORT, 'payment_enrollment_student_mismatch');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_student_payments_initial_status_insert
    BEFORE INSERT ON student_payments
    WHEN NEW.status NOT IN ('PENDING', 'PAID')
    BEGIN
      SELECT RAISE(ABORT, 'payment_invalid_initial_status');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_student_payments_period_insert
    BEFORE INSERT ON student_payments
    WHEN julianday(NEW.period_end) < julianday(NEW.period_start)
    BEGIN
      SELECT RAISE(ABORT, 'payment_invalid_period');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_student_payments_paid_evidence_insert
    BEFORE INSERT ON student_payments
    WHEN NEW.status = 'PAID'
      AND (COALESCE(NEW.paid_at, '') = '' OR COALESCE(NEW.payment_method, '') = '')
    BEGIN
      SELECT RAISE(ABORT, 'payment_missing_paid_evidence');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_student_payments_base_immutable_update
    BEFORE UPDATE ON student_payments
    WHEN NEW.student IS NOT OLD.student
      OR NEW.enrollment IS NOT OLD.enrollment
      OR NEW.billing_mode IS NOT OLD.billing_mode
      OR NEW.amount_cents IS NOT OLD.amount_cents
      OR NEW.period_start IS NOT OLD.period_start
      OR NEW.period_end IS NOT OLD.period_end
      OR NEW.due_date IS NOT OLD.due_date
      OR NEW.recorded_by IS NOT OLD.recorded_by
    BEGIN
      SELECT RAISE(ABORT, 'payment_base_immutable');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_student_payments_status_transition_update
    BEFORE UPDATE OF status ON student_payments
    WHEN NOT (
      NEW.status = OLD.status
      OR (OLD.status = 'PENDING' AND NEW.status IN ('PAID', 'CANCELLED'))
      OR (OLD.status = 'PAID' AND NEW.status = 'REFUNDED')
    )
    BEGIN
      SELECT RAISE(ABORT, 'payment_invalid_status_transition');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_student_payments_paid_evidence_update
    BEFORE UPDATE ON student_payments
    WHEN NEW.status IN ('PAID', 'REFUNDED')
      AND (COALESCE(NEW.paid_at, '') = '' OR COALESCE(NEW.payment_method, '') = '')
    BEGIN
      SELECT RAISE(ABORT, 'payment_missing_paid_evidence');
    END
  `).execute()
}, (app) => {
  for (const name of [
    'trg_student_payments_paid_evidence_update',
    'trg_student_payments_status_transition_update',
    'trg_student_payments_base_immutable_update',
    'trg_student_payments_paid_evidence_insert',
    'trg_student_payments_period_insert',
    'trg_student_payments_initial_status_insert',
    'trg_student_payments_enrollment_match_insert',
  ]) {
    app.db().newQuery(`DROP TRIGGER IF EXISTS ${name}`).execute()
  }

  const payments = app.findCollectionByNameOrId('student_payments')
  payments.createRule = '@request.auth.role = "ADMIN"'
  payments.updateRule = '@request.auth.role = "ADMIN"'
  app.save(payments)
})

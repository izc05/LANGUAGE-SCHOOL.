migrate((app) => {
  const payments = app.findCollectionByNameOrId('student_payments')
  payments.updateRule = '@request.auth.role = "ADMIN" && @request.auth.status = "ACTIVE" && @request.body.student:changed = false && @request.body.enrollment:changed = false && @request.body.billing_mode:changed = false && @request.body.period_start:changed = false && @request.body.period_end:changed = false && @request.body.recorded_by:changed = false'
  app.save(payments)

  app.db().newQuery('DROP TRIGGER IF EXISTS trg_student_payments_base_immutable_update').execute()
  app.db().newQuery(`
    CREATE TRIGGER trg_student_payments_base_immutable_update
    BEFORE UPDATE ON student_payments
    WHEN NEW.student IS NOT OLD.student
      OR NEW.enrollment IS NOT OLD.enrollment
      OR NEW.billing_mode IS NOT OLD.billing_mode
      OR NEW.period_start IS NOT OLD.period_start
      OR NEW.period_end IS NOT OLD.period_end
      OR NEW.recorded_by IS NOT OLD.recorded_by
      OR (
        (NEW.amount_cents IS NOT OLD.amount_cents OR NEW.due_date IS NOT OLD.due_date)
        AND NOT (OLD.status = 'PENDING' AND NEW.status = 'PENDING')
      )
    BEGIN
      SELECT RAISE(ABORT, 'payment_base_immutable');
    END
  `).execute()
}, (app) => {
  app.db().newQuery('DROP TRIGGER IF EXISTS trg_student_payments_base_immutable_update').execute()
  app.db().newQuery(`
    CREATE TRIGGER trg_student_payments_base_immutable_update
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

  const payments = app.findCollectionByNameOrId('student_payments')
  payments.updateRule = '@request.auth.role = "ADMIN" && @request.auth.status = "ACTIVE" && @request.body.student:changed = false && @request.body.enrollment:changed = false && @request.body.billing_mode:changed = false && @request.body.amount_cents:changed = false && @request.body.period_start:changed = false && @request.body.period_end:changed = false && @request.body.due_date:changed = false && @request.body.recorded_by:changed = false'
  app.save(payments)
})

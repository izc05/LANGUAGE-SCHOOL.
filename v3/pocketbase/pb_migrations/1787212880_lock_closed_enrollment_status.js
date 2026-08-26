migrate((app) => {
  app.db().newQuery('DROP TRIGGER IF EXISTS trg_enrollments_no_closed_reactivation').execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_enrollments_closed_status_immutable
    BEFORE UPDATE OF status ON enrollments
    WHEN OLD.status IN ('FINISHED', 'CANCELLED') AND NEW.status != OLD.status
    BEGIN
      SELECT RAISE(ABORT, 'closed_enrollment_status_immutable');
    END
  `).execute()
}, (app) => {
  app.db().newQuery('DROP TRIGGER IF EXISTS trg_enrollments_closed_status_immutable').execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_enrollments_no_closed_reactivation
    BEFORE UPDATE OF status ON enrollments
    WHEN OLD.status IN ('FINISHED', 'CANCELLED') AND NEW.status = 'ACTIVE'
    BEGIN
      SELECT RAISE(ABORT, 'closed_enrollment_cannot_reactivate');
    END
  `).execute()
})

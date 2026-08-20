migrate((app) => {
  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_enrollments_capacity_insert
    BEFORE INSERT ON enrollments
    WHEN NEW.status = 'ACTIVE'
      AND (
        SELECT COUNT(*) FROM enrollments e
        WHERE e."group" = NEW."group" AND e.status = 'ACTIVE'
      ) >= (
        SELECT g.capacity FROM groups g WHERE g.id = NEW."group"
      )
    BEGIN
      SELECT RAISE(ABORT, 'group_capacity_reached');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_enrollments_capacity_reactivate
    BEFORE UPDATE OF status ON enrollments
    WHEN OLD.status != 'ACTIVE' AND NEW.status = 'ACTIVE'
      AND (
        SELECT COUNT(*) FROM enrollments e
        WHERE e."group" = NEW."group" AND e.status = 'ACTIVE'
      ) >= (
        SELECT g.capacity FROM groups g WHERE g.id = NEW."group"
      )
    BEGIN
      SELECT RAISE(ABORT, 'group_capacity_reached');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_enrollments_no_closed_reactivation
    BEFORE UPDATE OF status ON enrollments
    WHEN OLD.status IN ('FINISHED', 'CANCELLED') AND NEW.status = 'ACTIVE'
    BEGIN
      SELECT RAISE(ABORT, 'closed_enrollment_cannot_reactivate');
    END
  `).execute()

  app.db().newQuery(`
    CREATE TRIGGER IF NOT EXISTS trg_enrollments_identity_immutable
    BEFORE UPDATE OF student, "group" ON enrollments
    WHEN NEW.student != OLD.student OR NEW."group" != OLD."group"
    BEGIN
      SELECT RAISE(ABORT, 'enrollment_identity_immutable');
    END
  `).execute()
}, (app) => {
  for (const name of [
    'trg_enrollments_identity_immutable',
    'trg_enrollments_no_closed_reactivation',
    'trg_enrollments_capacity_reactivate',
    'trg_enrollments_capacity_insert',
  ]) {
    app.db().newQuery(`DROP TRIGGER IF EXISTS ${name}`).execute()
  }
})

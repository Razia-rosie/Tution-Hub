-- 007: interview instructions, applicant confirmation and rescheduling.
--
-- instructions: the administrator's message to the applicant about the interview.
-- confirmed_at: when the applicant confirmed they can attend; cleared when the
--   interview is rescheduled, so the new time must be confirmed again.
-- updated_at:   when the schedule was last changed.
--
-- Additive only: each column is guarded by an information_schema check, no
-- existing row changes, and the file is safe to re-run. Apply with
-- `go run ./cmd/migrate`.

SET @schema = DATABASE();

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'interviews' AND column_name = 'instructions'),
    'SELECT 1',
    'ALTER TABLE interviews ADD COLUMN instructions TEXT NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'interviews' AND column_name = 'confirmed_at'),
    'SELECT 1',
    'ALTER TABLE interviews ADD COLUMN confirmed_at DATETIME(6) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'interviews' AND column_name = 'updated_at'),
    'SELECT 1',
    'ALTER TABLE interviews ADD COLUMN updated_at DATETIME(6) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

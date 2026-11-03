-- 008: tuition lifecycle after the demo class: agreement, classroom join
-- requests, monthly completion and two-party payment confirmation.
--
-- engagements.status gains 'agreed': both sides confirmed the terms, but the
--   tuition has not started yet (its classroom and join requests are pending).
--   The value is appended to the end of the ENUM so existing rows keep their
--   stored values.
-- classroom_join_requests: one row per invited participant (guardian and/or
--   student) of a tuition's classroom; only accepted participants get access.
-- payment_records gains:
--   completed_at      when the tutor marked the month completed
--   reminder_sent_at  when the single payment reminder for the month was sent
--   amount_paid       the amount the payer says they paid
--   pay_method        how they paid (free text, e.g. "Cash", "Mobile banking")
--   pay_reference     a transaction or receipt reference
--
-- Additive only: every change is guarded by an information_schema check, no
-- existing row changes, and the file is safe to re-run. Apply with
-- `go run ./cmd/migrate`.

SET @schema = DATABASE();

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'engagements' AND column_name = 'status' AND column_type LIKE '%''agreed''%'),
    'SELECT 1',
    'ALTER TABLE engagements MODIFY COLUMN status ENUM(''trial_requested'', ''trial_scheduled'', ''trial_declined'', ''proposed'', ''active'', ''completed'', ''cancelled'', ''agreed'') NOT NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS classroom_join_requests (
    id CHAR(36) NOT NULL PRIMARY KEY,
    classroom_id CHAR(36) NOT NULL,
    engagement_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    participant ENUM('guardian', 'student') NOT NULL,
    status ENUM('pending', 'accepted', 'rejected') NOT NULL DEFAULT 'pending',
    responded_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_join_classroom_user (classroom_id, user_id),
    INDEX idx_join_user (user_id, status),
    INDEX idx_join_engagement (engagement_id),
    CONSTRAINT fk_join_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_join_engagement FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE,
    CONSTRAINT fk_join_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'payment_records' AND column_name = 'completed_at'),
    'SELECT 1',
    'ALTER TABLE payment_records ADD COLUMN completed_at DATETIME(6) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'payment_records' AND column_name = 'reminder_sent_at'),
    'SELECT 1',
    'ALTER TABLE payment_records ADD COLUMN reminder_sent_at DATETIME(6) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'payment_records' AND column_name = 'amount_paid'),
    'SELECT 1',
    'ALTER TABLE payment_records ADD COLUMN amount_paid DECIMAL(10,2) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'payment_records' AND column_name = 'pay_method'),
    'SELECT 1',
    'ALTER TABLE payment_records ADD COLUMN pay_method VARCHAR(60) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'payment_records' AND column_name = 'pay_reference'),
    'SELECT 1',
    'ALTER TABLE payment_records ADD COLUMN pay_reference VARCHAR(120) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 003: marketplace, messaging, tuition agreements, classrooms, coaching
-- management, reviews, payment tracking, support and platform settings.
--
-- Additive only: new tables use CREATE TABLE IF NOT EXISTS and every new
-- column or index on an existing table is guarded by an information_schema
-- check, so this file is safe on databases holding real data and safe to
-- re-run. Apply with `go run ./cmd/migrate`.

SET @schema = DATABASE();

-- Richer profiles (tutor, coaching, student, parent share role_profiles).
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'bio'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN bio TEXT NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'current_study'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN current_study VARCHAR(160) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'results'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN results VARCHAR(255) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'mediums'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN mediums JSON NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'gender'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN gender VARCHAR(20) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'photo_key'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN photo_key VARCHAR(64) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'photo_mime'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN photo_mime VARCHAR(40) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'listed'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN listed TINYINT(1) NOT NULL DEFAULT 1'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'class_name'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN class_name VARCHAR(60) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'opening_hours'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN opening_hours VARCHAR(160) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'established'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN established VARCHAR(10) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'role_profiles' AND column_name = 'district'),
    'SELECT 1',
    'ALTER TABLE role_profiles ADD COLUMN district VARCHAR(80) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Tuition posts gain the fields the post form collects, and a paused state.
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'tuition_listings' AND column_name = 'medium'),
    'SELECT 1',
    'ALTER TABLE tuition_listings ADD COLUMN medium VARCHAR(60) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'tuition_listings' AND column_name = 'days'),
    'SELECT 1',
    'ALTER TABLE tuition_listings ADD COLUMN days VARCHAR(80) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'tuition_listings' AND column_name = 'time_slot'),
    'SELECT 1',
    'ALTER TABLE tuition_listings ADD COLUMN time_slot VARCHAR(60) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'tuition_listings' AND column_name = 'student_id'),
    'SELECT 1',
    'ALTER TABLE tuition_listings ADD COLUMN student_id CHAR(36) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'tuition_listings' AND column_name = 'updated_at'),
    'SELECT 1',
    'ALTER TABLE tuition_listings ADD COLUMN updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
-- Widening an ENUM keeps every existing value valid.
ALTER TABLE tuition_listings MODIFY COLUMN status ENUM('open', 'paused', 'filled', 'closed') NOT NULL DEFAULT 'open';
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @schema AND table_name = 'tuition_listings' AND index_name = 'idx_listing_status'),
    'SELECT 1',
    'CREATE INDEX idx_listing_status ON tuition_listings (status, created_at)'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @schema AND table_name = 'tuition_listings' AND index_name = 'idx_listing_owner'),
    'SELECT 1',
    'CREATE INDEX idx_listing_owner ON tuition_listings (owner_id)'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @schema AND table_name = 'audit_logs' AND index_name = 'idx_audit_action'),
    'SELECT 1',
    'CREATE INDEX idx_audit_action ON audit_logs (action, created_at)'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @schema AND table_name = 'audit_logs' AND index_name = 'idx_audit_created'),
    'SELECT 1',
    'CREATE INDEX idx_audit_created ON audit_logs (created_at)'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @schema AND table_name = 'users' AND index_name = 'idx_users_role_status'),
    'SELECT 1',
    'CREATE INDEX idx_users_role_status ON users (role, account_status)'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS tuition_applications (
    id CHAR(36) NOT NULL PRIMARY KEY,
    listing_id CHAR(36) NOT NULL,
    tutor_id CHAR(36) NOT NULL,
    note TEXT NULL,
    status ENUM('applied', 'shortlisted', 'accepted', 'declined', 'withdrawn') NOT NULL DEFAULT 'applied',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_application (listing_id, tutor_id),
    INDEX idx_application_tutor (tutor_id, status),
    CONSTRAINT fk_application_listing FOREIGN KEY (listing_id) REFERENCES tuition_listings(id) ON DELETE CASCADE,
    CONSTRAINT fk_application_tutor FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS saved_listings (
    user_id CHAR(36) NOT NULL,
    listing_id CHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (user_id, listing_id),
    CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_listing FOREIGN KEY (listing_id) REFERENCES tuition_listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS conversations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    last_message_at DATETIME(6) NULL,
    INDEX idx_conversation_recent (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    last_read_at DATETIME(6) NULL,
    PRIMARY KEY (conversation_id, user_id),
    INDEX idx_participant_user (user_id),
    CONSTRAINT fk_participant_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS messages (
    id CHAR(36) NOT NULL PRIMARY KEY,
    conversation_id CHAR(36) NOT NULL,
    sender_id CHAR(36) NULL,
    body TEXT NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_message_conversation (conversation_id, created_at),
    CONSTRAINT fk_message_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS connection_requests (
    id CHAR(36) NOT NULL PRIMARY KEY,
    from_id CHAR(36) NOT NULL,
    to_id CHAR(36) NOT NULL,
    listing_id CHAR(36) NULL,
    student_id CHAR(36) NULL,
    message TEXT NULL,
    status ENUM('pending', 'accepted', 'declined', 'cancelled') NOT NULL DEFAULT 'pending',
    conversation_id CHAR(36) NULL,
    responded_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_request_to (to_id, status),
    INDEX idx_request_from (from_id, status),
    CONSTRAINT fk_request_from FOREIGN KEY (from_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_request_to FOREIGN KEY (to_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_request_listing FOREIGN KEY (listing_id) REFERENCES tuition_listings(id) ON DELETE SET NULL,
    CONSTRAINT fk_request_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_request_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id CHAR(36) NOT NULL,
    blocked_id CHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT fk_block_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_block_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A tuition agreement between a tutor and a guardian (or an adult student),
-- from demo-class request through confirmation to completion.
CREATE TABLE IF NOT EXISTS engagements (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tutor_id CHAR(36) NOT NULL,
    guardian_id CHAR(36) NULL,
    student_id CHAR(36) NULL,
    listing_id CHAR(36) NULL,
    conversation_id CHAR(36) NULL,
    subject VARCHAR(100) NOT NULL,
    class_name VARCHAR(60) NOT NULL,
    days VARCHAR(80) NULL,
    time_slot VARCHAR(60) NULL,
    mode ENUM('online', 'offline') NOT NULL DEFAULT 'offline',
    location_note VARCHAR(255) NULL,
    monthly_fee DECIMAL(10,2) NULL,
    start_date DATE NULL,
    status ENUM('trial_requested', 'trial_scheduled', 'trial_declined', 'proposed', 'active', 'completed', 'cancelled') NOT NULL,
    trial_at DATETIME(6) NULL,
    trial_note VARCHAR(255) NULL,
    tutor_confirmed_at DATETIME(6) NULL,
    guardian_confirmed_at DATETIME(6) NULL,
    cancel_reason VARCHAR(255) NULL,
    created_by CHAR(36) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_engagement_tutor (tutor_id, status),
    INDEX idx_engagement_guardian (guardian_id, status),
    INDEX idx_engagement_student (student_id, status),
    CONSTRAINT fk_engagement_tutor FOREIGN KEY (tutor_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_engagement_guardian FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_engagement_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_engagement_listing FOREIGN KEY (listing_id) REFERENCES tuition_listings(id) ON DELETE SET NULL,
    CONSTRAINT fk_engagement_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
    CONSTRAINT fk_engagement_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS payment_records (
    id CHAR(36) NOT NULL PRIMARY KEY,
    engagement_id CHAR(36) NOT NULL,
    month CHAR(7) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('due', 'marked_paid', 'confirmed', 'disputed') NOT NULL DEFAULT 'due',
    note VARCHAR(255) NULL,
    marked_at DATETIME(6) NULL,
    confirmed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_payment_month (engagement_id, month),
    CONSTRAINT fk_payment_engagement FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    engagement_id CHAR(36) NOT NULL,
    reviewer_id CHAR(36) NOT NULL,
    subject_id CHAR(36) NOT NULL,
    stars TINYINT UNSIGNED NOT NULL,
    body TEXT NULL,
    reply TEXT NULL,
    replied_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_review (engagement_id, reviewer_id),
    INDEX idx_review_subject (subject_id, created_at),
    CONSTRAINT chk_review_stars CHECK (stars BETWEEN 1 AND 5),
    CONSTRAINT fk_review_engagement FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_subject FOREIGN KEY (subject_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Coaching centre organisation.
CREATE TABLE IF NOT EXISTS coaching_branches (
    id CHAR(36) NOT NULL PRIMARY KEY,
    coaching_id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    address VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_branch_coaching (coaching_id),
    CONSTRAINT fk_branch_coaching FOREIGN KEY (coaching_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS coaching_teachers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    coaching_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL,
    name VARCHAR(120) NOT NULL,
    subject VARCHAR(100) NULL,
    qualification VARCHAR(160) NULL,
    phone VARCHAR(32) NULL,
    email VARCHAR(255) NULL,
    status ENUM('active', 'invited', 'inactive') NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_teacher_coaching (coaching_id, status),
    CONSTRAINT fk_teacher_coaching FOREIGN KEY (coaching_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS coaching_courses (
    id CHAR(36) NOT NULL PRIMARY KEY,
    coaching_id CHAR(36) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    subjects JSON NULL,
    monthly_fee DECIMAL(10,2) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_course_coaching (coaching_id),
    CONSTRAINT fk_course_coaching FOREIGN KEY (coaching_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Enrolled learners. user_id links a roster entry to a student account when
-- the learner has one; many coaching students do not.
CREATE TABLE IF NOT EXISTS coaching_students (
    id CHAR(36) NOT NULL PRIMARY KEY,
    coaching_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL,
    name VARCHAR(120) NOT NULL,
    class_name VARCHAR(60) NULL,
    guardian_name VARCHAR(120) NULL,
    guardian_phone VARCHAR(32) NULL,
    guardian_user_id CHAR(36) NULL,
    status ENUM('active', 'paused', 'left') NOT NULL DEFAULT 'active',
    admitted_at DATE NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_cstudent_coaching (coaching_id, status),
    INDEX idx_cstudent_user (user_id),
    INDEX idx_cstudent_guardian (guardian_user_id),
    CONSTRAINT fk_cstudent_coaching FOREIGN KEY (coaching_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_cstudent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_cstudent_guardian FOREIGN KEY (guardian_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS classrooms (
    id CHAR(36) NOT NULL PRIMARY KEY,
    owner_id CHAR(36) NOT NULL,
    engagement_id CHAR(36) NULL,
    name VARCHAR(160) NOT NULL,
    subject VARCHAR(100) NULL,
    description TEXT NULL,
    archived_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_classroom_engagement (engagement_id),
    INDEX idx_classroom_owner (owner_id),
    CONSTRAINT fk_classroom_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_classroom_engagement FOREIGN KEY (engagement_id) REFERENCES engagements(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS coaching_batches (
    id CHAR(36) NOT NULL PRIMARY KEY,
    coaching_id CHAR(36) NOT NULL,
    course_id CHAR(36) NULL,
    branch_id CHAR(36) NULL,
    teacher_id CHAR(36) NULL,
    classroom_id CHAR(36) NULL,
    name VARCHAR(120) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    class_name VARCHAR(60) NULL,
    days VARCHAR(80) NULL,
    time_slot VARCHAR(60) NULL,
    room VARCHAR(60) NULL,
    capacity INT UNSIGNED NULL,
    monthly_fee DECIMAL(10,2) NULL,
    status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_batch_coaching (coaching_id, status),
    CONSTRAINT fk_batch_coaching FOREIGN KEY (coaching_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_batch_course FOREIGN KEY (course_id) REFERENCES coaching_courses(id) ON DELETE SET NULL,
    CONSTRAINT fk_batch_branch FOREIGN KEY (branch_id) REFERENCES coaching_branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_batch_teacher FOREIGN KEY (teacher_id) REFERENCES coaching_teachers(id) ON DELETE SET NULL,
    CONSTRAINT fk_batch_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS batch_enrollments (
    batch_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    enrolled_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (batch_id, student_id),
    INDEX idx_enrollment_student (student_id),
    CONSTRAINT fk_enrollment_batch FOREIGN KEY (batch_id) REFERENCES coaching_batches(id) ON DELETE CASCADE,
    CONSTRAINT fk_enrollment_student FOREIGN KEY (student_id) REFERENCES coaching_students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS exams (
    id CHAR(36) NOT NULL PRIMARY KEY,
    batch_id CHAR(36) NOT NULL,
    title VARCHAR(160) NOT NULL,
    exam_date DATE NOT NULL,
    total_marks DECIMAL(6,2) NOT NULL,
    published_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_exam_batch (batch_id, exam_date),
    CONSTRAINT fk_exam_batch FOREIGN KEY (batch_id) REFERENCES coaching_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS exam_marks (
    exam_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    marks DECIMAL(6,2) NULL,
    PRIMARY KEY (exam_id, student_id),
    CONSTRAINT fk_mark_exam FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    CONSTRAINT fk_mark_student FOREIGN KEY (student_id) REFERENCES coaching_students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS coaching_fees (
    id CHAR(36) NOT NULL PRIMARY KEY,
    coaching_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    month CHAR(7) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('due', 'paid', 'waived') NOT NULL DEFAULT 'due',
    paid_at DATETIME(6) NULL,
    reminded_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_fee_month (student_id, month),
    INDEX idx_fee_coaching (coaching_id, month),
    CONSTRAINT fk_fee_coaching FOREIGN KEY (coaching_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_fee_student FOREIGN KEY (student_id) REFERENCES coaching_students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Learners in a classroom: student accounts, or coaching roster entries.
CREATE TABLE IF NOT EXISTS classroom_members (
    classroom_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    added_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (classroom_id, student_id),
    INDEX idx_member_student (student_id),
    CONSTRAINT fk_member_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_member_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS classroom_materials (
    id CHAR(36) NOT NULL PRIMARY KEY,
    classroom_id CHAR(36) NOT NULL,
    author_id CHAR(36) NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NULL,
    link_url VARCHAR(500) NULL,
    file_key VARCHAR(64) NULL,
    file_name VARCHAR(255) NULL,
    file_mime VARCHAR(80) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_material_classroom (classroom_id, created_at),
    CONSTRAINT fk_material_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_material_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS assignments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    classroom_id CHAR(36) NOT NULL,
    author_id CHAR(36) NULL,
    kind ENUM('homework', 'assignment') NOT NULL DEFAULT 'homework',
    title VARCHAR(200) NOT NULL,
    instructions TEXT NULL,
    due_at DATETIME(6) NOT NULL,
    max_score DECIMAL(6,2) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_assignment_classroom (classroom_id, due_at),
    CONSTRAINT fk_assignment_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_assignment_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS submissions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    assignment_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    note TEXT NULL,
    file_key VARCHAR(64) NULL,
    file_name VARCHAR(255) NULL,
    file_mime VARCHAR(80) NULL,
    status ENUM('submitted', 'reviewed', 'revision') NOT NULL DEFAULT 'submitted',
    score DECIMAL(6,2) NULL,
    feedback TEXT NULL,
    submitted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    reviewed_at DATETIME(6) NULL,
    UNIQUE KEY uq_submission (assignment_id, student_id),
    INDEX idx_submission_student (student_id),
    CONSTRAINT fk_submission_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    CONSTRAINT fk_submission_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS class_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    classroom_id CHAR(36) NOT NULL,
    starts_at DATETIME(6) NOT NULL,
    ends_at DATETIME(6) NULL,
    status ENUM('scheduled', 'held', 'cancelled', 'rescheduled') NOT NULL DEFAULT 'scheduled',
    note VARCHAR(255) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_session_classroom (classroom_id, starts_at),
    CONSTRAINT fk_session_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- learner_kind says whether learner_id is a user (student account) or a coaching_students roster entry.
CREATE TABLE IF NOT EXISTS attendance_marks (
    session_id CHAR(36) NOT NULL,
    learner_kind ENUM('user', 'roster') NOT NULL,
    learner_id CHAR(36) NOT NULL,
    mark ENUM('present', 'absent', 'late', 'excused') NOT NULL,
    marked_by CHAR(36) NULL,
    marked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (session_id, learner_kind, learner_id),
    INDEX idx_attendance_learner (learner_kind, learner_id),
    CONSTRAINT fk_attendance_session FOREIGN KEY (session_id) REFERENCES class_sessions(id) ON DELETE CASCADE,
    CONSTRAINT fk_attendance_marker FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS diary_entries (
    id CHAR(36) NOT NULL PRIMARY KEY,
    classroom_id CHAR(36) NOT NULL,
    author_id CHAR(36) NULL,
    entry_date DATE NOT NULL,
    topics TEXT NOT NULL,
    homework TEXT NULL,
    note TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_diary_day (classroom_id, entry_date),
    CONSTRAINT fk_diary_classroom FOREIGN KEY (classroom_id) REFERENCES classrooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_diary_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS awards (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(255) NULL,
    awarded_by CHAR(36) NULL,
    awarded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_award_user (user_id),
    CONSTRAINT fk_award_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_award_admin FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Complaints, abuse reports and support requests.
CREATE TABLE IF NOT EXISTS support_tickets (
    id CHAR(36) NOT NULL PRIMARY KEY,
    reporter_id CHAR(36) NULL,
    subject_user_id CHAR(36) NULL,
    listing_id CHAR(36) NULL,
    category ENUM('support', 'complaint', 'report_user', 'report_post', 'safety', 'payment', 'appeal') NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    status ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    assignee_id CHAR(36) NULL,
    resolution TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    INDEX idx_ticket_status (status, created_at),
    INDEX idx_ticket_reporter (reporter_id),
    CONSTRAINT fk_ticket_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_subject FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_listing FOREIGN KEY (listing_id) REFERENCES tuition_listings(id) ON DELETE SET NULL,
    CONSTRAINT fk_ticket_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS platform_settings (
    setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
    setting_value JSON NOT NULL,
    updated_by CHAR(36) NULL,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_setting_admin FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

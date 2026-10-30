ALTER TABLE users
    MODIFY COLUMN role ENUM('tutor', 'student', 'parent', 'coaching', 'admin') NOT NULL DEFAULT 'parent';

SET @schema = DATABASE();
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'users' AND column_name = 'account_status'),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN account_status ENUM(''pending'', ''resubmission_required'', ''interview_pending'', ''interview_scheduled'', ''interview_completed'', ''approved'', ''profile_incomplete'', ''active'', ''rejected'', ''suspended'') NOT NULL DEFAULT ''pending'''
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'users' AND column_name = 'profile_completed_at'),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN profile_completed_at DATETIME(6) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'users' AND column_name = 'suspended_at'),
    'SELECT 1',
    'ALTER TABLE users ADD COLUMN suspended_at DATETIME(6) NULL'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS role_profiles (
    user_id CHAR(36) NOT NULL PRIMARY KEY,
    display_name VARCHAR(120) NULL,
    institution VARCHAR(180) NULL,
    education TEXT NULL,
    subjects JSON NULL,
    classes JSON NULL,
    areas JSON NULL,
    teaching_modes JSON NULL,
    availability JSON NULL,
    experience_years DECIMAL(4,1) NULL,
    fee_expectation DECIMAL(10,2) NULL,
    address TEXT NULL,
    birth_date DATE NULL,
    guardian_notes TEXT NULL,
    completion_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS verification_applications (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    status ENUM('draft', 'pending', 'under_review', 'resubmission_required', 'approved', 'rejected') NOT NULL DEFAULT 'draft',
    submitted_at DATETIME(6) NULL,
    reviewed_at DATETIME(6) NULL,
    reviewer_id CHAR(36) NULL,
    rejection_reason TEXT NULL,
    correction_request TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_verification_user (user_id),
    INDEX idx_verification_status (status),
    CONSTRAINT fk_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_verification_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS verification_documents (
    id CHAR(36) NOT NULL PRIMARY KEY,
    application_id CHAR(36) NOT NULL,
    document_type VARCHAR(64) NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    byte_size BIGINT UNSIGNED NOT NULL,
    sha256 CHAR(64) NOT NULL,
    uploaded_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_document_type (application_id, document_type),
    CONSTRAINT fk_document_application FOREIGN KEY (application_id) REFERENCES verification_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS interviews (
    id CHAR(36) NOT NULL PRIMARY KEY,
    application_id CHAR(36) NOT NULL,
    scheduled_by CHAR(36) NOT NULL,
    mode ENUM('online', 'in_person') NOT NULL,
    scheduled_at DATETIME(6) NOT NULL,
    location_or_link VARCHAR(500) NULL,
    status ENUM('scheduled', 'completed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    notes TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_interview_application FOREIGN KEY (application_id) REFERENCES verification_applications(id) ON DELETE CASCADE,
    CONSTRAINT fk_interview_scheduler FOREIGN KEY (scheduled_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS guardian_student_links (
    id CHAR(36) NOT NULL PRIMARY KEY,
    guardian_id CHAR(36) NOT NULL,
    student_id CHAR(36) NOT NULL,
    relationship VARCHAR(64) NOT NULL,
    evidence_document_id CHAR(36) NULL,
    status ENUM('pending', 'approved', 'rejected', 'revoked') NOT NULL DEFAULT 'pending',
    reviewed_by CHAR(36) NULL,
    reviewed_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_guardian_student (guardian_id, student_id),
    CONSTRAINT fk_link_guardian FOREIGN KEY (guardian_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_link_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_link_document FOREIGN KEY (evidence_document_id) REFERENCES verification_documents(id) ON DELETE SET NULL,
    CONSTRAINT fk_link_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id CHAR(36) NOT NULL PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    kind VARCHAR(64) NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    read_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_notifications_user (user_id, created_at),
    CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id CHAR(36) NOT NULL PRIMARY KEY,
    actor_id CHAR(36) NULL,
    subject_user_id CHAR(36) NULL,
    action VARCHAR(100) NOT NULL,
    metadata JSON NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_audit_subject (subject_user_id, created_at),
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_audit_subject FOREIGN KEY (subject_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tuition_listings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    owner_id CHAR(36) NOT NULL,
    subject VARCHAR(100) NOT NULL,
    class_name VARCHAR(80) NOT NULL,
    area VARCHAR(120) NOT NULL,
    mode ENUM('online', 'offline', 'both') NOT NULL,
    schedule JSON NULL,
    budget DECIMAL(10,2) NULL,
    requirements TEXT NULL,
    status ENUM('open', 'filled', 'closed') NOT NULL DEFAULT 'open',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_listing_search (status, subject, class_name, area),
    CONSTRAINT fk_listing_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

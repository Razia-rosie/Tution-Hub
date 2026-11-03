-- 006: parent and student verification with parent-initiated student invitations.
--
-- Parents and students now go through the same manual, picture-based review as
-- tutors (their pictures live in verification_applications /
-- verification_documents). A parent asks for a student account by giving the
-- child's email; an administrator grants permission; the child then signs up
-- with that exact email, chooses their own password and is reviewed separately.
--
-- One row per child email: a rejected or cancelled invitation is reused in
-- place when the email is invited again, so the unique key also prevents
-- duplicate live invitations without partial indexes (TiDB compatible).
--
-- Additive only and safe to re-run. Existing parent and student accounts keep
-- their current status. Apply with `go run ./cmd/migrate`.

CREATE TABLE IF NOT EXISTS student_invitations (
    id CHAR(36) NOT NULL PRIMARY KEY,
    parent_id CHAR(36) NOT NULL,
    child_email VARCHAR(255) NOT NULL,
    child_name VARCHAR(120) NULL,
    relationship VARCHAR(64) NOT NULL,
    status ENUM('pending_approval', 'approved', 'rejected', 'registered', 'cancelled') NOT NULL DEFAULT 'pending_approval',
    student_id CHAR(36) NULL,
    reviewed_by CHAR(36) NULL,
    reviewed_at DATETIME(6) NULL,
    rejection_reason TEXT NULL,
    expires_at DATETIME(6) NULL,
    registered_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_invitation_email (child_email),
    UNIQUE KEY uq_invitation_student (student_id),
    INDEX idx_invitation_parent (parent_id, created_at),
    INDEX idx_invitation_status (status),
    CONSTRAINT fk_invitation_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_invitation_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_invitation_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

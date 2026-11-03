package auth

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// A student account can only be created with the exact email a parent gave in
// a student invitation that an administrator approved (see
// workflow.CreateInvitation). The child chooses their own password here; the
// parent never sees or sets it.

// InvitationError explains why an email cannot be used to register a student.
type InvitationError struct{ Code string }

func (e *InvitationError) Error() string { return "student invitation " + e.Code }

// Message is safe to show to the person signing up.
func (e *InvitationError) Message() string {
	switch e.Code {
	case "pending_approval":
		return "Your parent's request for this email is still waiting for an administrator. Try again after it is approved."
	case "expired":
		return "The permission to register with this email has expired. Ask your parent to request it again."
	case "used":
		return "A student account has already been created with this email. Log in instead."
	case "not_authorized":
		return "This email is not authorised to create a student account. Ask your parent or guardian to check their verification page."
	default:
		return "This email has not been invited by a verified parent or guardian. Use the exact email your parent submitted."
	}
}

type invitationRow struct {
	ID                 string         `db:"id"`
	ParentID           string         `db:"parent_id"`
	Relationship       string         `db:"relationship"`
	Status             string         `db:"status"`
	ExpiresAt          *time.Time     `db:"expires_at"`
	ParentStatus       string         `db:"parent_status"`
	ParentVerification sql.NullString `db:"parent_verification"`
}

const invitationLookup = `SELECT i.id, i.parent_id, i.relationship, i.status, i.expires_at, p.account_status AS parent_status, pv.status AS parent_verification
	FROM student_invitations i JOIN users p ON p.id = i.parent_id LEFT JOIN verification_applications pv ON pv.user_id = p.id WHERE i.child_email = ?`

// invitationProblem returns the reason an invitation cannot be used, or "".
func invitationProblem(row invitationRow, now time.Time) string {
	switch row.Status {
	case "approved":
	case "pending_approval":
		return "pending_approval"
	case "registered":
		return "used"
	default:
		return "not_authorized"
	}
	if row.ExpiresAt != nil && row.ExpiresAt.Before(now) {
		return "expired"
	}
	// Permission ends if the parent is no longer approved (suspended, for example).
	if row.ParentStatus != "active" || row.ParentVerification.String != "approved" {
		return "not_authorized"
	}
	return ""
}

// CheckStudentInvitation reports whether email may be used to register a student.
// It returns nil when registration is allowed, or an *InvitationError.
func (s *Service) CheckStudentInvitation(ctx context.Context, email string) error {
	email = strings.ToLower(strings.TrimSpace(email))
	var taken int
	if err := s.db.GetContext(ctx, &taken, `SELECT COUNT(*) FROM users WHERE email = ?`, email); err != nil {
		return err
	}
	var row invitationRow
	err := s.db.GetContext(ctx, &row, invitationLookup, email)
	if errors.Is(err, sql.ErrNoRows) {
		return &InvitationError{Code: "not_invited"}
	}
	if err != nil {
		return err
	}
	if taken > 0 {
		return &InvitationError{Code: "used"}
	}
	if problem := invitationProblem(row, time.Now()); problem != "" {
		return &InvitationError{Code: problem}
	}
	return nil
}

// registerInvitedStudent creates the student account, consumes the invitation
// and records a pending guardian link, all in one transaction so an invitation
// can be used exactly once.
func (s *Service) registerInvitedStudent(ctx context.Context, user User) error {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var row invitationRow
	err = tx.GetContext(ctx, &row, invitationLookup+` FOR UPDATE`, user.Email)
	if errors.Is(err, sql.ErrNoRows) {
		return &InvitationError{Code: "not_invited"}
	}
	if err != nil {
		return err
	}
	if problem := invitationProblem(row, time.Now()); problem != "" {
		return &InvitationError{Code: problem}
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO users (id, name, email, phone, password_hash, role, account_status) VALUES (?, ?, ?, ?, ?, 'student', ?)`,
		user.ID, user.Name, user.Email, user.Phone, user.PasswordHash, user.AccountStatus); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return ErrConflict
		}
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE student_invitations SET status = 'registered', student_id = ?, registered_at = UTC_TIMESTAMP(6) WHERE id = ?`, user.ID, row.ID); err != nil {
		return err
	}
	// The link stays pending until an administrator approves the student.
	if _, err = tx.ExecContext(ctx, `INSERT INTO guardian_student_links (id, guardian_id, student_id, relationship, status) VALUES (?, ?, ?, ?, 'pending') ON DUPLICATE KEY UPDATE relationship = VALUES(relationship), status = 'pending', reviewed_by = NULL, reviewed_at = NULL`, uuid.NewString(), row.ParentID, user.ID, row.Relationship); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, 'student_registered', 'Your child signed up', ?)`, uuid.NewString(), row.ParentID, user.Name+" created their student account with "+user.Email+". An administrator will now review it."); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, 'student_registered_from_invitation', JSON_OBJECT('invitation_id', ?, 'parent_id', ?))`, uuid.NewString(), user.ID, user.ID, row.ID, row.ParentID); err != nil {
		return err
	}
	return tx.Commit()
}

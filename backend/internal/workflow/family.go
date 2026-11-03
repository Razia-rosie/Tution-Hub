package workflow

import (
	"context"
	"database/sql"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Family verification: a parent is verified with their own NID and their
// child's birth certificate, asks for a student account by giving the child's
// email, and an administrator grants permission before the child can sign up
// (see auth.Service.Register). Parent and student are approved separately.

var (
	// ErrParentNotApproved blocks steps that need an approved parent.
	ErrParentNotApproved = errors.New("parent verification is not approved")
	// ErrEmailUnavailable means the child email belongs to an account or a live invitation.
	ErrEmailUnavailable = errors.New("email already used")
)

// InvitationTTL is how long a child may take to sign up once permission is granted.
const InvitationTTL = 30 * 24 * time.Hour

const maxInvitationsPerParent = 10

type Invitation struct {
	ID              string     `db:"id" json:"id"`
	ParentID        string     `db:"parent_id" json:"parent_id"`
	ChildEmail      string     `db:"child_email" json:"child_email"`
	ChildName       *string    `db:"child_name" json:"child_name"`
	Relationship    string     `db:"relationship" json:"relationship"`
	Status          string     `db:"status" json:"status"`
	RejectionReason *string    `db:"rejection_reason" json:"rejection_reason"`
	ReviewedAt      *time.Time `db:"reviewed_at" json:"reviewed_at"`
	ExpiresAt       *time.Time `db:"expires_at" json:"expires_at"`
	RegisteredAt    *time.Time `db:"registered_at" json:"registered_at"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	// The student account created from this invitation, once the child signs up.
	StudentID                 *string    `db:"student_id" json:"student_id"`
	StudentName               *string    `db:"student_name" json:"student_name"`
	StudentAccountStatus      *string    `db:"student_account_status" json:"student_account_status"`
	StudentVerificationID     *string    `db:"student_verification_id" json:"student_verification_id"`
	StudentVerificationStatus *string    `db:"student_verification_status" json:"student_verification_status"`
	StudentRejectionReason    *string    `db:"student_rejection_reason" json:"student_rejection_reason"`
	StudentCorrectionRequest  *string    `db:"student_correction_request" json:"student_correction_request"`
	StudentSubmittedAt        *time.Time `db:"student_submitted_at" json:"student_submitted_at"`
	LinkStatus                *string    `db:"link_status" json:"link_status"`
}

// AdminInvitation adds the parent's identity and verification state.
type AdminInvitation struct {
	Invitation
	ParentName               string  `db:"parent_name" json:"parent_name"`
	ParentEmail              string  `db:"parent_email" json:"parent_email"`
	ParentAccountStatus      string  `db:"parent_account_status" json:"parent_account_status"`
	ParentVerificationID     *string `db:"parent_verification_id" json:"parent_verification_id"`
	ParentVerificationStatus *string `db:"parent_verification_status" json:"parent_verification_status"`
}

// ParentLink is what a student and the reviewer see about the inviting parent.
type ParentLink struct {
	InvitationID             string     `db:"invitation_id" json:"invitation_id"`
	InvitedEmail             string     `db:"child_email" json:"invited_email"`
	Relationship             string     `db:"relationship" json:"relationship"`
	ParentID                 string     `db:"parent_id" json:"parent_id"`
	ParentName               string     `db:"parent_name" json:"parent_name"`
	ParentEmail              string     `db:"parent_email" json:"parent_email,omitempty"`
	ParentAccountStatus      string     `db:"parent_account_status" json:"parent_account_status"`
	ParentVerificationStatus *string    `db:"parent_verification_status" json:"parent_verification_status"`
	LinkStatus               *string    `db:"link_status" json:"link_status"`
	RegisteredAt             *time.Time `db:"registered_at" json:"registered_at"`
}

const invitationColumns = `i.id, i.parent_id, i.child_email, i.child_name, i.relationship,
	IF(i.status = 'approved' AND i.expires_at IS NOT NULL AND i.expires_at < UTC_TIMESTAMP(6), 'expired', i.status) AS status,
	i.rejection_reason, i.reviewed_at, i.expires_at, i.registered_at, i.created_at, i.student_id,
	st.name AS student_name, st.account_status AS student_account_status, sv.id AS student_verification_id, sv.status AS student_verification_status,
	sv.rejection_reason AS student_rejection_reason, sv.correction_request AS student_correction_request, sv.submitted_at AS student_submitted_at, l.status AS link_status`

const invitationJoins = ` FROM student_invitations i
	LEFT JOIN users st ON st.id = i.student_id
	LEFT JOIN verification_applications sv ON sv.user_id = i.student_id
	LEFT JOIN guardian_student_links l ON l.guardian_id = i.parent_id AND l.student_id = i.student_id`

const parentLinkQuery = `SELECT i.id AS invitation_id, i.child_email, i.relationship, i.registered_at, p.id AS parent_id, p.name AS parent_name, p.email AS parent_email,
	p.account_status AS parent_account_status, pv.status AS parent_verification_status, l.status AS link_status
	FROM student_invitations i JOIN users p ON p.id = i.parent_id
	LEFT JOIN verification_applications pv ON pv.user_id = p.id
	LEFT JOIN guardian_student_links l ON l.guardian_id = i.parent_id AND l.student_id = i.student_id
	WHERE i.student_id = ?`

// NormalizeEmail lower-cases and trims an email the same way registration does.
func NormalizeEmail(email string) string { return strings.ToLower(strings.TrimSpace(email)) }

func validEmail(email string) bool {
	if len(email) > 255 {
		return false
	}
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email && strings.Contains(email[strings.LastIndex(email, "@")+1:], ".")
}

// parentApproved reports whether the parent's own verification was approved
// and their account is in good standing.
func parentApproved(accountStatus string, verificationStatus sql.NullString) bool {
	return accountStatus == "active" && verificationStatus.String == "approved"
}

// missingFamilyProfile lists the profile details a parent or student must fill in.
func (s *Service) missingFamilyProfile(ctx context.Context, q sqlx.QueryerContext, role, userID string) ([]string, error) {
	var missing []string
	for _, r := range familyProfileRequirements[role] {
		var filled bool
		// The column comes from a fixed allowlist, never from input.
		if err := sqlx.GetContext(ctx, q, &filled, `SELECT COALESCE((SELECT `+r.Column+` IS NOT NULL AND TRIM(`+r.Column+`) <> '' FROM role_profiles WHERE user_id = ?), FALSE)`, userID); err != nil {
			return nil, err
		}
		if !filled {
			missing = append(missing, r.Label)
		}
	}
	return missing, nil
}

// applyFamilyDecision runs inside ReviewVerification's transaction and keeps
// invitations and guardian links consistent with the decision.
func (s *Service) applyFamilyDecision(ctx context.Context, tx *sqlx.Tx, reviewerID, role, userID, decision string) error {
	switch role {
	case "parent":
		if decision == "rejected" {
			// A rejected parent's child may not sign up: withdraw any permission not yet used.
			_, err := tx.ExecContext(ctx, `UPDATE student_invitations SET status = 'rejected', rejection_reason = 'Parent verification was rejected.', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(6) WHERE parent_id = ? AND status IN ('pending_approval', 'approved')`, reviewerID, userID)
			return err
		}
		return nil
	case "student":
		var link struct {
			ParentID           string         `db:"parent_id"`
			ParentStatus       string         `db:"parent_status"`
			ParentVerification sql.NullString `db:"parent_verification"`
		}
		err := tx.GetContext(ctx, &link, `SELECT i.parent_id, p.account_status AS parent_status, pv.status AS parent_verification FROM student_invitations i JOIN users p ON p.id = i.parent_id LEFT JOIN verification_applications pv ON pv.user_id = p.id WHERE i.student_id = ? AND i.status = 'registered' FOR UPDATE`, userID)
		if errors.Is(err, sql.ErrNoRows) {
			// Students who signed up before invitations existed have no inviting parent.
			if decision == "approved" {
				return ErrParentNotApproved
			}
			return nil
		}
		if err != nil {
			return err
		}
		if decision == "approved" && !parentApproved(link.ParentStatus, link.ParentVerification) {
			return ErrParentNotApproved
		}
		next := map[string]string{"approved": "approved", "rejected": "rejected"}[decision]
		if next == "" {
			return nil
		}
		if _, err = tx.ExecContext(ctx, `UPDATE guardian_student_links SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(6) WHERE guardian_id = ? AND student_id = ?`, next, reviewerID, link.ParentID, userID); err != nil {
			return err
		}
		title, body := "Child account approved", "An administrator approved your child's student account. You can now follow their progress."
		if decision == "rejected" {
			title, body = "Child account rejected", "An administrator rejected your child's student account. Your own verification is not affected."
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, ?, ?, ?)`, uuid.NewString(), link.ParentID, "child_verification_"+decision, title, body)
		return err
	}
	return nil
}

// familyContext is the related account information shown to the reviewer.
func (s *Service) familyContext(ctx context.Context, role, userID string) (any, error) {
	if role == "parent" {
		invitations := []Invitation{}
		err := s.db.SelectContext(ctx, &invitations, `SELECT `+invitationColumns+invitationJoins+` WHERE i.parent_id = ? ORDER BY i.created_at`, userID)
		return map[string]any{"invitations": invitations}, err
	}
	var parent ParentLink
	err := s.db.GetContext(ctx, &parent, parentLinkQuery, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return map[string]any{"parent": nil}, nil
	}
	return map[string]any{"parent": parent}, err
}

// Family returns what a parent or student may see about their own family link.
// A parent sees only their own invitations; a student only their own parent.
func (s *Service) Family(ctx context.Context, userID, role string) (map[string]any, error) {
	switch role {
	case "parent":
		invitations := []Invitation{}
		if err := s.db.SelectContext(ctx, &invitations, `SELECT `+invitationColumns+invitationJoins+` WHERE i.parent_id = ? AND i.status <> 'cancelled' ORDER BY i.created_at DESC`, userID); err != nil {
			return nil, err
		}
		return map[string]any{"invitations": invitations}, nil
	case "student":
		var parent ParentLink
		err := s.db.GetContext(ctx, &parent, parentLinkQuery, userID)
		if errors.Is(err, sql.ErrNoRows) {
			return map[string]any{"parent": nil}, nil
		}
		if err != nil {
			return nil, err
		}
		parent.ParentEmail = "" // the student needs the name, not the contact address
		return map[string]any{"parent": parent}, nil
	}
	return nil, ErrForbidden
}

// CreateInvitation records a parent's request for a student account for their
// child. The child signs up later with this exact email and their own password.
func (s *Service) CreateInvitation(ctx context.Context, parentID, childEmail, childName, relationship string) (Invitation, error) {
	childEmail = NormalizeEmail(childEmail)
	childName = strings.TrimSpace(childName)
	relationship = strings.TrimSpace(relationship)
	if !validEmail(childEmail) || relationship == "" || len(relationship) > 64 || len(childName) > 120 {
		return Invitation{}, ErrInvalidState
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Invitation{}, err
	}
	defer tx.Rollback()
	var parent struct {
		Role         string         `db:"role"`
		Email        string         `db:"email"`
		Status       string         `db:"account_status"`
		Verification sql.NullString `db:"verification"`
	}
	// Locking the parent row serialises this parent's invitations, so the cap holds.
	if err = tx.GetContext(ctx, &parent, `SELECT u.role, u.email, u.account_status, v.status AS verification FROM users u LEFT JOIN verification_applications v ON v.user_id = u.id WHERE u.id = ? FOR UPDATE`, parentID); err != nil {
		return Invitation{}, err
	}
	if parent.Role != "parent" {
		return Invitation{}, ErrForbidden
	}
	// The parent must have submitted their own verification first; a rejected
	// or suspended parent cannot ask for a child account.
	submitted := map[string]bool{"pending": true, "under_review": true, "approved": true}[parent.Verification.String]
	if !submitted || parent.Status == "rejected" || parent.Status == "suspended" {
		return Invitation{}, ErrParentNotApproved
	}
	if childEmail == parent.Email {
		return Invitation{}, ErrEmailUnavailable
	}
	var count int
	if err = tx.GetContext(ctx, &count, `SELECT COUNT(*) FROM student_invitations WHERE parent_id = ? AND status IN ('pending_approval', 'approved', 'registered')`, parentID); err != nil {
		return Invitation{}, err
	}
	if count >= maxInvitationsPerParent {
		return Invitation{}, ErrConflict
	}
	var taken int
	if err = tx.GetContext(ctx, &taken, `SELECT COUNT(*) FROM users WHERE email = ?`, childEmail); err != nil {
		return Invitation{}, err
	}
	if taken > 0 {
		return Invitation{}, ErrEmailUnavailable
	}
	var existing struct {
		ID       string     `db:"id"`
		ParentID string     `db:"parent_id"`
		Status   string     `db:"status"`
		Expires  *time.Time `db:"expires_at"`
	}
	err = tx.GetContext(ctx, &existing, `SELECT id, parent_id, status, expires_at FROM student_invitations WHERE child_email = ? FOR UPDATE`, childEmail)
	var id string
	switch {
	case errors.Is(err, sql.ErrNoRows):
		id = uuid.NewString()
		_, err = tx.ExecContext(ctx, `INSERT INTO student_invitations (id, parent_id, child_email, child_name, relationship) VALUES (?, ?, ?, ?, ?)`, id, parentID, childEmail, nullIfEmpty(childName), relationship)
	case err != nil:
		return Invitation{}, err
	default:
		expired := existing.Status == "approved" && existing.Expires != nil && existing.Expires.Before(time.Now())
		reusable := existing.Status == "rejected" || existing.Status == "cancelled" || (expired && existing.ParentID == parentID)
		if !reusable {
			return Invitation{}, ErrEmailUnavailable
		}
		// One row per email: an ended invitation is reset for the new request.
		id = existing.ID
		_, err = tx.ExecContext(ctx, `UPDATE student_invitations SET parent_id = ?, child_name = ?, relationship = ?, status = 'pending_approval', student_id = NULL, reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL, expires_at = NULL, registered_at = NULL, created_at = UTC_TIMESTAMP(6) WHERE id = ?`, parentID, nullIfEmpty(childName), relationship, id)
	}
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return Invitation{}, ErrEmailUnavailable
		}
		return Invitation{}, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, 'student_invitation_requested', JSON_OBJECT('invitation_id', ?, 'child_email', ?))`, uuid.NewString(), parentID, parentID, id, childEmail); err != nil {
		return Invitation{}, err
	}
	if err = tx.Commit(); err != nil {
		return Invitation{}, err
	}
	var out Invitation
	err = s.db.GetContext(ctx, &out, `SELECT `+invitationColumns+invitationJoins+` WHERE i.id = ?`, id)
	return out, err
}

// CancelInvitation lets a parent withdraw a request their child has not used yet.
func (s *Service) CancelInvitation(ctx context.Context, parentID, invitationID string) error {
	var owner, status string
	err := s.db.QueryRowxContext(ctx, `SELECT parent_id, status FROM student_invitations WHERE id = ?`, invitationID).Scan(&owner, &status)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && owner != parentID) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if status != "pending_approval" && status != "approved" {
		return ErrConflict
	}
	res, err := s.db.ExecContext(ctx, `UPDATE student_invitations SET status = 'cancelled' WHERE id = ? AND parent_id = ? AND status IN ('pending_approval', 'approved')`, invitationID, parentID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrConflict
	}
	s.Audit(ctx, parentID, parentID, "student_invitation_cancelled", map[string]any{"invitation_id": invitationID})
	return nil
}

// ListInvitations is the administrator's queue of student registration requests.
func (s *Service) ListInvitations(ctx context.Context, status string) ([]AdminInvitation, error) {
	rows := []AdminInvitation{}
	query := `SELECT ` + invitationColumns + `, p.name AS parent_name, p.email AS parent_email, p.account_status AS parent_account_status, pv.id AS parent_verification_id, pv.status AS parent_verification_status` +
		invitationJoins + ` JOIN users p ON p.id = i.parent_id LEFT JOIN verification_applications pv ON pv.user_id = p.id`
	args := []any{}
	switch status {
	case "":
		query += ` WHERE i.status <> 'cancelled'`
	case "expired":
		query += ` WHERE i.status = 'approved' AND i.expires_at < UTC_TIMESTAMP(6)`
	case "approved":
		query += ` WHERE i.status = 'approved' AND (i.expires_at IS NULL OR i.expires_at >= UTC_TIMESTAMP(6))`
	default:
		query += ` WHERE i.status = ?`
		args = append(args, status)
	}
	query += ` ORDER BY i.created_at ASC`
	return rows, s.db.SelectContext(ctx, &rows, query, args...)
}

// ReviewInvitation grants or refuses permission for the child to register.
// Permission can only be granted to an approved parent.
func (s *Service) ReviewInvitation(ctx context.Context, reviewerID, invitationID, decision, reason string) error {
	if decision != "approved" && decision != "rejected" {
		return ErrInvalidState
	}
	if decision == "rejected" && len(strings.TrimSpace(reason)) < 10 {
		return ErrInvalidState
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var inv struct {
		ParentID           string         `db:"parent_id"`
		Status             string         `db:"status"`
		ChildEmail         string         `db:"child_email"`
		Expires            *time.Time     `db:"expires_at"`
		ParentStatus       string         `db:"parent_status"`
		ParentVerification sql.NullString `db:"parent_verification"`
	}
	err = tx.GetContext(ctx, &inv, `SELECT i.parent_id, i.status, i.child_email, i.expires_at, p.account_status AS parent_status, pv.status AS parent_verification FROM student_invitations i JOIN users p ON p.id = i.parent_id LEFT JOIN verification_applications pv ON pv.user_id = p.id WHERE i.id = ? FOR UPDATE`, invitationID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	expired := inv.Status == "approved" && inv.Expires != nil && inv.Expires.Before(time.Now())
	switch {
	case decision == "approved" && inv.Status != "pending_approval" && !expired:
		return ErrConflict
	case decision == "rejected" && inv.Status != "pending_approval" && inv.Status != "approved":
		return ErrConflict
	case decision == "approved" && !parentApproved(inv.ParentStatus, inv.ParentVerification):
		return ErrParentNotApproved
	}
	if decision == "approved" {
		_, err = tx.ExecContext(ctx, `UPDATE student_invitations SET status = 'approved', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(6), rejection_reason = NULL, expires_at = ? WHERE id = ?`, reviewerID, time.Now().UTC().Add(InvitationTTL), invitationID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE student_invitations SET status = 'rejected', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(6), rejection_reason = ? WHERE id = ?`, reviewerID, strings.TrimSpace(reason), invitationID)
	}
	if err != nil {
		return err
	}
	title, body := "Student sign-up allowed", "An administrator allowed "+inv.ChildEmail+" to create a student account. Ask your child to sign up as a Student with that exact email and their own password."
	if decision == "rejected" {
		title, body = "Student sign-up refused", "An administrator refused the student account request for "+inv.ChildEmail+". See the reason on your verification page."
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, ?, ?, ?)`, uuid.NewString(), inv.ParentID, "student_invitation_"+decision, title, body); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('invitation_id', ?, 'child_email', ?, 'reason', ?))`, uuid.NewString(), reviewerID, inv.ParentID, "student_invitation_"+decision, invitationID, inv.ChildEmail, reason); err != nil {
		return err
	}
	return tx.Commit()
}

package workflow

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Audit records an action. Failures are logged rather than returned: the
// action itself already happened, and losing it from the response would be worse.
func (s *Service) Audit(ctx context.Context, actorID, subjectID, action string, metadata map[string]any) {
	data, _ := json.Marshal(metadata)
	if _, err := s.db.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, ?, ?)`, uuid.NewString(), nullIfEmpty(actorID), nullIfEmpty(subjectID), action, data); err != nil {
		slog.Error("audit log write failed", "action", action, "error", err)
	}
}

type Stats struct {
	UsersByRole        map[string]int `json:"users_by_role"`
	UsersByStatus      map[string]int `json:"users_by_status"`
	ApplicationsByStat map[string]int `json:"applications_by_status"`
	OldestPendingAt    *time.Time     `json:"oldest_pending_at"`
	SignupsLast7Days   int            `json:"signups_last_7_days"`
	DecisionsLast7Days int            `json:"decisions_last_7_days"`
}

func (s *Service) Stats(ctx context.Context) (Stats, error) {
	out := Stats{UsersByRole: map[string]int{}, UsersByStatus: map[string]int{}, ApplicationsByStat: map[string]int{}}
	type kv struct {
		K string `db:"k"`
		N int    `db:"n"`
	}
	for query, target := range map[string]map[string]int{
		`SELECT role AS k, COUNT(*) AS n FROM users GROUP BY role`:                                           out.UsersByRole,
		`SELECT account_status AS k, COUNT(*) AS n FROM users WHERE role <> 'admin' GROUP BY account_status`: out.UsersByStatus,
		`SELECT status AS k, COUNT(*) AS n FROM verification_applications GROUP BY status`:                   out.ApplicationsByStat,
	} {
		var rows []kv
		if err := s.db.SelectContext(ctx, &rows, query); err != nil {
			return out, err
		}
		for _, r := range rows {
			target[r.K] = r.N
		}
	}
	if err := s.db.GetContext(ctx, &out.OldestPendingAt, `SELECT MIN(submitted_at) FROM verification_applications WHERE status IN ('pending', 'under_review')`); err != nil {
		return out, err
	}
	if err := s.db.GetContext(ctx, &out.SignupsLast7Days, `SELECT COUNT(*) FROM users WHERE role <> 'admin' AND created_at >= UTC_TIMESTAMP(6) - INTERVAL 7 DAY`); err != nil {
		return out, err
	}
	err := s.db.GetContext(ctx, &out.DecisionsLast7Days, `SELECT COUNT(*) FROM verification_applications WHERE reviewed_at >= UTC_TIMESTAMP(6) - INTERVAL 7 DAY`)
	return out, err
}

type AdminUser struct {
	ID                 string     `db:"id" json:"id"`
	Name               string     `db:"name" json:"name"`
	Email              string     `db:"email" json:"email"`
	Phone              *string    `db:"phone" json:"phone"`
	Role               string     `db:"role" json:"role"`
	AccountStatus      string     `db:"account_status" json:"account_status"`
	EmailVerifiedAt    *time.Time `db:"email_verified_at" json:"email_verified_at"`
	CreatedAt          time.Time  `db:"created_at" json:"created_at"`
	VerificationStatus *string    `db:"verification_status" json:"verification_status"`
}

type UserFilter struct {
	Role, Status, Query string
	Limit, Offset       int
}

func (s *Service) ListUsers(ctx context.Context, f UserFilter) ([]AdminUser, int, error) {
	where := []string{"1 = 1"}
	args := []any{}
	if f.Role != "" {
		where = append(where, "u.role = ?")
		args = append(args, f.Role)
	}
	if f.Status != "" {
		where = append(where, "u.account_status = ?")
		args = append(args, f.Status)
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		// LIKE wildcards in user input are escaped so a search for "%" matches a literal percent.
		like := "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(q) + "%"
		where = append(where, "(u.name LIKE ? OR u.email LIKE ?)")
		args = append(args, like, like)
	}
	cond := strings.Join(where, " AND ")
	var total int
	if err := s.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM users u WHERE `+cond, args...); err != nil {
		return nil, 0, err
	}
	if f.Limit <= 0 || f.Limit > 100 {
		f.Limit = 25
	}
	if f.Offset < 0 {
		f.Offset = 0
	}
	users := []AdminUser{}
	err := s.db.SelectContext(ctx, &users, `SELECT u.id, u.name, u.email, u.phone, u.role, u.account_status, u.email_verified_at, u.created_at, v.status AS verification_status FROM users u LEFT JOIN verification_applications v ON v.user_id = u.id WHERE `+cond+` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`, append(args, f.Limit, f.Offset)...)
	return users, total, err
}

// SetSuspended suspends or reactivates a non-admin account. Suspension ends all
// sessions; reactivation restores the status the account had before.
func (s *Service) SetSuspended(ctx context.Context, adminID, targetID string, suspend bool, reason string) error {
	if adminID == targetID {
		return ErrForbidden
	}
	if suspend && len(strings.TrimSpace(reason)) < 10 {
		return ErrInvalidState
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var target struct {
		Role   string `db:"role"`
		Status string `db:"account_status"`
	}
	if err = tx.GetContext(ctx, &target, `SELECT role, account_status FROM users WHERE id = ? FOR UPDATE`, targetID); errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	} else if err != nil {
		return err
	}
	if target.Role == "admin" {
		return ErrForbidden
	}
	if suspend == (target.Status == "suspended") {
		return ErrConflict
	}
	next := "suspended"
	action := "user_suspended"
	if suspend {
		if _, err = tx.ExecContext(ctx, `UPDATE users SET account_status = 'suspended', suspended_at = UTC_TIMESTAMP(6) WHERE id = ?`, targetID); err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL`, targetID); err != nil {
			return err
		}
	} else {
		action = "user_reactivated"
		next = "pending"
		var meta sql.NullString
		err = tx.GetContext(ctx, &meta, `SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.previous_status')) FROM audit_logs WHERE subject_user_id = ? AND action = 'user_suspended' ORDER BY created_at DESC LIMIT 1`, targetID)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		if meta.Valid && meta.String != "" && meta.String != "suspended" {
			next = meta.String
		} else if !verifiableRole(target.Role) {
			next = "active"
		}
		if _, err = tx.ExecContext(ctx, `UPDATE users SET account_status = ?, suspended_at = NULL WHERE id = ?`, next, targetID); err != nil {
			return err
		}
	}
	metadata, _ := json.Marshal(map[string]any{"previous_status": target.Status, "next_status": next, "reason": reason})
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, ?, ?)`, uuid.NewString(), adminID, targetID, action, metadata); err != nil {
		return err
	}
	title, body := "Account reactivated", "Your account has been reactivated by an administrator."
	if suspend {
		title, body = "Account suspended", "Your account was suspended by an administrator. Reason: "+reason
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, ?, ?, ?)`, uuid.NewString(), targetID, action, title, body); err != nil {
		return err
	}
	return tx.Commit()
}

type AuditEntry struct {
	ID          string          `db:"id" json:"id"`
	Action      string          `db:"action" json:"action"`
	Metadata    json.RawMessage `db:"metadata" json:"metadata"`
	CreatedAt   time.Time       `db:"created_at" json:"created_at"`
	ActorID     *string         `db:"actor_id" json:"actor_id"`
	ActorName   *string         `db:"actor_name" json:"actor_name"`
	ActorRole   *string         `db:"actor_role" json:"actor_role"`
	SubjectID   *string         `db:"subject_user_id" json:"subject_id"`
	SubjectName *string         `db:"subject_name" json:"subject_name"`
}

const auditSelect = `SELECT a.id, a.action, COALESCE(a.metadata, JSON_OBJECT()) AS metadata, a.created_at, a.actor_id, actor.name AS actor_name, actor.role AS actor_role, a.subject_user_id, subject.name AS subject_name FROM audit_logs a LEFT JOIN users actor ON actor.id = a.actor_id LEFT JOIN users subject ON subject.id = a.subject_user_id`

func (s *Service) AuditLog(ctx context.Context, action string, limit, offset int) ([]AuditEntry, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}
	query, args := auditSelect, []any{}
	if action != "" {
		query += ` WHERE a.action = ?`
		args = append(args, action)
	}
	entries := []AuditEntry{}
	err := s.db.SelectContext(ctx, &entries, query+` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, append(args, limit, offset)...)
	return entries, err
}

// ApplicationHistory returns the verification-related audit trail for one
// application's applicant, oldest first.
func (s *Service) ApplicationHistory(ctx context.Context, applicationID string) ([]AuditEntry, error) {
	var userID string
	if err := s.db.GetContext(ctx, &userID, `SELECT user_id FROM verification_applications WHERE id = ?`, applicationID); errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, err
	}
	entries := []AuditEntry{}
	err := s.db.SelectContext(ctx, &entries, auditSelect+` WHERE a.subject_user_id = ? AND (a.action LIKE 'verification\_%' OR a.action LIKE 'interview\_%' OR a.action IN ('document_uploaded', 'document_viewed', 'user_suspended', 'user_reactivated')) ORDER BY a.created_at ASC`, userID)
	return entries, err
}

// MarkNotificationsRead marks the caller's notifications read: one by id, or all.
func (s *Service) MarkNotificationsRead(ctx context.Context, userID, notificationID string) error {
	if notificationID == "" {
		_, err := s.db.ExecContext(ctx, `UPDATE notifications SET read_at = UTC_TIMESTAMP(6) WHERE user_id = ? AND read_at IS NULL`, userID)
		return err
	}
	result, err := s.db.ExecContext(ctx, `UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP(6)) WHERE id = ? AND user_id = ?`, notificationID, userID)
	if err != nil {
		return err
	}
	if n, _ := result.RowsAffected(); n == 0 {
		var exists bool
		if err := s.db.GetContext(ctx, &exists, `SELECT EXISTS(SELECT 1 FROM notifications WHERE id = ? AND user_id = ?)`, notificationID, userID); err != nil {
			return err
		}
		if !exists {
			return ErrNotFound
		}
	}
	return nil
}

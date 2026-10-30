package platform

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// ---------- support tickets (users) ----------

type Ticket struct {
	ID           string    `db:"id" json:"id"`
	ReporterID   *string   `db:"reporter_id" json:"reporter_id"`
	ReporterName *string   `db:"reporter_name" json:"reporter_name"`
	SubjectID    *string   `db:"subject_user_id" json:"subject_user_id"`
	SubjectName  *string   `db:"subject_name" json:"subject_name"`
	ListingID    *string   `db:"listing_id" json:"listing_id"`
	Category     string    `db:"category" json:"category"`
	Title        string    `db:"title" json:"title"`
	Body         string    `db:"body" json:"body"`
	Status       string    `db:"status" json:"status"`
	AssigneeName *string   `db:"assignee_name" json:"assignee_name"`
	Resolution   *string   `db:"resolution" json:"resolution"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	UpdatedAt    time.Time `db:"updated_at" json:"updated_at"`
}

const ticketSelect = `SELECT t.id, t.reporter_id, r.name AS reporter_name, t.subject_user_id, su.name AS subject_name, t.listing_id, t.category, t.title, t.body, t.status, a.name AS assignee_name, t.resolution, t.created_at, t.updated_at
	FROM support_tickets t LEFT JOIN users r ON r.id = t.reporter_id LEFT JOIN users su ON su.id = t.subject_user_id LEFT JOIN users a ON a.id = t.assignee_id`

type ticketInput struct {
	Category      string `json:"category" validate:"required,oneof=support complaint report_user report_post safety payment appeal"`
	Title         string `json:"title" validate:"required,max=200"`
	Body          string `json:"body" validate:"required,min=10,max=5000"`
	SubjectUserID string `json:"subject_user_id" validate:"omitempty,uuid"`
	ListingID     string `json:"listing_id" validate:"omitempty,uuid"`
}

func (s *Service) CreateTicket(ctx context.Context, reporterID string, in ticketInput) (string, error) {
	id := newID()
	_, err := s.db.ExecContext(ctx, `INSERT INTO support_tickets (id, reporter_id, subject_user_id, listing_id, category, title, body) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, reporterID, nullable(in.SubjectUserID), nullable(in.ListingID), in.Category, strings.TrimSpace(in.Title), strings.TrimSpace(in.Body))
	return id, err
}

func (s *Service) MyTickets(ctx context.Context, userID string) ([]Ticket, error) {
	out := []Ticket{}
	err := s.db.SelectContext(ctx, &out, ticketSelect+` WHERE t.reporter_id = ? ORDER BY t.created_at DESC`, userID)
	return out, err
}

// ---------- admin ----------

func (s *Service) AdminTickets(ctx context.Context, status, category string, limit, offset int) ([]Ticket, error) {
	where, args := []string{"1 = 1"}, []any{}
	if status != "" {
		where, args = append(where, "t.status = ?"), append(args, status)
	}
	if category != "" {
		where, args = append(where, "t.category = ?"), append(args, category)
	}
	out := []Ticket{}
	err := s.db.SelectContext(ctx, &out, ticketSelect+` WHERE `+strings.Join(where, " AND ")+` ORDER BY FIELD(t.status, 'open', 'in_progress', 'resolved', 'closed'), t.created_at DESC LIMIT ? OFFSET ?`, append(args, limit, offset)...)
	return out, err
}

func (s *Service) UpdateTicket(ctx context.Context, adminID, id, status, resolution string) error {
	if status != "open" && status != "in_progress" && status != "resolved" && status != "closed" {
		return badRequest("invalid status")
	}
	if (status == "resolved" || status == "closed") && len(strings.TrimSpace(resolution)) < 5 {
		return badRequest("describe the resolution")
	}
	var reporter sql.NullString
	if err := s.db.GetContext(ctx, &reporter, `SELECT reporter_id FROM support_tickets WHERE id = ?`, id); errors.Is(err, sql.ErrNoRows) {
		return notFound("ticket not found")
	} else if err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE support_tickets SET status = ?, resolution = COALESCE(?, resolution), assignee_id = ? WHERE id = ?`, status, nullable(resolution), adminID, id); err != nil {
		return err
	}
	if reporter.Valid {
		s.notify(ctx, reporter.String, "ticket_"+status, "Support request "+strings.ReplaceAll(status, "_", " "), strings.TrimSpace("Your request was updated. "+resolution))
	}
	s.audit(ctx, adminID, reporter.String, "ticket_"+status, map[string]any{"ticket_id": id})
	return nil
}

func (s *Service) AdminListings(ctx context.Context, status, q string, limit, offset int) ([]Listing, int, error) {
	where, args := []string{"1 = 1"}, []any{}
	if status != "" {
		where, args = append(where, "l.status = ?"), append(args, status)
	}
	if strings.TrimSpace(q) != "" {
		where, args = append(where, "(l.subject LIKE ? OR l.area LIKE ? OR o.name LIKE ?)"), append(args, likePattern(q), likePattern(q), likePattern(q))
	}
	cond := ` WHERE ` + strings.Join(where, " AND ")
	var total int
	if err := s.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM tuition_listings l JOIN users o ON o.id = l.owner_id`+cond, args...); err != nil {
		return nil, 0, err
	}
	out := []Listing{}
	err := s.db.SelectContext(ctx, &out, listingSelect+cond+` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, append(append([]any{"", ""}, args...), limit, offset)...)
	return out, total, err
}

// Settings an administrator may change, with their defaults.
var settingDefaults = map[string]any{
	"registrations_open":        true,
	"tutor_applications_open":   true,
	"max_applications_per_day":  20,
	"support_email":             "",
	"maintenance_banner":        "",
	"review_min_tuition_status": "active",
}

func (s *Service) Settings(ctx context.Context) (map[string]any, error) {
	out := map[string]any{}
	for k, v := range settingDefaults {
		out[k] = v
	}
	rows := []struct {
		Key   string          `db:"setting_key"`
		Value json.RawMessage `db:"setting_value"`
	}{}
	if err := s.db.SelectContext(ctx, &rows, `SELECT setting_key, setting_value FROM platform_settings`); err != nil {
		return nil, err
	}
	for _, r := range rows {
		var v any
		if json.Unmarshal(r.Value, &v) == nil {
			out[r.Key] = v
		}
	}
	return out, nil
}

func (s *Service) SaveSettings(ctx context.Context, adminID string, in map[string]any) error {
	for k, v := range in {
		def, ok := settingDefaults[k]
		if !ok {
			return badRequest("unknown setting: " + k)
		}
		// Keep each setting's type stable (bool stays bool, number stays number, text stays text).
		switch def.(type) {
		case bool:
			if _, ok := v.(bool); !ok {
				return badRequest(k + " must be true or false")
			}
		case int:
			if f, ok := v.(float64); !ok || f < 0 || f > 10000 {
				return badRequest(k + " must be a number from 0 to 10000")
			}
		case string:
			if str, ok := v.(string); !ok || len(str) > 500 {
				return badRequest(k + " must be text up to 500 characters")
			}
		}
		data, _ := json.Marshal(v)
		if _, err := s.db.ExecContext(ctx, `INSERT INTO platform_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)`, k, data, adminID); err != nil {
			return err
		}
	}
	s.audit(ctx, adminID, "", "settings_updated", in)
	return nil
}

// SettingBool reads a boolean platform setting, falling back to its default.
func (s *Service) SettingBool(ctx context.Context, key string) bool {
	var raw json.RawMessage
	if err := s.db.GetContext(ctx, &raw, `SELECT setting_value FROM platform_settings WHERE setting_key = ?`, key); err == nil {
		var v bool
		if json.Unmarshal(raw, &v) == nil {
			return v
		}
	}
	b, _ := settingDefaults[key].(bool)
	return b
}

func (s *Service) Broadcast(ctx context.Context, adminID, targetRole, title, body string) (int64, error) {
	if strings.TrimSpace(title) == "" || strings.TrimSpace(body) == "" || len(title) > 180 {
		return 0, badRequest("title (up to 180 characters) and message are required")
	}
	query := `INSERT INTO notifications (id, user_id, kind, title, body) SELECT UUID(), id, 'announcement', ?, ? FROM users WHERE role <> 'admin' AND account_status <> 'suspended'`
	args := []any{strings.TrimSpace(title), strings.TrimSpace(body)}
	if targetRole != "" {
		if targetRole != "tutor" && targetRole != "coaching" && targetRole != "parent" && targetRole != "student" {
			return 0, badRequest("invalid role")
		}
		query += ` AND role = ?`
		args = append(args, targetRole)
	}
	r, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return 0, err
	}
	n, _ := r.RowsAffected()
	s.audit(ctx, adminID, "", "announcement_sent", map[string]any{"role": targetRole, "title": title, "recipients": n})
	return n, nil
}

func (s *Service) GrantAward(ctx context.Context, adminID, userID, title, description string) error {
	if strings.TrimSpace(title) == "" || len(title) > 160 {
		return badRequest("award title is required")
	}
	var r string
	if err := s.db.GetContext(ctx, &r, `SELECT role FROM users WHERE id = ?`, userID); errors.Is(err, sql.ErrNoRows) {
		return notFound("user not found")
	} else if err != nil {
		return err
	}
	if r != "tutor" && r != "coaching" {
		return badRequest("awards are for tutors and coaching centres")
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO awards (id, user_id, title, description, awarded_by) VALUES (?, ?, ?, ?, ?)`, newID(), userID, strings.TrimSpace(title), nullable(description), adminID); err != nil {
		return err
	}
	s.notify(ctx, userID, "award_granted", "You received an award", title)
	s.audit(ctx, adminID, userID, "award_granted", map[string]any{"title": title})
	return nil
}

type Award struct {
	ID          string    `db:"id" json:"id"`
	Title       string    `db:"title" json:"title"`
	Description *string   `db:"description" json:"description"`
	AwardedAt   time.Time `db:"awarded_at" json:"awarded_at"`
}

func (s *Service) Awards(ctx context.Context, userID string) ([]Award, error) {
	out := []Award{}
	err := s.db.SelectContext(ctx, &out, `SELECT id, title, description, awarded_at FROM awards WHERE user_id = ? ORDER BY awarded_at DESC`, userID)
	return out, err
}

// UserActivity summarises one account for the admin user-detail view.
func (s *Service) UserActivity(ctx context.Context, userID string) (map[string]any, error) {
	var u struct {
		ID     string    `db:"id"`
		Name   string    `db:"name"`
		Email  string    `db:"email"`
		Phone  *string   `db:"phone"`
		Role   string    `db:"role"`
		Status string    `db:"account_status"`
		Joined time.Time `db:"created_at"`
	}
	if err := s.db.GetContext(ctx, &u, `SELECT id, name, email, phone, role, account_status, created_at FROM users WHERE id = ?`, userID); errors.Is(err, sql.ErrNoRows) {
		return nil, notFound("user not found")
	} else if err != nil {
		return nil, err
	}
	var counts struct {
		Posts        int `db:"posts" json:"posts"`
		Applications int `db:"applications" json:"applications"`
		Tuitions     int `db:"tuitions" json:"tuitions"`
		Messages     int `db:"messages" json:"messages"`
		Reviews      int `db:"reviews" json:"reviews"`
		Reports      int `db:"reports" json:"reports"`
		Classrooms   int `db:"classrooms" json:"classrooms"`
	}
	err := s.db.GetContext(ctx, &counts, `SELECT
		(SELECT COUNT(*) FROM tuition_listings WHERE owner_id = ?) AS posts,
		(SELECT COUNT(*) FROM tuition_applications WHERE tutor_id = ?) AS applications,
		(SELECT COUNT(*) FROM engagements WHERE tutor_id = ? OR guardian_id = ? OR student_id = ?) AS tuitions,
		(SELECT COUNT(*) FROM messages WHERE sender_id = ?) AS messages,
		(SELECT COUNT(*) FROM reviews WHERE subject_id = ?) AS reviews,
		(SELECT COUNT(*) FROM support_tickets WHERE subject_user_id = ?) AS reports,
		(SELECT COUNT(*) FROM classrooms WHERE owner_id = ?) AS classrooms`, userID, userID, userID, userID, userID, userID, userID, userID, userID)
	if err != nil {
		return nil, err
	}
	var profile map[string]any
	var raw json.RawMessage
	if err := s.db.GetContext(ctx, &raw, `SELECT JSON_OBJECT('display_name', display_name, 'institution', institution, 'education', education, 'subjects', subjects, 'classes', classes, 'areas', areas, 'fee_expectation', fee_expectation, 'experience_years', experience_years, 'bio', bio, 'completion_percent', completion_percent) FROM role_profiles WHERE user_id = ?`, userID); err == nil {
		_ = json.Unmarshal(raw, &profile)
	}
	return map[string]any{"user": map[string]any{"id": u.ID, "name": u.Name, "email": u.Email, "phone": u.Phone, "role": u.Role, "account_status": u.Status, "created_at": u.Joined},
		"profile": profile, "activity": counts}, nil
}

// PlatformReport returns activity counts for a period, all from the database.
func (s *Service) PlatformReport(ctx context.Context, from, to time.Time) (map[string]any, error) {
	type kv struct {
		K string `db:"k"`
		N int    `db:"n"`
	}
	period := map[string]string{
		"signups":              `SELECT role AS k, COUNT(*) AS n FROM users WHERE created_at BETWEEN ? AND ? AND role <> 'admin' GROUP BY role`,
		"tuition_posts":        `SELECT status AS k, COUNT(*) AS n FROM tuition_listings WHERE created_at BETWEEN ? AND ? GROUP BY status`,
		"applications":         `SELECT status AS k, COUNT(*) AS n FROM tuition_applications WHERE created_at BETWEEN ? AND ? GROUP BY status`,
		"tuitions":             `SELECT status AS k, COUNT(*) AS n FROM engagements WHERE created_at BETWEEN ? AND ? GROUP BY status`,
		"verification_decided": `SELECT status AS k, COUNT(*) AS n FROM verification_applications WHERE reviewed_at BETWEEN ? AND ? GROUP BY status`,
		"tickets":              `SELECT category AS k, COUNT(*) AS n FROM support_tickets WHERE created_at BETWEEN ? AND ? GROUP BY category`,
	}
	out := map[string]any{"from": from, "to": to}
	for name, q := range period {
		rows := []kv{}
		if err := s.db.SelectContext(ctx, &rows, q, from, to); err != nil {
			return nil, err
		}
		m := map[string]int{}
		for _, r := range rows {
			m[r.K] = r.N
		}
		out[name] = m
	}
	var messages, sessions int
	if err := s.db.GetContext(ctx, &messages, `SELECT COUNT(*) FROM messages WHERE created_at BETWEEN ? AND ?`, from, to); err != nil {
		return nil, err
	}
	if err := s.db.GetContext(ctx, &sessions, `SELECT COUNT(*) FROM class_sessions WHERE status = 'held' AND starts_at BETWEEN ? AND ?`, from, to); err != nil {
		return nil, err
	}
	out["messages"], out["classes_held"] = messages, sessions
	return out, nil
}

// Suspicious lists accounts with repeated failed logins or several reports
// against them in the last week, for an administrator to look at.
func (s *Service) Suspicious(ctx context.Context) ([]map[string]any, error) {
	rows, err := s.db.QueryxContext(ctx, `SELECT u.id, u.name, u.email, u.role, u.account_status,
		(SELECT COUNT(*) FROM audit_logs a WHERE a.subject_user_id = u.id AND a.action = 'login_failed' AND a.created_at > UTC_TIMESTAMP(6) - INTERVAL 7 DAY) AS failed_logins,
		(SELECT COUNT(*) FROM support_tickets t WHERE t.subject_user_id = u.id AND t.created_at > UTC_TIMESTAMP(6) - INTERVAL 30 DAY) AS reports
		FROM users u WHERE u.role <> 'admin'
		HAVING failed_logins >= 5 OR reports >= 2 ORDER BY reports DESC, failed_logins DESC LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		m := map[string]any{}
		if err := rows.MapScan(m); err != nil {
			return nil, err
		}
		for k, v := range m {
			if b, ok := v.([]byte); ok {
				m[k] = string(b)
			}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

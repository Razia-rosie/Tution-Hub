package platform

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

// ---------- guardian ↔ student links ----------

// guardianOf reports whether guardianID has an approved link to studentID.
func (s *Service) guardianOf(ctx context.Context, guardianID, studentID string) bool {
	var n int
	_ = s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM guardian_student_links WHERE guardian_id = ? AND student_id = ? AND status = 'approved'`, guardianID, studentID)
	return n > 0
}

type Link struct {
	ID           string    `db:"id" json:"id"`
	GuardianID   string    `db:"guardian_id" json:"guardian_id"`
	GuardianName string    `db:"guardian_name" json:"guardian_name"`
	StudentID    string    `db:"student_id" json:"student_id"`
	StudentName  string    `db:"student_name" json:"student_name"`
	StudentClass *string   `db:"class_name" json:"class_name"`
	School       *string   `db:"institution" json:"institution"`
	Relationship string    `db:"relationship" json:"relationship"`
	Status       string    `db:"status" json:"status"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
}

func (s *Service) Links(ctx context.Context, userID string) ([]Link, error) {
	out := []Link{}
	err := s.db.SelectContext(ctx, &out, `SELECT l.id, l.guardian_id, g.name AS guardian_name, l.student_id, st.name AS student_name, p.class_name, p.institution, l.relationship, l.status, l.created_at
		FROM guardian_student_links l JOIN users g ON g.id = l.guardian_id JOIN users st ON st.id = l.student_id LEFT JOIN role_profiles p ON p.user_id = st.id
		WHERE (l.guardian_id = ? OR l.student_id = ?) AND l.status <> 'revoked' ORDER BY l.created_at DESC`, userID, userID)
	return out, err
}

// RequestLink asks a student (found by their account email) to confirm a guardian.
// The student must approve, so nobody can attach themselves to a child's data.
func (s *Service) RequestLink(ctx context.Context, guardianID, studentEmail, relationship string) error {
	var student struct {
		ID   string `db:"id"`
		Role string `db:"role"`
	}
	err := s.db.GetContext(ctx, &student, `SELECT id, role FROM users WHERE email = ?`, strings.ToLower(strings.TrimSpace(studentEmail)))
	// Same answer for "no such account" and "not a student" so emails cannot be probed.
	if errors.Is(err, sql.ErrNoRows) || (err == nil && student.Role != "student") {
		return notFound("no student account uses that email; ask the student to sign up first")
	}
	if err != nil {
		return err
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO guardian_student_links (id, guardian_id, student_id, relationship) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE relationship = VALUES(relationship), status = IF(status = 'approved', 'approved', 'pending'), reviewed_by = NULL, reviewed_at = NULL`, newID(), guardianID, student.ID, relationship); err != nil {
		return err
	}
	s.notify(ctx, student.ID, "guardian_link_request", "Guardian link request", s.userName(ctx, guardianID)+" asked to be linked as your "+relationship+". Approve it from your profile.")
	return nil
}

func (s *Service) RespondLink(ctx context.Context, actorID, linkID string, accept bool) error {
	var l struct{ GuardianID, StudentID, Status string }
	if err := s.db.QueryRowxContext(ctx, `SELECT guardian_id, student_id, status FROM guardian_student_links WHERE id = ?`, linkID).Scan(&l.GuardianID, &l.StudentID, &l.Status); errors.Is(err, sql.ErrNoRows) {
		return notFound("link not found")
	} else if err != nil {
		return err
	}
	// A link created when a child registered from a parent's invitation is
	// decided by the administrator's review of the student, not by the student.
	var invited int
	if err := s.db.GetContext(ctx, &invited, `SELECT COUNT(*) FROM student_invitations WHERE parent_id = ? AND student_id = ? AND status = 'registered'`, l.GuardianID, l.StudentID); err != nil {
		return err
	}
	switch {
	case invited > 0 && l.Status == "pending":
		return conflict("an administrator approves this link when reviewing the student account")
	case actorID == l.StudentID && l.Status == "pending":
		next := "rejected"
		if accept {
			next = "approved"
		}
		if _, err := s.db.ExecContext(ctx, `UPDATE guardian_student_links SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(6) WHERE id = ?`, next, actorID, linkID); err != nil {
			return err
		}
		s.notify(ctx, l.GuardianID, "guardian_link_"+next, "Link "+next, s.userName(ctx, l.StudentID)+" "+next+" your guardian link.")
		return nil
	case !accept && (actorID == l.StudentID || actorID == l.GuardianID) && l.Status == "approved":
		// Either side may end an approved link; access stops immediately.
		_, err := s.db.ExecContext(ctx, `UPDATE guardian_student_links SET status = 'revoked', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(6) WHERE id = ?`, actorID, linkID)
		return err
	case actorID == l.StudentID || actorID == l.GuardianID:
		return conflict("this link cannot change from " + l.Status)
	}
	return forbidden("this is not your link")
}

// ---------- conversations ----------

// ensureConversation returns the conversation between a and b, creating it with
// an optional system message the first time.
func (s *Service) ensureConversation(ctx context.Context, a, b, systemMessage string) (string, error) {
	var id string
	err := s.db.GetContext(ctx, &id, `SELECT x.conversation_id FROM conversation_participants x JOIN conversation_participants y ON y.conversation_id = x.conversation_id
		WHERE x.user_id = ? AND y.user_id = ? AND (SELECT COUNT(*) FROM conversation_participants z WHERE z.conversation_id = x.conversation_id) = 2 LIMIT 1`, a, b)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return "", err
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	id = newID()
	if _, err = tx.ExecContext(ctx, `INSERT INTO conversations (id, last_message_at) VALUES (?, UTC_TIMESTAMP(6))`, id); err != nil {
		return "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)`, id, a, id, b); err != nil {
		return "", err
	}
	if systemMessage != "" {
		if _, err = tx.ExecContext(ctx, `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, NULL, ?)`, newID(), id, systemMessage); err != nil {
			return "", err
		}
	}
	return id, tx.Commit()
}

type Conversation struct {
	ID            string     `db:"id" json:"id"`
	OtherID       string     `db:"other_id" json:"other_id"`
	OtherName     string     `db:"other_name" json:"other_name"`
	OtherRole     string     `db:"other_role" json:"other_role"`
	LastMessage   *string    `db:"last_message" json:"last_message"`
	LastMessageAt *time.Time `db:"last_message_at" json:"last_message_at"`
	Unread        int        `db:"unread" json:"unread"`
	Blocked       bool       `db:"blocked" json:"blocked"`
}

func (s *Service) Conversations(ctx context.Context, userID string) ([]Conversation, error) {
	out := []Conversation{}
	err := s.db.SelectContext(ctx, &out, `SELECT c.id, o.id AS other_id, o.name AS other_name, o.role AS other_role,
		(SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message, c.last_message_at,
		(SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND (m.sender_id IS NULL OR m.sender_id <> ?) AND m.created_at > COALESCE(me.last_read_at, '1970-01-01')) AS unread,
		EXISTS(SELECT 1 FROM user_blocks b WHERE (b.blocker_id = ? AND b.blocked_id = o.id) OR (b.blocker_id = o.id AND b.blocked_id = ?)) AS blocked
		FROM conversations c
		JOIN conversation_participants me ON me.conversation_id = c.id AND me.user_id = ?
		JOIN conversation_participants op ON op.conversation_id = c.id AND op.user_id <> ?
		JOIN users o ON o.id = op.user_id
		ORDER BY c.last_message_at DESC`, userID, userID, userID, userID, userID)
	return out, err
}

func (s *Service) UnreadMessages(ctx context.Context, userID string) (int, error) {
	var n int
	err := s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM messages m JOIN conversation_participants me ON me.conversation_id = m.conversation_id AND me.user_id = ?
		WHERE (m.sender_id IS NULL OR m.sender_id <> ?) AND m.created_at > COALESCE(me.last_read_at, '1970-01-01')`, userID, userID)
	return n, err
}

func (s *Service) participant(ctx context.Context, conversationID, userID string) error {
	var n int
	if err := s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM conversation_participants WHERE conversation_id = ? AND user_id = ?`, conversationID, userID); err != nil {
		return err
	}
	if n == 0 {
		// 404 rather than 403 so conversation IDs cannot be probed.
		return notFound("conversation not found")
	}
	return nil
}

type Message struct {
	ID         string    `db:"id" json:"id"`
	SenderID   *string   `db:"sender_id" json:"sender_id"`
	SenderName *string   `db:"sender_name" json:"sender_name"`
	Body       string    `db:"body" json:"body"`
	CreatedAt  time.Time `db:"created_at" json:"created_at"`
}

// Messages returns messages after `after` (exclusive) for incremental polling.
func (s *Service) Messages(ctx context.Context, userID, conversationID string, after *time.Time) ([]Message, error) {
	if err := s.participant(ctx, conversationID, userID); err != nil {
		return nil, err
	}
	out := []Message{}
	since := time.Unix(0, 0)
	if after != nil {
		since = *after
	}
	err := s.db.SelectContext(ctx, &out, `SELECT m.id, m.sender_id, u.name AS sender_name, m.body, m.created_at FROM messages m LEFT JOIN users u ON u.id = m.sender_id
		WHERE m.conversation_id = ? AND m.created_at > ? ORDER BY m.created_at ASC LIMIT 500`, conversationID, since)
	return out, err
}

func (s *Service) SendMessage(ctx context.Context, userID, conversationID, body string) (Message, error) {
	body = strings.TrimSpace(body)
	if body == "" || len(body) > 4000 {
		return Message{}, badRequest("messages must be 1 to 4000 characters")
	}
	if err := s.participant(ctx, conversationID, userID); err != nil {
		return Message{}, err
	}
	var other string
	if err := s.db.GetContext(ctx, &other, `SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id <> ? LIMIT 1`, conversationID, userID); err != nil {
		return Message{}, err
	}
	if s.blocked(ctx, userID, other) {
		return Message{}, forbidden("you cannot message this person")
	}
	m := Message{ID: newID(), SenderID: ptr(userID), Body: body}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return m, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)`, m.ID, conversationID, userID, body); err != nil {
		return m, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE conversations SET last_message_at = UTC_TIMESTAMP(6) WHERE id = ?`, conversationID); err != nil {
		return m, err
	}
	// Sending implies the sender has read everything so far.
	if _, err = tx.ExecContext(ctx, `UPDATE conversation_participants SET last_read_at = UTC_TIMESTAMP(6) WHERE conversation_id = ? AND user_id = ?`, conversationID, userID); err != nil {
		return m, err
	}
	if err = tx.Commit(); err != nil {
		return m, err
	}
	err = s.db.GetContext(ctx, &m.CreatedAt, `SELECT created_at FROM messages WHERE id = ?`, m.ID)
	return m, err
}

func (s *Service) MarkConversationRead(ctx context.Context, userID, conversationID string) error {
	if err := s.participant(ctx, conversationID, userID); err != nil {
		return err
	}
	_, err := s.db.ExecContext(ctx, `UPDATE conversation_participants SET last_read_at = UTC_TIMESTAMP(6) WHERE conversation_id = ? AND user_id = ?`, conversationID, userID)
	return err
}

func (s *Service) SetBlock(ctx context.Context, blocker, blocked string, block bool) error {
	if blocker == blocked {
		return badRequest("you cannot block yourself")
	}
	if block {
		_, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO user_blocks (blocker_id, blocked_id) SELECT ?, id FROM users WHERE id = ?`, blocker, blocked)
		return err
	}
	_, err := s.db.ExecContext(ctx, `DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?`, blocker, blocked)
	return err
}

// ---------- chat requests ----------

type ChatRequest struct {
	ID             string    `db:"id" json:"id"`
	FromID         string    `db:"from_id" json:"from_id"`
	FromName       string    `db:"from_name" json:"from_name"`
	FromRole       string    `db:"from_role" json:"from_role"`
	ToID           string    `db:"to_id" json:"to_id"`
	ToName         string    `db:"to_name" json:"to_name"`
	ToRole         string    `db:"to_role" json:"to_role"`
	ListingID      *string   `db:"listing_id" json:"listing_id"`
	StudentID      *string   `db:"student_id" json:"student_id"`
	Message        *string   `db:"message" json:"message"`
	Status         string    `db:"status" json:"status"`
	ConversationID *string   `db:"conversation_id" json:"conversation_id"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
}

// RequestChat lets a parent or student ask a tutor or coaching centre to talk.
// Contact stays inside TuitionHub until a tuition is agreed.
func (s *Service) RequestChat(ctx context.Context, fromID, fromRole, toID, listingID, studentID, message string) (string, error) {
	if fromRole != "parent" && fromRole != "student" {
		return "", forbidden("only parents and students send chat requests; tutors apply to tuition posts")
	}
	var to struct {
		Role   string `db:"role"`
		Status string `db:"account_status"`
	}
	if err := s.db.GetContext(ctx, &to, `SELECT role, account_status FROM users WHERE id = ?`, toID); errors.Is(err, sql.ErrNoRows) {
		return "", notFound("tutor not found")
	} else if err != nil {
		return "", err
	}
	if (to.Role != "tutor" && to.Role != "coaching") || to.Status != "active" {
		return "", badRequest("chat requests can only be sent to verified tutors and coaching centres")
	}
	if fromRole == "parent" && studentID != "" && !s.guardianOf(ctx, fromID, studentID) {
		return "", forbidden("that student is not linked to your account")
	}
	if s.blocked(ctx, fromID, toID) {
		return "", forbidden("you cannot contact this account")
	}
	var pending int
	if err := s.db.GetContext(ctx, &pending, `SELECT COUNT(*) FROM connection_requests WHERE from_id = ? AND to_id = ? AND status = 'pending'`, fromID, toID); err != nil {
		return "", err
	}
	if pending > 0 {
		return "", conflict("you already have a pending request to this tutor")
	}
	id := newID()
	if _, err := s.db.ExecContext(ctx, `INSERT INTO connection_requests (id, from_id, to_id, listing_id, student_id, message) VALUES (?, ?, ?, ?, ?, ?)`, id, fromID, toID, nullable(listingID), nullable(studentID), nullable(message)); err != nil {
		return "", err
	}
	s.notify(ctx, toID, "chat_request", "New chat request", s.userName(ctx, fromID)+" would like to talk about tuition.")
	return id, nil
}

func (s *Service) ChatRequests(ctx context.Context, userID string) ([]ChatRequest, error) {
	out := []ChatRequest{}
	err := s.db.SelectContext(ctx, &out, `SELECT r.id, r.from_id, f.name AS from_name, f.role AS from_role, r.to_id, t.name AS to_name, t.role AS to_role, r.listing_id, r.student_id, r.message, r.status, r.conversation_id, r.created_at
		FROM connection_requests r JOIN users f ON f.id = r.from_id JOIN users t ON t.id = r.to_id WHERE r.from_id = ? OR r.to_id = ? ORDER BY r.created_at DESC LIMIT 200`, userID, userID)
	return out, err
}

func (s *Service) RespondChat(ctx context.Context, actorID, requestID, action string) (map[string]any, error) {
	var r struct{ FromID, ToID, Status string }
	if err := s.db.QueryRowxContext(ctx, `SELECT from_id, to_id, status FROM connection_requests WHERE id = ?`, requestID).Scan(&r.FromID, &r.ToID, &r.Status); errors.Is(err, sql.ErrNoRows) {
		return nil, notFound("request not found")
	} else if err != nil {
		return nil, err
	}
	if r.Status != "pending" {
		return nil, conflict("this request was already " + r.Status)
	}
	switch {
	case action == "cancel" && actorID == r.FromID:
		_, err := s.db.ExecContext(ctx, `UPDATE connection_requests SET status = 'cancelled', responded_at = UTC_TIMESTAMP(6) WHERE id = ?`, requestID)
		return map[string]any{"status": "cancelled"}, err
	case action == "decline" && actorID == r.ToID:
		if _, err := s.db.ExecContext(ctx, `UPDATE connection_requests SET status = 'declined', responded_at = UTC_TIMESTAMP(6) WHERE id = ?`, requestID); err != nil {
			return nil, err
		}
		s.notify(ctx, r.FromID, "chat_declined", "Chat request declined", s.userName(ctx, r.ToID)+" declined your chat request.")
		return map[string]any{"status": "declined"}, nil
	case action == "accept" && actorID == r.ToID:
		conv, err := s.ensureConversation(ctx, r.FromID, r.ToID, "Chat request accepted. Phone numbers and addresses stay private until a tuition is confirmed.")
		if err != nil {
			return nil, err
		}
		if _, err := s.db.ExecContext(ctx, `UPDATE connection_requests SET status = 'accepted', conversation_id = ?, responded_at = UTC_TIMESTAMP(6) WHERE id = ?`, conv, requestID); err != nil {
			return nil, err
		}
		s.notify(ctx, r.FromID, "chat_accepted", "Chat request accepted", s.userName(ctx, r.ToID)+" accepted. You can now message each other.")
		return map[string]any{"status": "accepted", "conversation_id": conv}, nil
	case actorID == r.FromID || actorID == r.ToID:
		return nil, forbidden("you cannot " + action + " this request")
	}
	return nil, notFound("request not found")
}

// ---------- tuition agreements ----------

type Engagement struct {
	ID              string     `db:"id" json:"id"`
	TutorID         string     `db:"tutor_id" json:"tutor_id"`
	TutorName       string     `db:"tutor_name" json:"tutor_name"`
	GuardianID      *string    `db:"guardian_id" json:"guardian_id"`
	GuardianName    *string    `db:"guardian_name" json:"guardian_name"`
	StudentID       *string    `db:"student_id" json:"student_id"`
	StudentName     *string    `db:"student_name" json:"student_name"`
	ListingID       *string    `db:"listing_id" json:"listing_id"`
	ConversationID  *string    `db:"conversation_id" json:"conversation_id"`
	Subject         string     `db:"subject" json:"subject"`
	ClassName       string     `db:"class_name" json:"class_name"`
	Days            *string    `db:"days" json:"days"`
	TimeSlot        *string    `db:"time_slot" json:"time_slot"`
	Mode            string     `db:"mode" json:"mode"`
	LocationNote    *string    `db:"location_note" json:"location_note"`
	MonthlyFee      *float64   `db:"monthly_fee" json:"monthly_fee"`
	StartDate       *time.Time `db:"start_date" json:"start_date"`
	Status          string     `db:"status" json:"status"`
	TrialAt         *time.Time `db:"trial_at" json:"trial_at"`
	TrialNote       *string    `db:"trial_note" json:"trial_note"`
	TutorConfirmed  *time.Time `db:"tutor_confirmed_at" json:"tutor_confirmed_at"`
	ClientConfirmed *time.Time `db:"guardian_confirmed_at" json:"client_confirmed_at"`
	CancelReason    *string    `db:"cancel_reason" json:"cancel_reason"`
	ClassroomID     *string    `db:"classroom_id" json:"classroom_id"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
	// Contact details of the other side, shared only once the tuition is active.
	Contact *struct {
		Email string  `json:"email"`
		Phone *string `json:"phone"`
	} `db:"-" json:"contact,omitempty"`
}

const engagementSelect = `SELECT e.id, e.tutor_id, t.name AS tutor_name, e.guardian_id, g.name AS guardian_name, e.student_id, st.name AS student_name, e.listing_id, e.conversation_id,
	e.subject, e.class_name, e.days, e.time_slot, e.mode, e.location_note, e.monthly_fee, e.start_date, e.status, e.trial_at, e.trial_note, e.tutor_confirmed_at, e.guardian_confirmed_at, e.cancel_reason,
	(SELECT c.id FROM classrooms c WHERE c.engagement_id = e.id) AS classroom_id, e.created_at
	FROM engagements e JOIN users t ON t.id = e.tutor_id LEFT JOIN users g ON g.id = e.guardian_id LEFT JOIN users st ON st.id = e.student_id`

// client is the non-tutor side of an engagement: the guardian, or the student when no guardian is involved.
func clientOf(e Engagement) string {
	if e.GuardianID != nil {
		return *e.GuardianID
	}
	if e.StudentID != nil {
		return *e.StudentID
	}
	return ""
}

func (s *Service) Engagements(ctx context.Context, userID string) ([]Engagement, error) {
	out := []Engagement{}
	if err := s.db.SelectContext(ctx, &out, engagementSelect+` WHERE e.tutor_id = ? OR e.guardian_id = ? OR e.student_id = ? ORDER BY e.updated_at DESC`, userID, userID, userID); err != nil {
		return nil, err
	}
	for i := range out {
		s.attachContact(ctx, userID, &out[i])
	}
	return out, nil
}

func (s *Service) attachContact(ctx context.Context, viewer string, e *Engagement) {
	if e.Status != "active" && e.Status != "completed" {
		return
	}
	other := e.TutorID
	if viewer == e.TutorID {
		other = clientOf(*e)
	}
	var c struct {
		Email string  `db:"email" json:"email"`
		Phone *string `db:"phone" json:"phone"`
	}
	if err := s.db.GetContext(ctx, &c, `SELECT email, phone FROM users WHERE id = ?`, other); err == nil {
		e.Contact = &struct {
			Email string  `json:"email"`
			Phone *string `json:"phone"`
		}{c.Email, c.Phone}
	}
}

func (s *Service) engagement(ctx context.Context, userID, id string) (Engagement, error) {
	var e Engagement
	err := s.db.GetContext(ctx, &e, engagementSelect+` WHERE e.id = ?`, id)
	if errors.Is(err, sql.ErrNoRows) || (err == nil && userID != e.TutorID && userID != clientOf(e) && (e.StudentID == nil || *e.StudentID != userID)) {
		return e, notFound("tuition not found")
	}
	return e, err
}

type engagementInput struct {
	TutorID      string   `json:"tutor_id" validate:"required,uuid"`
	StudentID    string   `json:"student_id" validate:"omitempty,uuid"`
	ListingID    string   `json:"listing_id" validate:"omitempty,uuid"`
	Subject      string   `json:"subject" validate:"required,max=100"`
	ClassName    string   `json:"class_name" validate:"required,max=60"`
	Days         string   `json:"days" validate:"max=80"`
	TimeSlot     string   `json:"time_slot" validate:"max=60"`
	Mode         string   `json:"mode" validate:"required,oneof=online offline"`
	LocationNote string   `json:"location_note" validate:"max=255"`
	MonthlyFee   *float64 `json:"monthly_fee" validate:"omitempty,gte=0,lte=1000000"`
	StartDate    string   `json:"start_date"`
	TrialAt      string   `json:"trial_at"`
	TrialNote    string   `json:"trial_note" validate:"max=255"`
}

// CreateEngagement is started by a parent or student who has a conversation
// with the tutor: either a demo-class request (trial_at set) or terms directly.
func (s *Service) CreateEngagement(ctx context.Context, clientID, clientRole string, in engagementInput) (string, error) {
	if clientRole != "parent" && clientRole != "student" {
		return "", forbidden("only parents and students start a tuition")
	}
	if !s.related(ctx, clientID, in.TutorID) {
		return "", forbidden("start a conversation with this tutor first")
	}
	studentID := in.StudentID
	var guardian any
	if clientRole == "student" {
		studentID = clientID
	} else {
		guardian = clientID
		if studentID != "" && !s.guardianOf(ctx, clientID, studentID) {
			return "", forbidden("that student is not linked to your account")
		}
	}
	start, err := parseDate(in.StartDate)
	if err != nil {
		return "", err
	}
	status := "proposed"
	var trial *time.Time
	if in.TrialAt != "" {
		t, err := time.Parse(time.RFC3339, in.TrialAt)
		if err != nil || !t.After(time.Now()) {
			return "", badRequest("the demo class time must be a future date and time")
		}
		trial, status = &t, "trial_requested"
	}
	conv, _ := s.ensureConversation(ctx, clientID, in.TutorID, "")
	id := newID()
	_, err = s.db.ExecContext(ctx, `INSERT INTO engagements (id, tutor_id, guardian_id, student_id, listing_id, conversation_id, subject, class_name, days, time_slot, mode, location_note, monthly_fee, start_date, status, trial_at, trial_note, guardian_confirmed_at, created_by)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'proposed', UTC_TIMESTAMP(6), NULL), ?)`,
		id, in.TutorID, guardian, nullable(studentID), nullable(in.ListingID), conv, strings.TrimSpace(in.Subject), strings.TrimSpace(in.ClassName), nullable(in.Days), nullable(in.TimeSlot), in.Mode, nullable(in.LocationNote), in.MonthlyFee, start, status, trial, nullable(in.TrialNote), status, clientID)
	if err != nil {
		return "", err
	}
	if status == "trial_requested" {
		s.notify(ctx, in.TutorID, "demo_class_requested", "Demo class requested", s.userName(ctx, clientID)+" requested a demo class for "+in.Subject+".")
	} else {
		s.notify(ctx, in.TutorID, "tuition_proposed", "Tuition terms proposed", s.userName(ctx, clientID)+" proposed tuition terms for "+in.Subject+". Review and confirm.")
	}
	s.audit(ctx, clientID, in.TutorID, "engagement_"+status, map[string]any{"engagement_id": id})
	return id, nil
}

type engagementAction struct {
	Action       string   `json:"action" validate:"required,oneof=accept_trial decline_trial propose confirm cancel complete"`
	Reason       string   `json:"reason" validate:"max=255"`
	Days         string   `json:"days" validate:"max=80"`
	TimeSlot     string   `json:"time_slot" validate:"max=60"`
	Mode         string   `json:"mode" validate:"omitempty,oneof=online offline"`
	LocationNote string   `json:"location_note" validate:"max=255"`
	MonthlyFee   *float64 `json:"monthly_fee" validate:"omitempty,gte=0,lte=1000000"`
	StartDate    string   `json:"start_date"`
}

// ActOnEngagement drives the agreement state machine:
//
//	trial_requested --tutor accept_trial--> trial_scheduled
//	trial_requested --tutor decline_trial--> trial_declined
//	trial_scheduled|proposed --either propose(terms)--> proposed (only the proposer is confirmed)
//	proposed --other side confirm--> active (creates the classroom)
//	active --either complete--> completed;  any open state --either cancel--> cancelled
func (s *Service) ActOnEngagement(ctx context.Context, actorID, id string, in engagementAction) (map[string]any, error) {
	e, err := s.engagement(ctx, actorID, id)
	if err != nil {
		return nil, err
	}
	isTutor := actorID == e.TutorID
	isClient := actorID == clientOf(e)
	if !isTutor && !isClient {
		return nil, forbidden("only the tutor and the guardian can change this tuition")
	}
	other := e.TutorID
	if isTutor {
		other = clientOf(e)
	}
	name := s.userName(ctx, actorID)
	exec := func(q string, args ...any) error { _, err := s.db.ExecContext(ctx, q, args...); return err }
	switch in.Action {
	case "accept_trial", "decline_trial":
		if !isTutor || e.Status != "trial_requested" {
			return nil, conflict("only the tutor can answer a pending demo-class request")
		}
		next := map[string]string{"accept_trial": "trial_scheduled", "decline_trial": "trial_declined"}[in.Action]
		if err := exec(`UPDATE engagements SET status = ? WHERE id = ?`, next, id); err != nil {
			return nil, err
		}
		s.notify(ctx, other, "demo_class_"+next, map[string]string{"trial_scheduled": "Demo class accepted", "trial_declined": "Demo class declined"}[next], name+" answered your demo-class request.")
	case "propose":
		if e.Status != "trial_scheduled" && e.Status != "proposed" && e.Status != "trial_declined" {
			return nil, conflict("terms can be proposed after a demo class or while negotiating")
		}
		start, err := parseDate(in.StartDate)
		if err != nil {
			return nil, err
		}
		if in.MonthlyFee == nil || in.Mode == "" || start == nil {
			return nil, badRequest("monthly fee, mode and start date are required")
		}
		col := "guardian_confirmed_at"
		if isTutor {
			col = "tutor_confirmed_at"
		}
		// New terms reset the other side's confirmation.
		if err := exec(`UPDATE engagements SET status = 'proposed', days = ?, time_slot = ?, mode = ?, location_note = ?, monthly_fee = ?, start_date = ?, tutor_confirmed_at = NULL, guardian_confirmed_at = NULL, `+col+` = UTC_TIMESTAMP(6) WHERE id = ?`,
			nullable(in.Days), nullable(in.TimeSlot), in.Mode, nullable(in.LocationNote), in.MonthlyFee, start, id); err != nil {
			return nil, err
		}
		s.notify(ctx, other, "tuition_proposed", "Tuition terms proposed", name+" proposed terms for "+e.Subject+". Review and confirm.")
	case "confirm":
		if e.Status != "proposed" {
			return nil, conflict("there are no proposed terms to confirm")
		}
		if (isTutor && e.TutorConfirmed != nil) || (isClient && e.ClientConfirmed != nil) {
			return nil, conflict("you already confirmed; waiting for the other side")
		}
		return s.activate(ctx, e, isTutor, name, other)
	case "cancel":
		if e.Status == "completed" || e.Status == "cancelled" {
			return nil, conflict("this tuition is already " + e.Status)
		}
		if len(strings.TrimSpace(in.Reason)) < 5 {
			return nil, badRequest("please give a reason")
		}
		if err := exec(`UPDATE engagements SET status = 'cancelled', cancel_reason = ? WHERE id = ?`, in.Reason, id); err != nil {
			return nil, err
		}
		_ = exec(`UPDATE classrooms SET archived_at = UTC_TIMESTAMP(6) WHERE engagement_id = ? AND archived_at IS NULL`, id)
		s.notify(ctx, other, "tuition_cancelled", "Tuition cancelled", name+" cancelled the "+e.Subject+" tuition: "+in.Reason)
	case "complete":
		if e.Status != "active" {
			return nil, conflict("only an active tuition can be completed")
		}
		if err := exec(`UPDATE engagements SET status = 'completed' WHERE id = ?`, id); err != nil {
			return nil, err
		}
		s.notify(ctx, other, "tuition_completed", "Tuition completed", "The "+e.Subject+" tuition was marked completed. You can now leave a review.")
	}
	s.audit(ctx, actorID, other, "engagement_"+in.Action, map[string]any{"engagement_id": id})
	return map[string]any{"ok": true}, nil
}

// activate records one side's confirmation; when both sides have confirmed the
// tuition becomes active and its classroom is created with the student in it.
func (s *Service) activate(ctx context.Context, e Engagement, isTutor bool, name, other string) (map[string]any, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	col := "guardian_confirmed_at"
	if isTutor {
		col = "tutor_confirmed_at"
	}
	if _, err = tx.ExecContext(ctx, `UPDATE engagements SET `+col+` = UTC_TIMESTAMP(6) WHERE id = ? AND status = 'proposed'`, e.ID); err != nil {
		return nil, err
	}
	var both bool
	if err = tx.GetContext(ctx, &both, `SELECT tutor_confirmed_at IS NOT NULL AND guardian_confirmed_at IS NOT NULL FROM engagements WHERE id = ?`, e.ID); err != nil {
		return nil, err
	}
	out := map[string]any{"status": "proposed"}
	if both {
		if _, err = tx.ExecContext(ctx, `UPDATE engagements SET status = 'active' WHERE id = ?`, e.ID); err != nil {
			return nil, err
		}
		classroom := newID()
		roomName := e.Subject + " · " + e.ClassName
		if e.StudentName != nil {
			roomName += " · " + *e.StudentName
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO classrooms (id, owner_id, engagement_id, name, subject) VALUES (?, ?, ?, ?, ?)`, classroom, e.TutorID, e.ID, roomName, e.Subject); err != nil {
			return nil, err
		}
		if e.StudentID != nil {
			if _, err = tx.ExecContext(ctx, `INSERT INTO classroom_members (classroom_id, student_id) VALUES (?, ?)`, classroom, *e.StudentID); err != nil {
				return nil, err
			}
		}
		if e.ListingID != nil {
			_, _ = tx.ExecContext(ctx, `UPDATE tuition_listings SET status = 'filled' WHERE id = ? AND status IN ('open', 'paused')`, *e.ListingID)
		}
		out = map[string]any{"status": "active", "classroom_id": classroom}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	if both {
		s.notify(ctx, other, "tuition_active", "Tuition confirmed", "The "+e.Subject+" tuition is confirmed and its classroom is ready. Contact details are now shared.")
		if e.StudentID != nil && *e.StudentID != other {
			s.notify(ctx, *e.StudentID, "tuition_active", "New classroom", "Your "+e.Subject+" classroom with "+e.TutorName+" is ready.")
		}
	} else {
		s.notify(ctx, other, "tuition_confirmed_one_side", "Waiting for your confirmation", name+" confirmed the "+e.Subject+" tuition terms.")
	}
	return out, nil
}

// ---------- payments (tracking only; no money moves through TuitionHub) ----------

type Payment struct {
	ID          string     `db:"id" json:"id"`
	Month       string     `db:"month" json:"month"`
	Amount      float64    `db:"amount" json:"amount"`
	Status      string     `db:"status" json:"status"`
	Note        *string    `db:"note" json:"note"`
	MarkedAt    *time.Time `db:"marked_at" json:"marked_at"`
	ConfirmedAt *time.Time `db:"confirmed_at" json:"confirmed_at"`
}

func (s *Service) Payments(ctx context.Context, userID, engagementID string) ([]Payment, error) {
	if _, err := s.engagement(ctx, userID, engagementID); err != nil {
		return nil, err
	}
	out := []Payment{}
	err := s.db.SelectContext(ctx, &out, `SELECT id, month, amount, status, note, marked_at, confirmed_at FROM payment_records WHERE engagement_id = ? ORDER BY month DESC`, engagementID)
	return out, err
}

// PaymentAction: the tutor records a month as due; the guardian marks it paid;
// the tutor confirms receipt; either side may dispute with a note.
func (s *Service) PaymentAction(ctx context.Context, userID, engagementID, action, month, note string) error {
	e, err := s.engagement(ctx, userID, engagementID)
	if err != nil {
		return err
	}
	if e.Status != "active" && e.Status != "completed" {
		return conflict("payments are tracked for active tuitions only")
	}
	isTutor := userID == e.TutorID
	if len(month) != 7 || month[4] != '-' {
		return badRequest("month must be YYYY-MM")
	}
	exec := func(q string, args ...any) (int64, error) {
		r, err := s.db.ExecContext(ctx, q, args...)
		if err != nil {
			return 0, err
		}
		return r.RowsAffected()
	}
	var n int64
	switch {
	case action == "due" && isTutor:
		if e.MonthlyFee == nil {
			return badRequest("set a monthly fee first")
		}
		n, err = exec(`INSERT IGNORE INTO payment_records (id, engagement_id, month, amount) VALUES (?, ?, ?, ?)`, newID(), engagementID, month, *e.MonthlyFee)
		if n == 0 && err == nil {
			return conflict("that month is already recorded")
		}
		s.notify(ctx, clientOf(e), "payment_due", "Tuition fee due", "The "+month+" fee for "+e.Subject+" is due.")
	case action == "mark_paid" && !isTutor:
		n, err = exec(`UPDATE payment_records SET status = 'marked_paid', marked_at = UTC_TIMESTAMP(6), note = ? WHERE engagement_id = ? AND month = ? AND status IN ('due', 'disputed')`, nullable(note), engagementID, month)
		s.notify(ctx, e.TutorID, "payment_marked", "Fee marked as paid", "The guardian marked "+month+" as paid. Please confirm receipt.")
	case action == "confirm" && isTutor:
		n, err = exec(`UPDATE payment_records SET status = 'confirmed', confirmed_at = UTC_TIMESTAMP(6) WHERE engagement_id = ? AND month = ? AND status = 'marked_paid'`, engagementID, month)
	case action == "dispute":
		if len(strings.TrimSpace(note)) < 5 {
			return badRequest("please explain the dispute")
		}
		n, err = exec(`UPDATE payment_records SET status = 'disputed', note = ? WHERE engagement_id = ? AND month = ? AND status IN ('marked_paid', 'due')`, note, engagementID, month)
		other := e.TutorID
		if isTutor {
			other = clientOf(e)
		}
		s.notify(ctx, other, "payment_disputed", "Payment disputed", month+": "+note)
	default:
		return forbidden("you cannot do that with this payment")
	}
	if err != nil {
		return err
	}
	if n == 0 && action != "due" {
		return conflict("that payment is not in a state that allows this")
	}
	return nil
}

// ---------- reviews ----------

func (s *Service) Review(ctx context.Context, userID, engagementID string, stars int, body string) error {
	e, err := s.engagement(ctx, userID, engagementID)
	if err != nil {
		return err
	}
	if userID == e.TutorID {
		return forbidden("tutors cannot review themselves")
	}
	if e.Status != "completed" && e.Status != "active" {
		return conflict("you can review once the tuition is active or completed")
	}
	if stars < 1 || stars > 5 {
		return badRequest("stars must be 1 to 5")
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO reviews (id, engagement_id, reviewer_id, subject_id, stars, body) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE stars = VALUES(stars), body = VALUES(body)`, newID(), engagementID, userID, e.TutorID, stars, nullable(body))
	if err == nil {
		s.notify(ctx, e.TutorID, "review_received", "New review", s.userName(ctx, userID)+" left you a review.")
	}
	return err
}

func (s *Service) ReplyReview(ctx context.Context, userID, reviewID, reply string) error {
	r, err := s.db.ExecContext(ctx, `UPDATE reviews SET reply = ?, replied_at = UTC_TIMESTAMP(6) WHERE id = ? AND subject_id = ?`, nullable(reply), reviewID, userID)
	if err != nil {
		return err
	}
	if n, _ := r.RowsAffected(); n == 0 {
		return notFound("review not found")
	}
	return nil
}

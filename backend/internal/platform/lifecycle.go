package platform

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

// Tuition lifecycle after the demo class:
//
//	proposed --both sides confirm--> agreed (no classroom yet)
//	agreed --tutor create_classroom--> agreed + classroom + join requests
//	agreed --every invited participant accepts--> active (the tuition has started)
//
// Then, per month: the tutor marks the month completed (one record per month,
// one payment reminder to the payer), the payer submits a payment confirmation
// and the tutor confirms or disputes it. No money moves through TuitionHub.

// JoinRequest is one participant's invitation to a tuition's classroom.
type JoinRequest struct {
	ID          string     `db:"id" json:"id"`
	UserID      string     `db:"user_id" json:"user_id"`
	Name        string     `db:"name" json:"name"`
	Participant string     `db:"participant" json:"participant"`
	Status      string     `db:"status" json:"status"`
	RespondedAt *time.Time `db:"responded_at" json:"responded_at"`
}

func (s *Service) joinRequests(ctx context.Context, engagementID string) ([]JoinRequest, error) {
	out := []JoinRequest{}
	err := s.db.SelectContext(ctx, &out, `SELECT j.id, j.user_id, u.name, j.participant, j.status, j.responded_at FROM classroom_join_requests j JOIN users u ON u.id = j.user_id
		WHERE j.engagement_id = ? ORDER BY j.participant, u.name`, engagementID)
	return out, err
}

// classroomJoinRequests lists a classroom's join requests (empty for classrooms
// that were not created from a tuition agreement).
func (s *Service) classroomJoinRequests(ctx context.Context, classroomID string) ([]JoinRequest, error) {
	out := []JoinRequest{}
	err := s.db.SelectContext(ctx, &out, `SELECT j.id, j.user_id, u.name, j.participant, j.status, j.responded_at FROM classroom_join_requests j JOIN users u ON u.id = j.user_id
		WHERE j.classroom_id = ? ORDER BY j.participant, u.name`, classroomID)
	return out, err
}

// tuitionRef is the short reference shown to people for a tuition.
func tuitionRef(id string) string {
	if len(id) < 8 {
		return "TH-" + strings.ToUpper(id)
	}
	return "TH-" + strings.ToUpper(id[:8])
}

func monthLabel(month string) string {
	t, err := time.Parse("2006-01", month)
	if err != nil {
		return month
	}
	return t.Format("January 2006")
}

func takaText(v float64) string {
	whole := strconv.FormatFloat(v, 'f', -1, 64)
	frac := ""
	if i := strings.IndexByte(whole, '.'); i >= 0 {
		whole, frac = whole[:i], whole[i:]
	}
	var b strings.Builder
	for i, r := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(r)
	}
	return "৳" + b.String() + frac
}

// createTuitionClassroom is the tutor's step after both sides agreed: it creates
// the tuition's single classroom and invites the guardian and the student.
func (s *Service) createTuitionClassroom(ctx context.Context, e Engagement, tutorName string) (map[string]any, error) {
	if e.Status != "agreed" {
		return nil, conflict("the classroom can be created once both sides have agreed to continue")
	}
	if e.ClassroomID != nil {
		return nil, conflict("this tuition already has a classroom")
	}
	type invite struct{ user, participant string }
	invites := []invite{}
	if e.GuardianID != nil {
		invites = append(invites, invite{*e.GuardianID, "guardian"})
	}
	if e.StudentID != nil && (e.GuardianID == nil || *e.StudentID != *e.GuardianID) {
		invites = append(invites, invite{*e.StudentID, "student"})
	}
	if len(invites) == 0 {
		return nil, conflict("this tuition has no guardian or student to invite")
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	classroom := newID()
	roomName := e.Subject + " · " + e.ClassName
	if e.StudentName != nil {
		roomName += " · " + *e.StudentName
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO classrooms (id, owner_id, engagement_id, name, subject) VALUES (?, ?, ?, ?, ?)`, classroom, e.TutorID, e.ID, roomName, e.Subject); err != nil {
		if isDuplicate(err) {
			return nil, conflict("this tuition already has a classroom")
		}
		return nil, err
	}
	for _, in := range invites {
		if _, err = tx.ExecContext(ctx, `INSERT INTO classroom_join_requests (id, classroom_id, engagement_id, user_id, participant) VALUES (?, ?, ?, ?, ?)`, newID(), classroom, e.ID, in.user, in.participant); err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	for _, in := range invites {
		s.notify(ctx, in.user, "classroom_invite", "Classroom invitation", tutorName+" created the "+e.Subject+" classroom ("+tuitionRef(e.ID)+"). Open Tuitions to accept or decline the invitation.")
	}
	return map[string]any{"status": "agreed", "classroom_id": classroom}, nil
}

// respondClassroom records an invited participant's answer. When every invited
// participant has accepted, the tuition starts (status active).
func (s *Service) respondClassroom(ctx context.Context, e Engagement, actorID string, accept bool) (map[string]any, error) {
	if e.ClassroomID == nil {
		return nil, conflict("there is no classroom invitation for this tuition yet")
	}
	if e.Status != "agreed" && e.Status != "active" {
		return nil, conflict("this tuition is " + e.Status)
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	var req struct {
		ID          string `db:"id"`
		Participant string `db:"participant"`
		Status      string `db:"status"`
	}
	err = tx.GetContext(ctx, &req, `SELECT id, participant, status FROM classroom_join_requests WHERE classroom_id = ? AND user_id = ? FOR UPDATE`, *e.ClassroomID, actorID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, forbidden("you were not invited to this classroom")
	} else if err != nil {
		return nil, err
	}
	next := "rejected"
	if accept {
		next = "accepted"
		if req.Status == "accepted" {
			return nil, conflict("you already joined this classroom")
		}
		// A guardian reaches only their own child's classroom.
		if req.Participant == "guardian" && e.StudentID != nil && !s.guardianOf(ctx, actorID, *e.StudentID) {
			return nil, forbidden("only an approved guardian of this student can join the classroom")
		}
	} else if req.Status != "pending" {
		return nil, conflict("only a pending invitation can be declined")
	}
	if _, err = tx.ExecContext(ctx, `UPDATE classroom_join_requests SET status = ?, responded_at = UTC_TIMESTAMP(6) WHERE id = ?`, next, req.ID); err != nil {
		return nil, err
	}
	if accept && req.Participant == "student" {
		if _, err = tx.ExecContext(ctx, `INSERT IGNORE INTO classroom_members (classroom_id, student_id) VALUES (?, ?)`, *e.ClassroomID, actorID); err != nil {
			return nil, err
		}
	}
	started := false
	if accept && e.Status == "agreed" {
		var open int
		if err = tx.GetContext(ctx, &open, `SELECT COUNT(*) FROM classroom_join_requests WHERE classroom_id = ? AND status <> 'accepted'`, *e.ClassroomID); err != nil {
			return nil, err
		}
		if open == 0 {
			res, err := tx.ExecContext(ctx, `UPDATE engagements SET status = 'active' WHERE id = ? AND status = 'agreed'`, e.ID)
			if err != nil {
				return nil, err
			}
			n, _ := res.RowsAffected()
			started = n == 1
			if started && e.ListingID != nil {
				_, _ = tx.ExecContext(ctx, `UPDATE tuition_listings SET status = 'filled' WHERE id = ? AND status IN ('open', 'paused')`, *e.ListingID)
			}
		}
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	name := s.userName(ctx, actorID)
	if accept {
		s.notify(ctx, e.TutorID, "classroom_joined", "Classroom invitation accepted", name+" accepted the "+e.Subject+" classroom invitation ("+tuitionRef(e.ID)+").")
	} else {
		s.notify(ctx, e.TutorID, "classroom_declined", "Classroom invitation declined", name+" declined the "+e.Subject+" classroom invitation ("+tuitionRef(e.ID)+"). Talk it over in Messages.")
	}
	status := e.Status
	if started {
		status = "active"
		for _, id := range uniqueIDs(e.TutorID, deref(e.GuardianID), deref(e.StudentID)) {
			s.notify(ctx, id, "tuition_started", "Tuition started", "The "+e.Subject+" tuition ("+tuitionRef(e.ID)+") has started: both sides agreed and everyone joined the classroom. Contact details are now shared.")
		}
	}
	s.audit(ctx, actorID, e.TutorID, "classroom_join_"+next, map[string]any{"engagement_id": e.ID, "classroom_id": *e.ClassroomID})
	return map[string]any{"status": status, "join_status": next}, nil
}

func isDuplicate(err error) bool {
	var me *mysql.MySQLError
	return errors.As(err, &me) && me.Number == 1062
}

func deref(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func uniqueIDs(ids ...string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, id := range ids {
		if id != "" && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

// deliverInConversation writes a message into the tuition's conversation and a
// notification for recipient that shares the message's id, so the notification
// opens that message (the same pattern as interview details). A nil sender
// writes a system message.
func (s *Service) deliverInConversation(ctx context.Context, e Engagement, sender any, recipientID, kind, title, notificationBody, messageBody string) (string, error) {
	conversationID := deref(e.ConversationID)
	if conversationID == "" {
		var err error
		if conversationID, err = s.ensureConversation(ctx, e.TutorID, clientOf(e), ""); err != nil {
			return "", err
		}
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return "", err
	}
	defer tx.Rollback()
	id := newID()
	if _, err = tx.ExecContext(ctx, `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)`, id, conversationID, sender, messageBody); err != nil {
		return "", err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE conversations SET last_message_at = UTC_TIMESTAMP(6) WHERE id = ?`, conversationID); err != nil {
		return "", err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, ?, ?, ?)`, id, recipientID, kind, title, notificationBody); err != nil {
		return "", err
	}
	return id, tx.Commit()
}

func parseMonth(month string) (time.Time, error) {
	t, err := time.Parse("2006-01", month)
	if err != nil || len(month) != 7 {
		return t, badRequest("month must be YYYY-MM")
	}
	return t, nil
}

// completeMonth is the tutor marking a month of an active tuition completed. It
// creates (or completes) the month's single payment record at the agreed fee
// and sends the payer one payment reminder for that month.
func (s *Service) completeMonth(ctx context.Context, e Engagement, month string) error {
	if e.Status != "active" {
		return conflict("months are tracked once the tuition has started")
	}
	if e.MonthlyFee == nil {
		return badRequest("no monthly fee was agreed for this tuition; agree terms with a fee first")
	}
	m, err := parseMonth(month)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	if m.After(time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)) {
		return badRequest("a month can be marked completed once it has started")
	}
	if e.StartDate != nil && m.Before(time.Date(e.StartDate.Year(), e.StartDate.Month(), 1, 0, 0, 0, 0, time.UTC)) {
		return badRequest("that month is before the tuition started")
	}
	res, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO payment_records (id, engagement_id, month, amount, completed_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(6))`, newID(), e.ID, month, *e.MonthlyFee)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// A month first recorded as due (before completion tracking) is completed in place.
		res, err = s.db.ExecContext(ctx, `UPDATE payment_records SET completed_at = UTC_TIMESTAMP(6) WHERE engagement_id = ? AND month = ? AND completed_at IS NULL`, e.ID, month)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return conflict("that month is already marked completed")
		}
	}
	// Exactly one reminder per tuition-month, and none for a month already settled.
	res, err = s.db.ExecContext(ctx, `UPDATE payment_records SET reminder_sent_at = UTC_TIMESTAMP(6) WHERE engagement_id = ? AND month = ? AND reminder_sent_at IS NULL AND status IN ('due', 'disputed')`, e.ID, month)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 1 {
		var amount float64
		if err := s.db.GetContext(ctx, &amount, `SELECT amount FROM payment_records WHERE engagement_id = ? AND month = ?`, e.ID, month); err != nil {
			return err
		}
		ref, label := tuitionRef(e.ID), monthLabel(month)
		notification := fmt.Sprintf("%s · %s (%s): %s is completed. Amount due: %s. Open the message, or Payments, to submit your payment confirmation.", e.Subject, e.ClassName, ref, label, takaText(amount))
		message := fmt.Sprintf("Payment reminder: %s · %s (%s)\nMonth: %s, marked completed by the tutor\nAmount due: %s\nAfter paying, submit your payment confirmation under Payments with the amount and the method or reference. The tutor then confirms receipt.", e.Subject, e.ClassName, ref, label, takaText(amount))
		if _, err := s.deliverInConversation(ctx, e, nil, clientOf(e), "payment_reminder", "Payment reminder", notification, message); err != nil {
			return err
		}
	}
	return nil
}

// SendPaymentInstructions lets the tutor tell the payer how to pay, through the
// tuition's conversation. TuitionHub stores no account details of its own.
func (s *Service) SendPaymentInstructions(ctx context.Context, userID, engagementID, month, body string) (string, error) {
	e, err := s.engagement(ctx, userID, engagementID)
	if err != nil {
		return "", err
	}
	if userID != e.TutorID {
		return "", forbidden("only the tutor sends payment instructions")
	}
	if e.Status != "active" && e.Status != "completed" {
		return "", conflict("payment instructions can be sent once the tuition has started")
	}
	body = strings.TrimSpace(body)
	if len(body) < 10 {
		return "", badRequest("write the payment instructions (at least 10 characters)")
	}
	header := "How to pay: " + e.Subject + " · " + e.ClassName + " (" + tuitionRef(e.ID) + ")"
	if month != "" {
		if _, err := parseMonth(month); err != nil {
			return "", err
		}
		header += " · " + monthLabel(month)
	}
	return s.deliverInConversation(ctx, e, e.TutorID, clientOf(e), "payment_instructions", "How to pay",
		e.TutorName+" sent payment instructions for "+e.Subject+" ("+tuitionRef(e.ID)+"). Open the message to read them.", header+"\n\n"+body)
}

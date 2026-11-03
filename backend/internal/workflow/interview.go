package workflow

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
)

// The applicant's side of a verification interview: they see it on their
// Verification page, confirm they can attend, or discuss it with the
// administrator in Messages. None of these steps approves the application;
// only the administrator's final decision does.

// ErrInterviewPending blocks the final approval while an interview is still scheduled.
var ErrInterviewPending = errors.New("an interview is still scheduled")

// ApplicantInterview is the applicant's current interview, with the conversation
// that holds the meeting messages and the administrator's latest message there.
type ApplicantInterview struct {
	ID                string     `db:"id" json:"id"`
	Mode              string     `db:"mode" json:"mode"`
	ScheduledAt       time.Time  `db:"scheduled_at" json:"scheduled_at"`
	LocationOrLink    *string    `db:"location_or_link" json:"location_or_link"`
	Instructions      *string    `db:"instructions" json:"instructions"`
	Status            string     `db:"status" json:"status"`
	ConfirmedAt       *time.Time `db:"confirmed_at" json:"confirmed_at"`
	UpdatedAt         *time.Time `db:"updated_at" json:"updated_at"`
	ScheduledBy       string     `db:"scheduled_by" json:"-"`
	ConversationID    *string    `db:"conversation_id" json:"conversation_id"`
	LatestAdminNote   *string    `db:"latest_admin_message" json:"latest_admin_message"`
	LatestAdminNoteAt *time.Time `db:"latest_admin_message_at" json:"latest_admin_message_at"`
}

// adminConversation finds the two-person conversation between an interview's
// scheduling administrator and the applicant.
const adminConversation = `(SELECT x.conversation_id FROM conversation_participants x JOIN conversation_participants y ON y.conversation_id = x.conversation_id
	WHERE x.user_id = i.scheduled_by AND y.user_id = a.user_id AND (SELECT COUNT(*) FROM conversation_participants z WHERE z.conversation_id = x.conversation_id) = 2 LIMIT 1)`

// CurrentInterview returns the applicant's latest interview that was not cancelled, or nil.
func (s *Service) CurrentInterview(ctx context.Context, userID string) (*ApplicantInterview, error) {
	var out ApplicantInterview
	err := s.db.GetContext(ctx, &out, `SELECT t.*,
		(SELECT m.body FROM messages m WHERE m.conversation_id = t.conversation_id AND m.sender_id = t.scheduled_by ORDER BY m.created_at DESC LIMIT 1) AS latest_admin_message,
		(SELECT m.created_at FROM messages m WHERE m.conversation_id = t.conversation_id AND m.sender_id = t.scheduled_by ORDER BY m.created_at DESC LIMIT 1) AS latest_admin_message_at
		FROM (SELECT i.id, i.mode, i.scheduled_at, i.location_or_link, i.instructions, i.status, i.confirmed_at, i.updated_at, i.scheduled_by, `+adminConversation+` AS conversation_id
			FROM interviews i JOIN verification_applications a ON a.id = i.application_id
			WHERE a.user_id = ? AND i.status <> 'cancelled' ORDER BY i.created_at DESC LIMIT 1) t`, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return &out, err
}

// ConfirmInterview records that the applicant can attend their scheduled
// interview and tells the scheduling administrator. A second confirmation of
// the same schedule changes nothing and sends nothing.
func (s *Service) ConfirmInterview(ctx context.Context, userID string) (confirmedNow bool, err error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()
	var iv struct {
		ID          string     `db:"id"`
		ScheduledBy string     `db:"scheduled_by"`
		ScheduledAt time.Time  `db:"scheduled_at"`
		ConfirmedAt *time.Time `db:"confirmed_at"`
	}
	err = tx.GetContext(ctx, &iv, `SELECT i.id, i.scheduled_by, i.scheduled_at, i.confirmed_at FROM interviews i JOIN verification_applications a ON a.id = i.application_id
		WHERE a.user_id = ? AND i.status = 'scheduled' ORDER BY i.created_at DESC LIMIT 1 FOR UPDATE`, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, ErrNotFound
	}
	if err != nil {
		return false, err
	}
	if iv.ConfirmedAt != nil {
		return false, nil
	}
	if _, err = tx.ExecContext(ctx, `UPDATE interviews SET confirmed_at = UTC_TIMESTAMP(6) WHERE id = ?`, iv.ID); err != nil {
		return false, err
	}
	var name string
	if err = tx.GetContext(ctx, &name, `SELECT name FROM users WHERE id = ?`, userID); err != nil {
		return false, err
	}
	date, clock := meetingWhen(iv.ScheduledAt)
	if err = deliverMeeting(ctx, tx, userID, iv.ScheduledBy, "interview_confirmed", "Interview confirmed", name+" confirmed the verification interview on "+date+" at "+clock+".", interviewConfirmedMessage(iv.ScheduledAt)); err != nil {
		return false, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, 'interview_confirmed', JSON_OBJECT('interview_id', ?))`, uuid.NewString(), userID, userID, iv.ID); err != nil {
		return false, err
	}
	return true, tx.Commit()
}

// RescheduleInterview changes a scheduled interview in place (no second
// interview record), clears the applicant's confirmation and tells them.
func (s *Service) RescheduleInterview(ctx context.Context, reviewerID, applicationID, interviewID, mode, scheduledAt, location, instructions string) error {
	if mode != "online" && mode != "in_person" {
		return ErrInvalidState
	}
	at, err := time.Parse("2006-01-02 15:04:05.000000", scheduledAt)
	if err != nil {
		return ErrInvalidState
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	var iv struct {
		Status string `db:"status"`
		UserID string `db:"user_id"`
	}
	err = tx.GetContext(ctx, &iv, `SELECT i.status, a.user_id FROM interviews i JOIN verification_applications a ON a.id = i.application_id WHERE i.id = ? AND i.application_id = ? FOR UPDATE`, interviewID, applicationID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if iv.Status != "scheduled" {
		return ErrConflict
	}
	if _, err = tx.ExecContext(ctx, `UPDATE interviews SET mode = ?, scheduled_at = ?, location_or_link = ?, instructions = ?, confirmed_at = NULL, updated_at = UTC_TIMESTAMP(6) WHERE id = ?`, mode, scheduledAt, nullIfEmpty(location), nullIfEmpty(instructions), interviewID); err != nil {
		return err
	}
	date, clock := meetingWhen(at)
	if err = deliverMeeting(ctx, tx, reviewerID, iv.UserID, "interview_rescheduled", "Interview rescheduled", "Your verification interview was moved to "+date+" at "+clock+". Please confirm the new time on your Verification page.", interviewRescheduledMessage(mode, location, instructions, at)); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, 'interview_rescheduled', JSON_OBJECT('interview_id', ?, 'mode', ?, 'scheduled_at', ?))`, uuid.NewString(), reviewerID, iv.UserID, interviewID, mode, scheduledAt); err != nil {
		return err
	}
	return tx.Commit()
}

func trimInstructions(value string) string {
	value = strings.TrimSpace(value)
	if len(value) > 2000 {
		value = value[:2000]
	}
	return value
}

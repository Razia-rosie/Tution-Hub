package workflow

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
)

// Interviews an administrator schedules reach the applicant twice: as a
// notification and as a message in their conversation with that administrator
// (the messages and conversations of the platform's Messages screen). Both
// rows share one id, so the notification can open exactly that message and a
// meeting can never produce two different copies.

// bangladeshTime is fixed at UTC+6 (no daylight saving), so no time-zone
// database is needed on the server.
var bangladeshTime = time.FixedZone("Bangladesh time", 6*60*60)

func meetingWhen(at time.Time) (date, clock string) {
	local := at.In(bangladeshTime)
	return local.Format("Monday, 2 January 2006"), local.Format("3:04 PM") + " (Bangladesh time)"
}

func meetingMode(mode string) string {
	if mode == "in_person" {
		return "In person"
	}
	return "Online"
}

// interviewScheduledMessage is the chat message with everything the administrator entered.
func interviewScheduledMessage(mode, location string, at time.Time) string {
	date, clock := meetingWhen(at)
	lines := []string{
		"Verification interview scheduled",
		"Purpose: verification interview for your TuitionHub account",
		"Date: " + date,
		"Time: " + clock,
		"Mode: " + meetingMode(mode),
	}
	if place := strings.TrimSpace(location); place != "" {
		label := "Meeting link: "
		if mode == "in_person" {
			label = "Location: "
		}
		lines = append(lines, label+place)
	}
	return strings.Join(lines, "\n")
}

func interviewScheduledNotification(mode string, at time.Time) string {
	date, clock := meetingWhen(at)
	return "Your verification interview is on " + date + " at " + clock + ", " + strings.ToLower(meetingMode(mode)) + ". The meeting details are in your Messages."
}

func interviewCancelledMessage(at time.Time) string {
	date, clock := meetingWhen(at)
	return "Verification interview cancelled\nThe interview on " + date + " at " + clock + " is cancelled. An administrator will contact you about the next step."
}

// deliverMeeting writes the notification and the matching message inside the
// caller's transaction, creating the administrator–user conversation when it
// does not exist yet.
func deliverMeeting(ctx context.Context, tx *sqlx.Tx, adminID, userID, kind, title, notificationBody, messageBody string) error {
	var conversationID string
	err := tx.GetContext(ctx, &conversationID, `SELECT x.conversation_id FROM conversation_participants x JOIN conversation_participants y ON y.conversation_id = x.conversation_id
		WHERE x.user_id = ? AND y.user_id = ? AND (SELECT COUNT(*) FROM conversation_participants z WHERE z.conversation_id = x.conversation_id) = 2 LIMIT 1`, adminID, userID)
	if errors.Is(err, sql.ErrNoRows) {
		conversationID = uuid.NewString()
		if _, err = tx.ExecContext(ctx, `INSERT INTO conversations (id, last_message_at) VALUES (?, UTC_TIMESTAMP(6))`, conversationID); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?), (?, ?)`, conversationID, adminID, conversationID, userID)
	}
	if err != nil {
		return err
	}
	id := uuid.NewString()
	if _, err = tx.ExecContext(ctx, `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)`, id, conversationID, adminID, messageBody); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE conversations SET last_message_at = UTC_TIMESTAMP(6) WHERE id = ?`, conversationID); err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, ?, ?, ?)`, id, userID, kind, title, notificationBody)
	return err
}

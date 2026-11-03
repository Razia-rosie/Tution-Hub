package workflow

import (
	"strings"
	"testing"
	"time"
)

func TestInterviewScheduledMessageCarriesTheMeetingDetails(t *testing.T) {
	at := time.Date(2026, 11, 5, 9, 30, 0, 0, time.UTC) // 3:30 PM in Bangladesh
	online := interviewScheduledMessage("online", " https://meet.example.test/abc ", " Bring your NID. ", at)
	for _, want := range []string{"Verification interview scheduled", "Purpose: verification interview", "Date: Thursday, 5 November 2026", "Time: 3:30 PM (Bangladesh time)", "Mode: Online", "Meeting link: https://meet.example.test/abc", "Instructions: Bring your NID.", "Please confirm"} {
		if !strings.Contains(online, want) {
			t.Errorf("online message lacks %q:\n%s", want, online)
		}
	}
	inPerson := interviewScheduledMessage("in_person", "TuitionHub office, Mirpur", "", at)
	if !strings.Contains(inPerson, "Mode: In person") || !strings.Contains(inPerson, "Location: TuitionHub office, Mirpur") {
		t.Errorf("in-person message:\n%s", inPerson)
	}
	if blank := interviewScheduledMessage("online", "  ", " ", at); strings.Contains(blank, "Meeting link") || strings.Contains(blank, "Location") || strings.Contains(blank, "Instructions") {
		t.Errorf("an empty link must not be shown:\n%s", blank)
	}
	if n := interviewScheduledNotification("online", at); !strings.Contains(n, "Thursday, 5 November 2026 at 3:30 PM") || !strings.Contains(n, "Messages") {
		t.Errorf("notification: %s", n)
	}
	if c := interviewCancelledMessage(at); !strings.Contains(c, "cancelled") || !strings.Contains(c, "5 November 2026") {
		t.Errorf("cancellation: %s", c)
	}
	if r := interviewRescheduledMessage("online", "https://meet.example.test/new", "", at); !strings.Contains(r, "rescheduled") || !strings.Contains(r, "Meeting link: https://meet.example.test/new") || !strings.Contains(r, "confirm the new time") {
		t.Errorf("reschedule: %s", r)
	}
	if c := interviewCompletedMessage(at); !strings.Contains(c, "completed") || !strings.Contains(c, "does not approve") {
		t.Errorf("completed: %s", c)
	}
	if c := interviewConfirmedMessage(at); !strings.Contains(c, "confirm") || !strings.Contains(c, "3:30 PM") {
		t.Errorf("confirmed: %s", c)
	}
}

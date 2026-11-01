package auth

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"regexp"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestInitialAccountStatusIsPendingForEveryPublicRole(t *testing.T) {
	for _, role := range []string{"tutor", "coaching", "parent", "student"} {
		if got := InitialAccountStatus(role); got != "pending" {
			t.Errorf("%s starts %q, want pending", role, got)
		}
	}
}

func TestInvitationProblem(t *testing.T) {
	now := time.Now()
	past, future := now.Add(-time.Hour), now.Add(time.Hour)
	approved := sql.NullString{String: "approved", Valid: true}
	cases := []struct {
		name string
		row  invitationRow
		want string
	}{
		{"approved and in date", invitationRow{Status: "approved", ExpiresAt: &future, ParentStatus: "active", ParentVerification: approved}, ""},
		{"waiting for admin", invitationRow{Status: "pending_approval", ParentStatus: "active", ParentVerification: approved}, "pending_approval"},
		{"already used", invitationRow{Status: "registered", ParentStatus: "active", ParentVerification: approved}, "used"},
		{"refused", invitationRow{Status: "rejected", ParentStatus: "active", ParentVerification: approved}, "not_authorized"},
		{"cancelled by parent", invitationRow{Status: "cancelled", ParentStatus: "active", ParentVerification: approved}, "not_authorized"},
		{"expired", invitationRow{Status: "approved", ExpiresAt: &past, ParentStatus: "active", ParentVerification: approved}, "expired"},
		{"parent suspended since", invitationRow{Status: "approved", ExpiresAt: &future, ParentStatus: "suspended", ParentVerification: approved}, "not_authorized"},
		{"parent not approved", invitationRow{Status: "approved", ExpiresAt: &future, ParentStatus: "active", ParentVerification: sql.NullString{String: "pending", Valid: true}}, "not_authorized"},
	}
	for _, tc := range cases {
		if got := invitationProblem(tc.row, now); got != tc.want {
			t.Errorf("%s: got %q, want %q", tc.name, got, tc.want)
		}
	}
}

func TestStudentRegistrationWithoutInvitationIsRefused(t *testing.T) {
	r, mock := registerRouter(t)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT CAST(setting_value AS CHAR) FROM platform_settings")).WillReturnRows(sqlmock.NewRows([]string{"v"}))
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("FROM student_invitations i JOIN users p ON p.id = i.parent_id")).WithArgs("name-test@tuitionhub.test").WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()
	w := postRegisterAs(r, "Rafi Hasan", "student")
	var body map[string]string
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if w.Code != http.StatusForbidden || body["code"] != "invitation_not_invited" {
		t.Fatalf("want 403 invitation_not_invited, got %d %s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestStudentRegistrationWithUnapprovedInvitationIsRefused(t *testing.T) {
	r, mock := registerRouter(t)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT CAST(setting_value AS CHAR) FROM platform_settings")).WillReturnRows(sqlmock.NewRows([]string{"v"}))
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("FROM student_invitations i JOIN users p ON p.id = i.parent_id")).WithArgs("name-test@tuitionhub.test").
		WillReturnRows(sqlmock.NewRows([]string{"id", "parent_id", "relationship", "status", "expires_at", "parent_status", "parent_verification"}).AddRow("inv", "p", "mother", "pending_approval", nil, "active", "approved"))
	mock.ExpectRollback()
	w := postRegisterAs(r, "Rafi Hasan", "student")
	if w.Code != http.StatusForbidden || !regexp.MustCompile(`invitation_pending_approval`).MatchString(w.Body.String()) {
		t.Fatalf("want 403 invitation_pending_approval, got %d %s", w.Code, w.Body.String())
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

package workflow

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestSupportedImageTypes(t *testing.T) {
	for _, mimeType := range []string{"image/jpeg", "image/png", "image/webp"} {
		if !isSupportedImage(mimeType) {
			t.Errorf("expected %s to be accepted", mimeType)
		}
	}
	for _, mimeType := range []string{"application/pdf", "image/svg+xml", "text/plain", ""} {
		if isSupportedImage(mimeType) {
			t.Errorf("expected %s to be rejected", mimeType)
		}
	}
}

func TestNullIfEmpty(t *testing.T) {
	if value := nullIfEmpty("   "); value != nil {
		t.Fatalf("expected whitespace to become nil, got %v", value)
	}
	if value := nullIfEmpty("reason"); value != "reason" {
		t.Fatalf("expected reason to be preserved, got %v", value)
	}
}

func testWorkflowService(t *testing.T) (*Service, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	return NewService(sqlx.NewDb(db, "sqlmock"), t.TempDir()), mock, func() { _ = db.Close() }
}

func TestDecisionAccountStatus(t *testing.T) {
	cases := []struct {
		decision   string
		completion uint8
		want       string
	}{
		{"approved", 100, "active"},
		{"approved", 80, "profile_incomplete"},
		{"rejected", 100, "rejected"},
		{"resubmission_required", 100, "resubmission_required"},
	}
	for _, tc := range cases {
		if got := decisionAccountStatus(tc.decision, tc.completion); got != tc.want {
			t.Errorf("decisionAccountStatus(%q, %d) = %q, want %q", tc.decision, tc.completion, got, tc.want)
		}
	}
}

func TestReviewVerificationRequiresReasonBeforeTouchingDatabase(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	for _, decision := range []string{"rejected", "resubmission_required"} {
		if err := service.ReviewVerification(context.Background(), "admin", "app", decision, "too short"); !errors.Is(err, ErrInvalidState) {
			t.Fatalf("%s without reason: expected ErrInvalidState, got %v", decision, err)
		}
	}
	if err := service.ReviewVerification(context.Background(), "admin", "app", "maybe", ""); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("unknown decision: expected ErrInvalidState, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestReviewVerificationRejectsDecidedApplication(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT user_id, status FROM verification_applications WHERE id = ? FOR UPDATE")).
		WithArgs("app").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "status"}).AddRow("user", "approved"))
	mock.ExpectRollback()
	if err := service.ReviewVerification(context.Background(), "admin", "app", "approved", ""); !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestSubmitVerificationRefusesApprovedAccount(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT account_status FROM users WHERE id = ? FOR UPDATE")).
		WithArgs("user").
		WillReturnRows(sqlmock.NewRows([]string{"account_status"}).AddRow("profile_incomplete"))
	mock.ExpectRollback()
	if _, err := service.SubmitVerification(context.Background(), "user"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("expected ErrInvalidState, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestListVerificationsScansJSONColumns(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	columns := []string{"id", "user_id", "status", "submitted_at", "reviewed_at", "rejection_reason", "correction_request", "name", "email", "role", "account_status", "profile", "interviews"}
	mock.ExpectQuery(`AS profile, .* AS interviews .* WHERE v\.status = \?`).
		WithArgs("pending").
		WillReturnRows(sqlmock.NewRows(columns).AddRow("app", "user", "pending", nil, nil, nil, nil, "Tanvir", "t@example.com", "tutor", "pending", []byte(`{"education":"BSc"}`), []byte(`[]`)))
	rows, err := service.ListVerifications(context.Background(), "pending", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || string(rows[0].Profile) != `{"education":"BSc"}` || string(rows[0].Interviews) != `[]` {
		t.Fatalf("unexpected rows: %+v", rows)
	}
}

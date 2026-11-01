package workflow

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestValidChildEmail(t *testing.T) {
	for _, ok := range []string{"child@example.com", "a.b+c@school.edu.bd"} {
		if !validEmail(ok) {
			t.Errorf("%q should be valid", ok)
		}
	}
	for _, bad := range []string{"", "child", "child@", "child@localhost", "Child <c@example.com>", "c@example.com x"} {
		if validEmail(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}

func parentRow(role, email, status string, verification any) *sqlmock.Rows {
	return sqlmock.NewRows([]string{"role", "email", "account_status", "verification"}).AddRow(role, email, status, verification)
}

const parentLock = "SELECT u.role, u.email, u.account_status, v.status AS verification FROM users u LEFT JOIN verification_applications v ON v.user_id = u.id WHERE u.id = ? FOR UPDATE"

func TestCreateInvitationRefusesBadInputBeforeTouchingDatabase(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	if _, err := service.CreateInvitation(context.Background(), "p", "not-an-email", "", "mother"); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("expected ErrInvalidState, got %v", err)
	}
	if _, err := service.CreateInvitation(context.Background(), "p", "child@example.com", "", "  "); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("relationship is required, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestCreateInvitationRules(t *testing.T) {
	cases := []struct {
		name         string
		role, status string
		verification any
		childEmail   string
		want         error
	}{
		{"students cannot invite", "student", "active", "approved", "c@example.com", ErrForbidden},
		{"parent must submit verification first", "parent", "pending", nil, "c@example.com", ErrParentNotApproved},
		{"draft is not submitted", "parent", "pending", "draft", "c@example.com", ErrParentNotApproved},
		{"rejected parent cannot invite", "parent", "rejected", "rejected", "c@example.com", ErrParentNotApproved},
		{"suspended parent cannot invite", "parent", "suspended", "approved", "c@example.com", ErrParentNotApproved},
		{"child email cannot be the parent's own", "parent", "pending", "pending", "parent@example.com", ErrEmailUnavailable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			service, mock, closeDB := testWorkflowService(t)
			defer closeDB()
			mock.ExpectBegin()
			mock.ExpectQuery(regexp.QuoteMeta(parentLock)).WithArgs("p").WillReturnRows(parentRow(tc.role, "parent@example.com", tc.status, tc.verification))
			mock.ExpectRollback()
			if _, err := service.CreateInvitation(context.Background(), "p", tc.childEmail, "Child", "mother"); !errors.Is(err, tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, err)
			}
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestCreateInvitationRefusesEmailOfExistingAccount(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(parentLock)).WithArgs("p").WillReturnRows(parentRow("parent", "parent@example.com", "active", "approved"))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM student_invitations WHERE parent_id = ?")).WithArgs("p").WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM users WHERE email = ?")).WithArgs("taken@example.com").WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(1))
	mock.ExpectRollback()
	if _, err := service.CreateInvitation(context.Background(), "p", " Taken@Example.com ", "", "father"); !errors.Is(err, ErrEmailUnavailable) {
		t.Fatalf("expected ErrEmailUnavailable, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestCreateInvitationRefusesLiveInvitationOfAnotherParent(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(parentLock)).WithArgs("p").WillReturnRows(parentRow("parent", "parent@example.com", "active", "approved"))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM student_invitations WHERE parent_id = ?")).WithArgs("p").WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM users WHERE email = ?")).WithArgs("child@example.com").WillReturnRows(sqlmock.NewRows([]string{"n"}).AddRow(0))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT id, parent_id, status, expires_at FROM student_invitations WHERE child_email = ? FOR UPDATE")).WithArgs("child@example.com").
		WillReturnRows(sqlmock.NewRows([]string{"id", "parent_id", "status", "expires_at"}).AddRow("inv", "other-parent", "pending_approval", nil))
	mock.ExpectRollback()
	if _, err := service.CreateInvitation(context.Background(), "p", "child@example.com", "", "father"); !errors.Is(err, ErrEmailUnavailable) {
		t.Fatalf("expected ErrEmailUnavailable, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

const invitationLock = "SELECT i.parent_id, i.status, i.child_email, i.expires_at, p.account_status AS parent_status, pv.status AS parent_verification FROM student_invitations i"

func TestReviewInvitationNeedsReasonToReject(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	for _, decision := range []string{"maybe", "rejected"} {
		if err := service.ReviewInvitation(context.Background(), "admin", "inv", decision, "short"); !errors.Is(err, ErrInvalidState) {
			t.Fatalf("%s: expected ErrInvalidState, got %v", decision, err)
		}
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestReviewInvitationRequiresApprovedParent(t *testing.T) {
	for _, tc := range []struct{ status, verification string }{{"pending", "pending"}, {"rejected", "rejected"}, {"active", "pending"}, {"resubmission_required", "resubmission_required"}} {
		service, mock, closeDB := testWorkflowService(t)
		mock.ExpectBegin()
		mock.ExpectQuery(regexp.QuoteMeta(invitationLock)).WithArgs("inv").
			WillReturnRows(sqlmock.NewRows([]string{"parent_id", "status", "child_email", "expires_at", "parent_status", "parent_verification"}).AddRow("p", "pending_approval", "c@example.com", nil, tc.status, tc.verification))
		mock.ExpectRollback()
		if err := service.ReviewInvitation(context.Background(), "admin", "inv", "approved", ""); !errors.Is(err, ErrParentNotApproved) {
			t.Fatalf("parent %s/%s: expected ErrParentNotApproved, got %v", tc.status, tc.verification, err)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatal(err)
		}
		closeDB()
	}
}

func TestReviewInvitationRefusesUsedInvitation(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(invitationLock)).WithArgs("inv").
		WillReturnRows(sqlmock.NewRows([]string{"parent_id", "status", "child_email", "expires_at", "parent_status", "parent_verification"}).AddRow("p", "registered", "c@example.com", nil, "active", "approved"))
	mock.ExpectRollback()
	if err := service.ReviewInvitation(context.Background(), "admin", "inv", "rejected", "This request was a duplicate."); !errors.Is(err, ErrConflict) {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
}

func TestStudentCannotBeApprovedBeforeParent(t *testing.T) {
	service, mock, closeDB := testWorkflowService(t)
	defer closeDB()
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT v.user_id, v.status, u.role FROM verification_applications v")).WithArgs("app").
		WillReturnRows(sqlmock.NewRows([]string{"user_id", "status", "role"}).AddRow("student", "pending", "student"))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COALESCE((SELECT completion_percent")).WithArgs("student").WillReturnRows(sqlmock.NewRows([]string{"c"}).AddRow(0))
	mock.ExpectQuery(regexp.QuoteMeta("SELECT i.parent_id, p.account_status AS parent_status")).WithArgs("student").
		WillReturnRows(sqlmock.NewRows([]string{"parent_id", "parent_status", "parent_verification"}).AddRow("p", "pending", "pending"))
	mock.ExpectRollback()
	if err := service.ReviewVerification(context.Background(), "admin", "app", "approved", ""); !errors.Is(err, ErrParentNotApproved) {
		t.Fatalf("expected ErrParentNotApproved, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

package auth

import (
	"context"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"

	"github.com/tuitionhub/backend/internal/config"
)

func testAuthService(t *testing.T) (*Service, sqlmock.Sqlmock, func()) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	return NewService(sqlx.NewDb(db, "sqlmock"), config.Config{}), mock, func() { _ = db.Close() }
}

func TestBootstrapAdminRefusesWhenAdminExists(t *testing.T) {
	service, mock, closeDB := testAuthService(t)
	defer closeDB()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT GET_LOCK('tuitionhub_initial_admin_bootstrap', 10)")).
		WillReturnRows(sqlmock.NewRows([]string{"GET_LOCK"}).AddRow(1))
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM users WHERE role = 'admin'")).
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectRollback()
	mock.ExpectExec(regexp.QuoteMeta("SELECT RELEASE_LOCK('tuitionhub_initial_admin_bootstrap')")).
		WillReturnResult(sqlmock.NewResult(0, 1))

	_, err := service.BootstrapAdmin(context.Background(), "Existing Admin", "admin@example.com", "correct horse battery staple")
	if err != ErrAdminExists {
		t.Fatalf("expected ErrAdminExists, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestBootstrapAdminSecondAttemptIsRefused(t *testing.T) {
	service, mock, closeDB := testAuthService(t)
	defer closeDB()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT GET_LOCK('tuitionhub_initial_admin_bootstrap', 10)")).
		WillReturnRows(sqlmock.NewRows([]string{"GET_LOCK"}).AddRow(1))
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM users WHERE role = 'admin'")).
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(0))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO users (id, name, email, password_hash, role, account_status, email_verified_at) VALUES (?, ?, ?, ?, 'admin', 'active', UTC_TIMESTAMP(6)")).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()
	mock.ExpectExec(regexp.QuoteMeta("SELECT RELEASE_LOCK('tuitionhub_initial_admin_bootstrap')")).
		WillReturnResult(sqlmock.NewResult(0, 1))
	if _, err := service.BootstrapAdmin(context.Background(), "Initial Admin", "admin@example.com", "correct horse battery staple"); err != nil {
		t.Fatal(err)
	}

	mock.ExpectQuery(regexp.QuoteMeta("SELECT GET_LOCK('tuitionhub_initial_admin_bootstrap', 10)")).
		WillReturnRows(sqlmock.NewRows([]string{"GET_LOCK"}).AddRow(1))
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM users WHERE role = 'admin'")).
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(1))
	mock.ExpectRollback()
	mock.ExpectExec(regexp.QuoteMeta("SELECT RELEASE_LOCK('tuitionhub_initial_admin_bootstrap')")).
		WillReturnResult(sqlmock.NewResult(0, 1))
	if _, err := service.BootstrapAdmin(context.Background(), "Initial Admin", "admin@example.com", "correct horse battery staple"); err != ErrAdminExists {
		t.Fatalf("expected second bootstrap to return ErrAdminExists, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestBootstrapAdminValidatesInputBeforeDatabaseAccess(t *testing.T) {
	service, mock, closeDB := testAuthService(t)
	defer closeDB()

	_, err := service.BootstrapAdmin(context.Background(), "Admin", "not-an-email", "correct horse battery staple")
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestBootstrapAdminRefusesExistingEmail(t *testing.T) {
	service, mock, closeDB := testAuthService(t)
	defer closeDB()

	mock.ExpectQuery(regexp.QuoteMeta("SELECT GET_LOCK('tuitionhub_initial_admin_bootstrap', 10)")).
		WillReturnRows(sqlmock.NewRows([]string{"GET_LOCK"}).AddRow(1))
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta("SELECT COUNT(*) FROM users WHERE role = 'admin'")).
		WillReturnRows(sqlmock.NewRows([]string{"COUNT(*)"}).AddRow(0))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO users (id, name, email, password_hash, role, account_status, email_verified_at) VALUES (?, ?, ?, ?, 'admin', 'active', UTC_TIMESTAMP(6)")).
		WillReturnError(errors.New("Duplicate entry for key users.email"))
	mock.ExpectRollback()
	mock.ExpectExec(regexp.QuoteMeta("SELECT RELEASE_LOCK('tuitionhub_initial_admin_bootstrap')")).
		WillReturnResult(sqlmock.NewResult(0, 1))

	_, err := service.BootstrapAdmin(context.Background(), "Initial Admin", "existing@example.com", "correct horse battery staple")
	if err != ErrConflict {
		t.Fatalf("expected ErrConflict, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/jmoiron/sqlx"

	"github.com/tuitionhub/backend/internal/config"
)

func registerRouter(t *testing.T) (*gin.Engine, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	gin.SetMode(gin.TestMode)
	cfg := config.Config{JWTSecret: strings.Repeat("r", 40), AccessTokenTTL: time.Minute, RefreshTokenTTL: time.Hour}
	r := gin.New()
	r.POST("/register", register(NewService(sqlx.NewDb(db, "sqlmock"), cfg)))
	return r, mock
}

func postRegister(r *gin.Engine, name string) *httptest.ResponseRecorder {
	body, _ := json.Marshal(map[string]string{"name": name, "email": "name-test@tuitionhub.test", "password": "unit-test-pass-1", "role": "student"})
	req := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// expectAccountCreated expects the inserts of a successful registration and
// checks that the stored name is exactly want.
func expectAccountCreated(mock sqlmock.Sqlmock, want string) {
	mock.ExpectQuery(regexp.QuoteMeta("SELECT CAST(setting_value AS CHAR) FROM platform_settings")).WillReturnRows(sqlmock.NewRows([]string{"v"}))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO users (id, name, email, phone, password_hash, role, account_status)")).
		WithArgs(sqlmock.AnyArg(), want, "name-test@tuitionhub.test", nil, sqlmock.AnyArg(), "student", "active").
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO refresh_tokens")).WillReturnResult(sqlmock.NewResult(1, 1))
}

func TestRegisterRejectsBlankNamesBeforeTouchingDatabase(t *testing.T) {
	for _, name := range []string{"     ", "\t\n ", " A ", "", "B"} {
		r, mock := registerRouter(t)
		if w := postRegister(r, name); w.Code != http.StatusBadRequest || !strings.Contains(w.Body.String(), "invalid request") {
			t.Errorf("name %q: want 400 invalid request, got %d %s", name, w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("name %q reached the database: %v", name, err)
		}
	}
}

func TestRegisterStoresTrimmedName(t *testing.T) {
	r, mock := registerRouter(t)
	expectAccountCreated(mock, "Rafi Hasan")
	w := postRegister(r, "   Rafi Hasan \t")
	if w.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d %s", w.Code, w.Body.String())
	}
	var out struct {
		User struct {
			Name string `json:"name"`
		} `json:"user"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out.User.Name != "Rafi Hasan" {
		t.Fatalf("response name = %q, want the trimmed name", out.User.Name)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestRegisterNameLengthRuleIsUnchangedForValidNames(t *testing.T) {
	accepted := map[string]string{
		"Al":                                  "Al",                     // minimum 2
		strings.Repeat("N", 120):              strings.Repeat("N", 120), // maximum 120
		"  " + strings.Repeat("N", 120) + " ": strings.Repeat("N", 120), // padding does not count
		"রাফি হাসান":                          "রাফি হাসান",
		"Mary-Jane O'Neil":                    "Mary-Jane O'Neil",
	}
	for input, stored := range accepted {
		r, mock := registerRouter(t)
		expectAccountCreated(mock, stored)
		if w := postRegister(r, input); w.Code != http.StatusCreated {
			t.Errorf("name %q: want 201, got %d %s", input, w.Code, w.Body.String())
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Errorf("name %q: %v", input, err)
		}
	}
	r, _ := registerRouter(t)
	if w := postRegister(r, strings.Repeat("N", 121)); w.Code != http.StatusBadRequest {
		t.Errorf("121 characters: want 400, got %d", w.Code)
	}
}

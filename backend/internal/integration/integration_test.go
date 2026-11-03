//go:build integration

// Package integration exercises the real router against a real MySQL database.
//
//	E2E_DATABASE_URL='tuitionhub:...@tcp(127.0.0.1:3306)/tuitionhub_e2e?parseTime=true&charset=utf8mb4&loc=UTC' \
//	E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... go test -tags integration ./internal/integration
//
// It creates accounts and decisions, so it refuses to run unless the database
// name ends in _e2e.
package integration

import (
	"bytes"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"github.com/jmoiron/sqlx"

	"github.com/tuitionhub/backend/internal/auth"
	"github.com/tuitionhub/backend/internal/config"
	"github.com/tuitionhub/backend/internal/filestore"
	"github.com/tuitionhub/backend/internal/workflow"
)

type env struct {
	t      *testing.T
	db     *sqlx.DB
	router *gin.Engine
	docDir string
	run    string
}

func setup(t *testing.T) *env {
	t.Helper()
	dsn := os.Getenv("E2E_DATABASE_URL")
	if dsn == "" {
		t.Skip("E2E_DATABASE_URL not set")
	}
	parsed, err := mysql.ParseDSN(dsn)
	if err != nil || !strings.HasSuffix(parsed.DBName, "_e2e") {
		t.Fatalf("refusing to run: database %q is not an _e2e database", parsed.DBName)
	}
	db, err := sqlx.Open("mysql", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	docDir := t.TempDir()
	cfg := config.Config{JWTSecret: strings.Repeat("i", 40), AccessTokenTTL: 15 * time.Minute, RefreshTokenTTL: time.Hour, RefreshReuseGrace: 0, DocumentDir: docDir, LoginLimitPerAccount: 5, LoginLimitPerIP: 1000, SignupLimitPerIP: 1000}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	authService := auth.NewService(db, cfg)
	auth.RegisterRoutes(r.Group("/api/v1"), authService)
	workflow.RegisterRoutes(r.Group("/api/v1"), authService, workflow.NewService(db, filestore.Disk{Dir: docDir}))
	return &env{t: t, db: db, router: r, docDir: docDir, run: fmt.Sprintf("%d", rand.Int63())}
}

type resp struct {
	Code int
	Body map[string]any
}

func (e *env) do(method, path, token string, body any) resp {
	e.t.Helper()
	var reader *bytes.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	} else {
		reader = bytes.NewReader(nil)
	}
	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "192.0.2.10:1234"
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	out := resp{Code: w.Code, Body: map[string]any{}}
	_ = json.Unmarshal(w.Body.Bytes(), &out.Body)
	return out
}

func (e *env) upload(token, docType string, content []byte) resp {
	e.t.Helper()
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	_ = mw.WriteField("document_type", docType)
	fw, _ := mw.CreateFormFile("document", docType+".png")
	_, _ = fw.Write(content)
	_ = mw.Close()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/workflow/verification/documents", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	e.router.ServeHTTP(w, req)
	out := resp{Code: w.Code, Body: map[string]any{}}
	_ = json.Unmarshal(w.Body.Bytes(), &out.Body)
	return out
}

type account struct{ id, access, refresh, email string }

func (e *env) register(label, role string) account {
	e.t.Helper()
	email := fmt.Sprintf("it-%s-%s@tuitionhub.test", label, e.run)
	r := e.do("POST", "/api/v1/auth/register", "", map[string]string{"name": "IT " + label, "email": email, "password": "integration-pass-1", "role": role})
	if r.Code != http.StatusCreated {
		e.t.Fatalf("register %s: %d %v", label, r.Code, r.Body)
	}
	tokens := r.Body["tokens"].(map[string]any)
	return account{id: r.Body["user"].(map[string]any)["id"].(string), access: tokens["access_token"].(string), refresh: tokens["refresh_token"].(string), email: email}
}

func (e *env) login(email, password string) account {
	e.t.Helper()
	r := e.do("POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": password})
	if r.Code != http.StatusOK {
		e.t.Fatalf("login %s: %d %v", email, r.Code, r.Body)
	}
	tokens := r.Body["tokens"].(map[string]any)
	return account{id: r.Body["user"].(map[string]any)["id"].(string), access: tokens["access_token"].(string), refresh: tokens["refresh_token"].(string), email: email}
}

func (e *env) admin() string {
	e.t.Helper()
	email, password := os.Getenv("E2E_ADMIN_EMAIL"), os.Getenv("E2E_ADMIN_PASSWORD")
	if email == "" {
		e.t.Skip("E2E_ADMIN_EMAIL not set")
	}
	r := e.do("POST", "/api/v1/auth/login", "", map[string]string{"email": email, "password": password})
	if r.Code != http.StatusOK {
		e.t.Fatalf("admin login: %d %v", r.Code, r.Body)
	}
	return r.Body["tokens"].(map[string]any)["access_token"].(string)
}

func pngBytes() []byte {
	img := image.NewRGBA(image.Rect(0, 0, 32, 32))
	img.Set(1, 1, color.RGBA{G: 255, A: 255})
	var b bytes.Buffer
	_ = png.Encode(&b, img)
	return b.Bytes()
}

func (e *env) applicationID(userID string) string {
	var id string
	if err := e.db.Get(&id, `SELECT id FROM verification_applications WHERE user_id = ?`, userID); err != nil {
		e.t.Fatal(err)
	}
	return id
}

func TestVerificationLifecyclePersistsConsistently(t *testing.T) {
	e := setup(t)
	adminToken := e.admin()
	tutor := e.register("tutor", "tutor")

	// Submission is refused until the required picture and profile exist.
	if r := e.do("POST", "/api/v1/workflow/verification/submit", tutor.access, nil); r.Code != http.StatusUnprocessableEntity {
		t.Fatalf("empty submit: want 422, got %d", r.Code)
	}
	if r := e.upload(tutor.access, "identity", pngBytes()); r.Code != http.StatusCreated {
		t.Fatalf("upload: %d %v", r.Code, r.Body)
	}
	var appStatus string
	_ = e.db.Get(&appStatus, `SELECT status FROM verification_applications WHERE user_id = ?`, tutor.id)
	if appStatus != "draft" {
		t.Fatalf("first upload should create a draft, got %q", appStatus)
	}
	e.do("PUT", "/api/v1/workflow/profile", tutor.access, map[string]any{"display_name": "IT", "education": "BSc", "subjects": []string{"Math"}, "classes": []string{"9"}, "areas": []string{"Mirpur"}})
	if r := e.do("POST", "/api/v1/workflow/verification/submit", tutor.access, nil); r.Code != http.StatusAccepted {
		t.Fatalf("submit: %d %v", r.Code, r.Body)
	}
	// Evidence is frozen during review.
	if r := e.upload(tutor.access, "identity", pngBytes()); r.Code != http.StatusConflict {
		t.Fatalf("upload during review: want 409, got %d", r.Code)
	}
	if r := e.do("PUT", "/api/v1/workflow/profile", tutor.access, map[string]any{"education": "changed"}); r.Code != http.StatusConflict {
		t.Fatalf("profile edit during review: want 409, got %d", r.Code)
	}

	app := e.applicationID(tutor.id)
	if r := e.do("POST", "/api/v1/workflow/admin/verifications/"+app+"/decision", adminToken, map[string]string{"decision": "approved"}); r.Code != http.StatusNoContent {
		t.Fatalf("approve: %d %v", r.Code, r.Body)
	}

	// Database integrity after the decision.
	var row struct {
		Status     string     `db:"status"`
		ReviewedAt *time.Time `db:"reviewed_at"`
		ReviewerID *string    `db:"reviewer_id"`
		Submitted  *time.Time `db:"submitted_at"`
		Account    string     `db:"account_status"`
	}
	if err := e.db.Get(&row, `SELECT v.status, v.reviewed_at, v.reviewer_id, v.submitted_at, u.account_status FROM verification_applications v JOIN users u ON u.id = v.user_id WHERE v.id = ?`, app); err != nil {
		t.Fatal(err)
	}
	if row.Status != "approved" || row.ReviewedAt == nil || row.ReviewerID == nil || row.Submitted == nil || row.Account != "active" {
		t.Fatalf("inconsistent approved application: %+v", row)
	}
	var actions []string
	_ = e.db.Select(&actions, `SELECT action FROM audit_logs WHERE subject_user_id = ? ORDER BY created_at`, tutor.id)
	for _, want := range []string{"document_uploaded", "verification_submitted", "verification_approved"} {
		if !strings.Contains(strings.Join(actions, ","), want) {
			t.Errorf("audit log missing %s: %v", want, actions)
		}
	}
	// Every stored document row has its file on disk with owner-only permissions.
	var keys []string
	_ = e.db.Select(&keys, `SELECT storage_key FROM verification_documents WHERE application_id = ?`, app)
	if len(keys) != 1 {
		t.Fatalf("want 1 document row, got %d", len(keys))
	}
	info, err := os.Stat(filepath.Join(e.docDir, keys[0]))
	if err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("document file missing or too permissive: %v %v", err, info)
	}
	entries, _ := os.ReadDir(e.docDir)
	if len(entries) != 1 {
		t.Fatalf("replaced or rejected uploads left %d files on disk", len(entries))
	}
}

// DEF-03: the name is trimmed before validation, so blank names are refused
// instead of being stored empty, and surrounding whitespace is not stored.
func TestRegistrationNormalizesNames(t *testing.T) {
	e := setup(t)
	reg := func(label, name string) resp {
		email := fmt.Sprintf("it-name-%s-%s@tuitionhub.test", label, e.run)
		return e.do("POST", "/api/v1/auth/register", "", map[string]string{"name": name, "email": email, "password": "integration-pass-1", "role": "parent"})
	}
	stored := func(label string) (string, bool) {
		var name string
		err := e.db.Get(&name, `SELECT name FROM users WHERE email = ?`, fmt.Sprintf("it-name-%s-%s@tuitionhub.test", label, e.run))
		return name, err == nil
	}
	for label, name := range map[string]string{"blank": "     ", "tabs": "\t \n", "onechar": "  A  "} {
		if r := reg(label, name); r.Code != http.StatusBadRequest {
			t.Errorf("%s name: want 400, got %d %v", label, r.Code, r.Body)
		}
		if _, exists := stored(label); exists {
			t.Errorf("%s name: an account was created", label)
		}
	}
	if r := reg("padded", "   Nabila Islam  "); r.Code != http.StatusCreated {
		t.Fatalf("padded name: want 201, got %d %v", r.Code, r.Body)
	} else if got := r.Body["user"].(map[string]any)["name"]; got != "Nabila Islam" {
		t.Errorf("padded name in response = %q", got)
	}
	if name, _ := stored("padded"); name != "Nabila Islam" {
		t.Errorf("padded name stored as %q", name)
	}
	if r := reg("valid", "Rafi Hasan"); r.Code != http.StatusCreated {
		t.Errorf("valid name: want 201, got %d", r.Code)
	}
	if name, _ := stored("valid"); name != "Rafi Hasan" {
		t.Errorf("valid name stored as %q", name)
	}
	var empty int
	if err := e.db.Get(&empty, `SELECT COUNT(*) FROM users WHERE email LIKE ? AND CHAR_LENGTH(TRIM(name)) < 2`, fmt.Sprintf("it-name-%%-%s@tuitionhub.test", e.run)); err != nil || empty != 0 {
		t.Errorf("accounts with blank names created by this test: %d (%v)", empty, err)
	}
}

func TestGlobalIntegrityInvariants(t *testing.T) {
	e := setup(t)
	checks := map[string]string{
		"pending or decided applications without submitted_at":                             `SELECT COUNT(*) FROM verification_applications WHERE status NOT IN ('draft') AND submitted_at IS NULL`,
		"decided applications without reviewer or time":                                    `SELECT COUNT(*) FROM verification_applications WHERE status IN ('approved','rejected','resubmission_required') AND (reviewed_at IS NULL OR reviewer_id IS NULL)`,
		"applications owned by admins":                                                     `SELECT COUNT(*) FROM verification_applications v JOIN users u ON u.id = v.user_id WHERE u.role = 'admin'`,
		"registered invitations without a student":                                         `SELECT COUNT(*) FROM student_invitations WHERE status = 'registered' AND student_id IS NULL`,
		"approved students whose inviting parent is not approved":                          `SELECT COUNT(*) FROM student_invitations i JOIN verification_applications sv ON sv.user_id = i.student_id AND sv.status = 'approved' LEFT JOIN verification_applications pv ON pv.user_id = i.parent_id WHERE COALESCE(pv.status, '') <> 'approved'`,
		"documents whose application is missing":                                           `SELECT COUNT(*) FROM verification_documents d LEFT JOIN verification_applications v ON v.id = d.application_id WHERE v.id IS NULL`,
		"suspended users with live refresh sessions":                                       `SELECT COUNT(*) FROM refresh_tokens t JOIN users u ON u.id = t.user_id WHERE u.account_status = 'suspended' AND t.revoked_at IS NULL AND t.expires_at > UTC_TIMESTAMP(6)`,
		"approved applications whose account is not active, suspended or awaiting profile": `SELECT COUNT(*) FROM verification_applications v JOIN users u ON u.id = v.user_id WHERE v.status = 'approved' AND u.account_status NOT IN ('active','suspended','profile_incomplete')`,
		"refresh tokens without a session":                                                 `SELECT COUNT(*) FROM refresh_tokens WHERE session_id IS NULL`,
		"documents with malformed hashes":                                                  `SELECT COUNT(*) FROM verification_documents WHERE sha256 NOT REGEXP '^[0-9a-f]{64}$'`,
	}
	for name, query := range checks {
		var n int
		if err := e.db.Get(&n, query); err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if n != 0 {
			t.Errorf("%s: %d rows", name, n)
		}
	}
}

func TestSecurityControls(t *testing.T) {
	e := setup(t)
	adminToken := e.admin()

	t.Run("login is rate limited per account", func(t *testing.T) {
		victim := e.register("ratelimit", "parent")
		codes := []int{}
		for i := 0; i < 6; i++ {
			codes = append(codes, e.do("POST", "/api/v1/auth/login", "", map[string]string{"email": victim.email, "password": "wrong-password-x"}).Code)
		}
		if codes[4] != http.StatusUnauthorized || codes[5] != http.StatusTooManyRequests {
			t.Fatalf("want five 401s then 429, got %v", codes)
		}
		// Even the right password is refused while locked out.
		if r := e.do("POST", "/api/v1/auth/login", "", map[string]string{"email": victim.email, "password": "integration-pass-1"}); r.Code != http.StatusTooManyRequests {
			t.Fatalf("correct password during lockout: want 429, got %d", r.Code)
		}
	})

	t.Run("refresh token reuse ends every session", func(t *testing.T) {
		u := e.register("reuse", "parent")
		first := e.do("POST", "/api/v1/auth/refresh", "", map[string]string{"refresh_token": u.refresh})
		if first.Code != http.StatusOK {
			t.Fatalf("refresh: %d", first.Code)
		}
		fresh := first.Body["tokens"].(map[string]any)["refresh_token"].(string)
		if r := e.do("POST", "/api/v1/auth/refresh", "", map[string]string{"refresh_token": u.refresh}); r.Code != http.StatusUnauthorized {
			t.Fatalf("replayed token: want 401, got %d", r.Code)
		}
		if r := e.do("POST", "/api/v1/auth/refresh", "", map[string]string{"refresh_token": fresh}); r.Code != http.StatusUnauthorized {
			t.Fatalf("token issued before the replay should be revoked, got %d", r.Code)
		}
	})

	// DEF-02: access tokens are bound to their session, so ending the session
	// rejects them immediately instead of after the 15-minute expiry.
	t.Run("logout rejects the session's access token at once", func(t *testing.T) {
		u := e.register("logout", "parent")
		other := e.login(u.email, "integration-pass-1")
		if r := e.do("GET", "/api/v1/auth/me", u.access, nil); r.Code != http.StatusOK {
			t.Fatalf("token before logout: want 200, got %d", r.Code)
		}
		if r := e.do("POST", "/api/v1/auth/logout", "", map[string]string{"refresh_token": u.refresh}); r.Code != http.StatusNoContent {
			t.Fatalf("logout: %d %v", r.Code, r.Body)
		}
		for _, path := range []string{"/api/v1/auth/me", "/api/v1/workflow/dashboard"} {
			if r := e.do("GET", path, u.access, nil); r.Code != http.StatusUnauthorized {
				t.Fatalf("%s with logged-out token: want 401, got %d", path, r.Code)
			}
		}
		if r := e.do("POST", "/api/v1/auth/refresh", "", map[string]string{"refresh_token": u.refresh}); r.Code != http.StatusUnauthorized {
			t.Fatalf("refresh after logout: want 401, got %d", r.Code)
		}
		if r := e.do("GET", "/api/v1/auth/me", other.access, nil); r.Code != http.StatusOK {
			t.Fatalf("logout must not end the account's other sessions, got %d", r.Code)
		}
		again := e.login(u.email, "integration-pass-1")
		if r := e.do("GET", "/api/v1/workflow/dashboard", again.access, nil); r.Code != http.StatusOK {
			t.Fatalf("token from a new login: want 200, got %d", r.Code)
		}
	})

	t.Run("password reset rejects every earlier access token", func(t *testing.T) {
		u := e.register("reset", "parent")
		other := e.login(u.email, "integration-pass-1")
		forgot := e.do("POST", "/api/v1/auth/forgot-password", "", map[string]string{"email": u.email})
		resetToken, _ := forgot.Body["development_token"].(string)
		if forgot.Code != http.StatusAccepted || resetToken == "" {
			t.Fatalf("forgot-password: %d %v", forgot.Code, forgot.Body)
		}
		if r := e.do("POST", "/api/v1/auth/reset-password", "", map[string]string{"token": resetToken, "new_password": "integration-pass-2"}); r.Code != http.StatusOK {
			t.Fatalf("reset: %d %v", r.Code, r.Body)
		}
		for _, token := range []string{u.access, other.access} {
			if r := e.do("GET", "/api/v1/workflow/dashboard", token, nil); r.Code != http.StatusUnauthorized {
				t.Fatalf("token issued before the reset: want 401, got %d", r.Code)
			}
		}
		fresh := e.login(u.email, "integration-pass-2")
		if r := e.do("GET", "/api/v1/auth/me", fresh.access, nil); r.Code != http.StatusOK {
			t.Fatalf("token after login with the new password: want 200, got %d", r.Code)
		}
	})

	t.Run("refresh keeps the session alive", func(t *testing.T) {
		u := e.register("rotate", "parent")
		r := e.do("POST", "/api/v1/auth/refresh", "", map[string]string{"refresh_token": u.refresh})
		if r.Code != http.StatusOK {
			t.Fatalf("refresh: %d", r.Code)
		}
		rotated := r.Body["tokens"].(map[string]any)["access_token"].(string)
		for _, token := range []string{u.access, rotated} {
			if r := e.do("GET", "/api/v1/auth/me", token, nil); r.Code != http.StatusOK {
				t.Fatalf("rotation must not end the session, got %d", r.Code)
			}
		}
	})

	t.Run("access tokens without a session are refused", func(t *testing.T) {
		u := e.register("nosid", "parent")
		claims := jwt.MapClaims{"sub": u.id, "role": "parent", "iat": time.Now().Unix(), "exp": time.Now().Add(time.Minute).Unix()}
		legacy, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(strings.Repeat("i", 40)))
		if r := e.do("GET", "/api/v1/auth/me", legacy, nil); r.Code != http.StatusUnauthorized {
			t.Fatalf("token without sid: want 401, got %d", r.Code)
		}
	})

	t.Run("suspension blocks existing tokens immediately", func(t *testing.T) {
		u := e.register("suspend", "tutor")
		if r := e.do("POST", "/api/v1/workflow/admin/users/"+u.id+"/suspend", adminToken, map[string]string{"reason": "Integration test suspension"}); r.Code != http.StatusNoContent {
			t.Fatalf("suspend: %d %v", r.Code, r.Body)
		}
		if r := e.do("GET", "/api/v1/workflow/dashboard", u.access, nil); r.Code != http.StatusForbidden {
			t.Fatalf("access token after suspension: want 403, got %d", r.Code)
		}
		if r := e.do("POST", "/api/v1/auth/refresh", "", map[string]string{"refresh_token": u.refresh}); r.Code == http.StatusOK {
			t.Fatal("refresh after suspension must fail")
		}
		if r := e.do("POST", "/api/v1/auth/login", "", map[string]string{"email": u.email, "password": "integration-pass-1"}); r.Code != http.StatusForbidden {
			t.Fatalf("login while suspended: want 403, got %d", r.Code)
		}
		if r := e.do("POST", "/api/v1/workflow/admin/users/"+u.id+"/reactivate", adminToken, nil); r.Code != http.StatusNoContent {
			t.Fatalf("reactivate: %d", r.Code)
		}
		var status string
		_ = e.db.Get(&status, `SELECT account_status FROM users WHERE id = ?`, u.id)
		if status != "pending" {
			t.Fatalf("reactivation should restore the previous status, got %q", status)
		}
	})

	t.Run("family verification uses its own documents and invitations", func(t *testing.T) {
		parent := e.register("family-parent", "parent")
		if r := e.upload(parent.access, "identity", pngBytes()); r.Code != http.StatusBadRequest {
			t.Errorf("parent uploading a tutor document type: want 400, got %d", r.Code)
		}
		if r := e.upload(parent.access, "parent_nid", pngBytes()); r.Code != http.StatusCreated {
			t.Errorf("parent NID upload: want 201, got %d", r.Code)
		}
		if r := e.do("POST", "/api/v1/workflow/verification/submit", parent.access, nil); r.Code != http.StatusUnprocessableEntity {
			t.Errorf("parent submit without the child's birth certificate: want 422, got %d", r.Code)
		}
		email := fmt.Sprintf("it-child-%s@tuitionhub.test", e.run)
		if r := e.do("POST", "/api/v1/workflow/family/invitations", parent.access, map[string]string{"child_email": email, "relationship": "mother"}); r.Code != http.StatusConflict {
			t.Errorf("invitation before submitting verification: want 409, got %d", r.Code)
		}
		if r := e.do("POST", "/api/v1/auth/register", "", map[string]string{"name": "Uninvited Child", "email": email, "password": "integration-pass-1", "role": "student"}); r.Code != http.StatusForbidden {
			t.Errorf("student without invitation: want 403, got %d", r.Code)
		}
	})

	t.Run("SQL metacharacters are data", func(t *testing.T) {
		r := e.do("GET", "/api/v1/workflow/admin/users?q="+url.QueryEscape("' OR 1=1 -- %"), adminToken, nil)
		if r.Code != http.StatusOK || r.Body["total"].(float64) != 0 {
			t.Fatalf("injection-shaped search should match nothing, got %d %v", r.Code, r.Body["total"])
		}
	})
}

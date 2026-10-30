// Package platform implements the marketplace, messaging, tuition agreements,
// classrooms, coaching management and platform administration on top of the
// auth and verification modules.
package platform

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/tuitionhub/backend/internal/workflow"
)

type Service struct {
	db       *sqlx.DB
	fileDir  string
	validate *validator.Validate
}

func NewService(db *sqlx.DB, documentDir string) *Service {
	return &Service{db: db, fileDir: filepath.Join(documentDir, "files"), validate: validator.New()}
}

// apiError carries an HTTP status and a message that is safe to show users.
type apiError struct {
	status int
	msg    string
}

func (e apiError) Error() string { return e.msg }

func badRequest(msg string) error { return apiError{http.StatusBadRequest, msg} }
func forbidden(msg string) error  { return apiError{http.StatusForbidden, msg} }
func notFound(msg string) error   { return apiError{http.StatusNotFound, msg} }
func conflict(msg string) error   { return apiError{http.StatusConflict, msg} }

// fail writes err as a JSON error response. Unknown errors are logged and hidden.
func fail(c *gin.Context, err error) {
	var api apiError
	switch {
	case errors.As(err, &api):
		c.AbortWithStatusJSON(api.status, gin.H{"error": api.msg})
	case errors.Is(err, sql.ErrNoRows):
		c.AbortWithStatusJSON(http.StatusNotFound, gin.H{"error": "not found"})
	default:
		slog.Error("request failed", "error", err, "method", c.Request.Method, "path", c.FullPath(), "user_id", uid(c))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "something went wrong; please try again"})
	}
}

func uid(c *gin.Context) string  { return c.GetString("user_id") }
func role(c *gin.Context) string { return c.GetString("role") }

// active reports whether the caller may use features restricted to verified or
// otherwise active accounts (tutors and coaching centres become active on approval).
func active(c *gin.Context) bool { return c.GetString("account_status") == "active" }

func requireRole(c *gin.Context, roles ...string) error {
	for _, r := range roles {
		if role(c) == r {
			return nil
		}
	}
	return forbidden("your account type cannot do this")
}

func requireActive(c *gin.Context) error {
	if !active(c) {
		return forbidden("your account must be verified and active to do this")
	}
	return nil
}

// bind decodes and validates a JSON body.
func (s *Service) bind(c *gin.Context, target any) error {
	if err := c.ShouldBindJSON(target); err != nil {
		return badRequest("invalid request body")
	}
	if err := s.validate.Struct(target); err != nil {
		var verrs validator.ValidationErrors
		if errors.As(err, &verrs) && len(verrs) > 0 {
			return badRequest("invalid or missing field: " + strings.ToLower(verrs[0].Field()))
		}
		return badRequest("invalid request")
	}
	return nil
}

func respond(c *gin.Context, status int, err error, body any) {
	if err != nil {
		fail(c, err)
		return
	}
	if body == nil {
		c.Status(status)
		return
	}
	c.JSON(status, body)
}

func queryInt(c *gin.Context, key string, fallback, max int) int {
	n, err := strconv.Atoi(c.Query(key))
	if err != nil || n < 0 {
		return fallback
	}
	if n > max {
		return max
	}
	return n
}

func likePattern(q string) string {
	return "%" + strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(strings.TrimSpace(q)) + "%"
}

func newID() string { return uuid.NewString() }

// notify stores a persistent notification. Failures are logged, never fatal:
// the action that triggered it already succeeded.
func (s *Service) notify(ctx context.Context, userID, kind, title, body string) {
	if userID == "" {
		return
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, ?, ?, ?)`, newID(), userID, kind, title, body); err != nil {
		slog.Error("notification failed", "kind", kind, "error", err)
	}
}

func (s *Service) audit(ctx context.Context, actorID, subjectID, action string, metadata map[string]any) {
	data, _ := json.Marshal(metadata)
	var subject any
	if subjectID != "" {
		subject = subjectID
	}
	if _, err := s.db.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, ?, ?)`, newID(), actorID, subject, action, data); err != nil {
		slog.Error("audit failed", "action", action, "error", err)
	}
}

func (s *Service) userName(ctx context.Context, id string) string {
	var name string
	_ = s.db.GetContext(ctx, &name, `SELECT name FROM users WHERE id = ?`, id)
	return name
}

func (s *Service) blocked(ctx context.Context, a, b string) bool {
	var n int
	_ = s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`, a, b, b, a)
	return n > 0
}

// ---------- private file storage (materials, submissions, profile photos) ----------

const maxFileBytes = 10 << 20

type storedFile struct {
	Key, Name, Mime string
}

// readUpload reads the multipart file field, if present, and validates it.
// allowPDF permits PDF documents in addition to JPEG/PNG/WebP pictures.
func (s *Service) readUpload(c *gin.Context, field string, allowPDF bool) (*storedFile, []byte, error) {
	file, header, err := c.Request.FormFile(field)
	if errors.Is(err, http.ErrMissingFile) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, badRequest("the file could not be read; files must be 10 MB or smaller")
	}
	defer file.Close()
	if header.Size <= 0 || header.Size > maxFileBytes {
		return nil, nil, badRequest("files must be 10 MB or smaller")
	}
	content := make([]byte, header.Size)
	if _, err := io.ReadFull(file, content); err != nil {
		return nil, nil, badRequest("the file could not be read")
	}
	mime, imgErr := workflow.ValidateImage(content)
	if imgErr != nil {
		if !allowPDF || !isPDF(content) {
			if allowPDF {
				return nil, nil, badRequest("only JPG, PNG, WebP pictures or PDF files are accepted")
			}
			return nil, nil, badRequest("only JPG, PNG or WebP pictures are accepted")
		}
		mime = "application/pdf"
	}
	name := filepath.Base(header.Filename)
	if len(name) > 200 {
		name = name[len(name)-200:]
	}
	return &storedFile{Key: newID(), Name: name, Mime: mime}, content, nil
}

func isPDF(content []byte) bool {
	return bytes.HasPrefix(content, []byte("%PDF-")) && http.DetectContentType(content) == "application/pdf" && bytes.Contains(content[max(0, len(content)-1024):], []byte("%%EOF"))
}

func (s *Service) saveFile(f *storedFile, content []byte) error {
	if err := os.MkdirAll(s.fileDir, 0o700); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.fileDir, f.Key), content, 0o600)
}

func (s *Service) removeFile(key string) {
	if key != "" {
		_ = os.Remove(filepath.Join(s.fileDir, filepath.Base(key)))
	}
}

// serveFile streams a stored file with headers that stop browsers caching,
// sniffing or executing it.
func (s *Service) serveFile(c *gin.Context, key, name, mime string) {
	path := filepath.Join(s.fileDir, filepath.Base(key))
	if _, err := os.Stat(path); err != nil {
		fail(c, notFound("file not found"))
		return
	}
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	c.Header("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox")
	c.Header("Content-Type", mime)
	disposition := "inline"
	if mime == "application/pdf" {
		disposition = "attachment"
	}
	c.Header("Content-Disposition", disposition+"; filename="+strconv.Quote(name))
	c.File(path)
}

func ptr[T any](v T) *T { return &v }

func nullable(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return strings.TrimSpace(s)
}

func parseDate(value string) (*time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	t, err := time.Parse("2006-01-02", value)
	if err != nil {
		return nil, badRequest("dates must be YYYY-MM-DD")
	}
	return &t, nil
}

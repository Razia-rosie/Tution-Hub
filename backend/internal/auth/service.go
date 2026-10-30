package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"golang.org/x/crypto/bcrypt"

	"github.com/tuitionhub/backend/internal/config"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidToken       = errors.New("invalid token")
	ErrConflict           = errors.New("account already exists")
	ErrAdminExists        = errors.New("an administrator already exists")
	ErrInvalidInput       = errors.New("invalid administrator bootstrap input")
	ErrSuspended          = errors.New("account suspended")
	ErrRegistrationClosed = errors.New("registrations closed")
)

// dummyHash is compared against when an email is unknown so that a login for a
// missing account costs the same bcrypt time as a wrong password, which keeps
// response timing from revealing which emails are registered.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("timing-equaliser-not-a-password"), bcrypt.DefaultCost)

// InitialAccountStatus returns the status a newly registered account starts in.
// Only tutors and coaching centres go through manual verification; students and
// parents are usable immediately.
func InitialAccountStatus(role string) string {
	if role == "tutor" || role == "coaching" {
		return "pending"
	}
	return "active"
}

type User struct {
	ID              string     `db:"id" json:"id"`
	Name            string     `db:"name" json:"name"`
	Email           string     `db:"email" json:"email"`
	Phone           *string    `db:"phone" json:"phone,omitempty"`
	PasswordHash    string     `db:"password_hash"`
	Role            string     `db:"role" json:"role"`
	AccountStatus   string     `db:"account_status" json:"account_status"`
	EmailVerifiedAt *time.Time `db:"email_verified_at" json:"email_verified_at,omitempty"`
	CreatedAt       time.Time  `db:"created_at" json:"created_at"`
}

type Service struct {
	db  *sqlx.DB
	cfg config.Config
}

type Tokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
}

func NewService(db *sqlx.DB, cfg config.Config) *Service { return &Service{db: db, cfg: cfg} }

// BootstrapAdmin creates the initial administrator while holding a MySQL
// advisory lock. It never updates an existing account.
func (s *Service) BootstrapAdmin(ctx context.Context, name, email, password string) (User, error) {
	name = strings.TrimSpace(name)
	email = strings.ToLower(strings.TrimSpace(email))
	parsedEmail, err := mail.ParseAddress(email)
	if len(name) < 2 || len(name) > 120 || len(email) == 0 || err != nil || parsedEmail.Address != email || len(password) < 8 || len(password) > 72 {
		return User{}, ErrInvalidInput
	}

	lockCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	conn, err := s.db.Connx(lockCtx)
	if err != nil {
		return User{}, err
	}
	defer conn.Close()
	var lockAcquired int
	if err := conn.GetContext(lockCtx, &lockAcquired, `SELECT GET_LOCK('tuitionhub_initial_admin_bootstrap', 10)`); err != nil {
		return User{}, err
	}
	if lockAcquired != 1 {
		return User{}, ErrConflict
	}
	defer func() {
		_, _ = conn.ExecContext(context.Background(), `SELECT RELEASE_LOCK('tuitionhub_initial_admin_bootstrap')`)
	}()

	tx, err := conn.BeginTxx(lockCtx, nil)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback()
	var adminCount int
	if err := tx.GetContext(lockCtx, &adminCount, `SELECT COUNT(*) FROM users WHERE role = 'admin'`); err != nil {
		return User{}, err
	}
	if adminCount > 0 {
		return User{}, ErrAdminExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}
	user := User{
		ID:            uuid.NewString(),
		Name:          name,
		Email:         email,
		PasswordHash:  string(hash),
		Role:          "admin",
		AccountStatus: "active",
		CreatedAt:     time.Now().UTC(),
		EmailVerifiedAt: func() *time.Time {
			now := time.Now().UTC()
			return &now
		}(),
	}
	if _, err := tx.ExecContext(lockCtx, `INSERT INTO users (id, name, email, password_hash, role, account_status, email_verified_at) VALUES (?, ?, ?, ?, 'admin', 'active', UTC_TIMESTAMP(6))`, user.ID, user.Name, user.Email, user.PasswordHash); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return User{}, ErrConflict
		}
		return User{}, err
	}
	if err := tx.Commit(); err != nil {
		return User{}, err
	}
	return user, nil
}

// RecordLoginFailure audits a failed password for an existing account so admins
// can spot guessing. Unknown emails are not recorded (nothing to attach them to).
func (s *Service) RecordLoginFailure(ctx context.Context, email, ip string) {
	_, _ = s.db.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) SELECT ?, NULL, id, 'login_failed', JSON_OBJECT('ip', ?) FROM users WHERE email = ?`, uuid.NewString(), ip, strings.ToLower(strings.TrimSpace(email)))
}

func (s *Service) Register(ctx context.Context, name, email, password, role string, phone *string) (User, Tokens, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	// Administrators can pause sign-ups from platform settings; a missing table or row means open.
	var open string
	if err := s.db.GetContext(ctx, &open, `SELECT CAST(setting_value AS CHAR) FROM platform_settings WHERE setting_key = 'registrations_open'`); err == nil && open == "false" {
		return User{}, Tokens{}, ErrRegistrationClosed
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, Tokens{}, err
	}
	user := User{ID: uuid.NewString(), Name: strings.TrimSpace(name), Email: email, Phone: phone, PasswordHash: string(passwordHash), Role: role}
	user.AccountStatus = InitialAccountStatus(role)
	_, err = s.db.ExecContext(ctx, `INSERT INTO users (id, name, email, phone, password_hash, role, account_status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Email, user.Phone, user.PasswordHash, user.Role, user.AccountStatus)
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return User{}, Tokens{}, ErrConflict
		}
		return User{}, Tokens{}, err
	}
	tokens, err := s.issueTokens(ctx, user)
	return user, tokens, err
}

func (s *Service) Login(ctx context.Context, email, password string) (User, Tokens, error) {
	var user User
	err := s.db.GetContext(ctx, &user, `SELECT id, name, email, phone, password_hash, role, account_status, email_verified_at, created_at FROM users WHERE email = ? LIMIT 1`, strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return User{}, Tokens{}, ErrInvalidCredentials
	}
	if bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return User{}, Tokens{}, ErrInvalidCredentials
	}
	// Checked only after the password, so a suspension is never revealed to someone without it.
	if user.AccountStatus == "suspended" {
		return User{}, Tokens{}, ErrSuspended
	}
	tokens, err := s.issueTokens(ctx, user)
	return user, tokens, err
}

func (s *Service) User(ctx context.Context, id string) (User, error) {
	var user User
	err := s.db.GetContext(ctx, &user, `SELECT id, name, email, phone, password_hash, role, account_status, email_verified_at, created_at FROM users WHERE id = ?`, id)
	return user, err
}

func (s *Service) Refresh(ctx context.Context, raw string) (User, Tokens, error) {
	hash := tokenHash(raw)
	var session struct {
		User
		TokenID   string     `db:"token_id"`
		RevokedAt *time.Time `db:"revoked_at"`
	}
	err := s.db.GetContext(ctx, &session, `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.account_status, u.email_verified_at, u.created_at, rt.id AS token_id, rt.revoked_at FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? AND rt.expires_at > UTC_TIMESTAMP(6)`, hash)
	if err != nil {
		return User{}, Tokens{}, ErrInvalidToken
	}
	if session.RevokedAt != nil {
		// A rotated token presented again means it was copied. End every session
		// for the account so a stolen token stops working for the thief too.
		_, _ = s.db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL`, session.ID)
		return User{}, Tokens{}, ErrInvalidToken
	}
	if session.AccountStatus == "suspended" {
		return User{}, Tokens{}, ErrSuspended
	}
	// Conditional update: of two concurrent refreshes with the same token, only one wins.
	result, err := s.db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(6) WHERE id = ? AND revoked_at IS NULL`, session.TokenID)
	if err != nil {
		return User{}, Tokens{}, err
	}
	if rows, _ := result.RowsAffected(); rows != 1 {
		return User{}, Tokens{}, ErrInvalidToken
	}
	tokens, err := s.issueTokens(ctx, session.User)
	return session.User, tokens, err
}

// AccountState returns the role and status used for per-request authorization.
func (s *Service) AccountState(ctx context.Context, id string) (role, status string, err error) {
	var row struct {
		Role   string `db:"role"`
		Status string `db:"account_status"`
	}
	err = s.db.GetContext(ctx, &row, `SELECT role, account_status FROM users WHERE id = ?`, id)
	return row.Role, row.Status, err
}

// RevokeAllSessions ends every refresh session for a user, e.g. on suspension.
func (s *Service) RevokeAllSessions(ctx context.Context, userID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL`, userID)
	return err
}

func (s *Service) RevokeRefresh(ctx context.Context, raw string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(6) WHERE token_hash = ?`, tokenHash(raw))
	return err
}

func (s *Service) CreatePasswordResetToken(ctx context.Context, email string) (string, error) {
	return s.createAuthToken(ctx, email, "password_reset", time.Hour)
}

func (s *Service) CreateEmailVerificationToken(ctx context.Context, email string) (string, error) {
	return s.createAuthToken(ctx, email, "email_verification", 24*time.Hour)
}

func (s *Service) createAuthToken(ctx context.Context, email, kind string, ttl time.Duration) (string, error) {
	var userID string
	if err := s.db.GetContext(ctx, &userID, `SELECT id FROM users WHERE email = ?`, strings.ToLower(strings.TrimSpace(email))); err != nil {
		return "", nil
	}
	token, err := randomToken(32)
	if err != nil {
		return "", err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO auth_tokens (id, user_id, token_hash, kind, expires_at) VALUES (?, ?, ?, ?, ?)`,
		uuid.NewString(), userID, tokenHash(token), kind, time.Now().UTC().Add(ttl))
	return token, err
}

func (s *Service) ResetPassword(ctx context.Context, rawToken, password string) error {
	var token struct {
		ID     string `db:"id"`
		UserID string `db:"user_id"`
	}
	err := s.db.GetContext(ctx, &token, `SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND kind = 'password_reset' AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(6)`, tokenHash(rawToken))
	if err != nil {
		return ErrInvalidToken
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET password_hash = ? WHERE id = ?`, hash, token.UserID); err != nil {
		_ = tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE auth_tokens SET consumed_at = UTC_TIMESTAMP(6) WHERE id = ?`, token.ID); err != nil {
		_ = tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(6) WHERE user_id = ? AND revoked_at IS NULL`, token.UserID); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (s *Service) VerifyEmail(ctx context.Context, rawToken string) error {
	var token struct {
		ID     string `db:"id"`
		UserID string `db:"user_id"`
	}
	if err := s.db.GetContext(ctx, &token, `SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND kind = 'email_verification' AND consumed_at IS NULL AND expires_at > UTC_TIMESTAMP(6)`, tokenHash(rawToken)); err != nil {
		return ErrInvalidToken
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users SET email_verified_at = UTC_TIMESTAMP(6) WHERE id = ?`, token.UserID); err != nil {
		_ = tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE auth_tokens SET consumed_at = UTC_TIMESTAMP(6) WHERE id = ?`, token.ID); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (s *Service) issueTokens(ctx context.Context, user User) (Tokens, error) {
	now := time.Now().UTC()
	claims := jwt.MapClaims{"sub": user.ID, "role": user.Role, "iat": now.Unix(), "exp": now.Add(s.cfg.AccessTokenTTL).Unix()}
	access, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return Tokens{}, err
	}
	refresh, err := randomToken(32)
	if err != nil {
		return Tokens{}, err
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
		uuid.NewString(), user.ID, tokenHash(refresh), now.Add(s.cfg.RefreshTokenTTL))
	if err != nil {
		return Tokens{}, err
	}
	return Tokens{AccessToken: access, RefreshToken: refresh, TokenType: "Bearer", ExpiresIn: int64(s.cfg.AccessTokenTTL.Seconds())}, nil
}

func (s *Service) ParseAccessToken(raw string) (string, error) {
	token, err := jwt.Parse(raw, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, ErrInvalidToken
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return "", ErrInvalidToken
	}
	id, err := token.Claims.GetSubject()
	return id, err
}

func randomToken(size int) (string, error) {
	data := make([]byte, size)
	if _, err := rand.Read(data); err != nil {
		return "", err
	}
	return hex.EncodeToString(data), nil
}

func tokenHash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

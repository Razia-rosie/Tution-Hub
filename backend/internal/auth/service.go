package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
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
)

type User struct {
	ID              string     `db:"id" json:"id"`
	Name            string     `db:"name" json:"name"`
	Email           string     `db:"email" json:"email"`
	Phone           *string    `db:"phone" json:"phone,omitempty"`
	PasswordHash    string     `db:"password_hash"`
	Role            string     `db:"role" json:"role"`
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

func (s *Service) Register(ctx context.Context, name, email, password, role string, phone *string) (User, Tokens, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, Tokens{}, err
	}
	user := User{ID: uuid.NewString(), Name: strings.TrimSpace(name), Email: email, Phone: phone, PasswordHash: string(passwordHash), Role: role}
	_, err = s.db.ExecContext(ctx, `INSERT INTO users (id, name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)`,
		user.ID, user.Name, user.Email, user.Phone, user.PasswordHash, user.Role)
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
	err := s.db.GetContext(ctx, &user, `SELECT id, name, email, phone, password_hash, role, email_verified_at, created_at FROM users WHERE email = ? LIMIT 1`, strings.ToLower(strings.TrimSpace(email)))
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return User{}, Tokens{}, ErrInvalidCredentials
	}
	tokens, err := s.issueTokens(ctx, user)
	return user, tokens, err
}

func (s *Service) User(ctx context.Context, id string) (User, error) {
	var user User
	err := s.db.GetContext(ctx, &user, `SELECT id, name, email, phone, password_hash, role, email_verified_at, created_at FROM users WHERE id = ?`, id)
	return user, err
}

func (s *Service) Refresh(ctx context.Context, raw string) (User, Tokens, error) {
	hash := tokenHash(raw)
	var session struct {
		User
		TokenID string `db:"token_id"`
	}
	err := s.db.GetContext(ctx, &session, `SELECT u.id, u.name, u.email, u.phone, u.password_hash, u.role, u.email_verified_at, u.created_at, rt.id AS token_id FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > UTC_TIMESTAMP(6)`, hash)
	if err != nil {
		return User{}, Tokens{}, ErrInvalidToken
	}
	_, _ = s.db.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP(6) WHERE token_hash = ?`, hash)
	tokens, err := s.issueTokens(ctx, session.User)
	return session.User, tokens, err
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

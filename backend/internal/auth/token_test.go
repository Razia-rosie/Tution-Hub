package auth

import (
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/tuitionhub/backend/internal/config"
)

func signed(t *testing.T, secret string, claims jwt.MapClaims) string {
	t.Helper()
	raw, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestParseAccessTokenReturnsUserAndSession(t *testing.T) {
	secret := strings.Repeat("s", 40)
	s := NewService(nil, config.Config{JWTSecret: secret})
	now := time.Now()
	raw := signed(t, secret, jwt.MapClaims{"sub": "user-1", "sid": "session-1", "iat": now.Unix(), "exp": now.Add(time.Minute).Unix()})
	userID, sessionID, err := s.ParseAccessToken(raw)
	if err != nil || userID != "user-1" || sessionID != "session-1" {
		t.Fatalf("got %q %q %v", userID, sessionID, err)
	}
}

func TestParseAccessTokenRefusesTokensWithoutSession(t *testing.T) {
	secret := strings.Repeat("s", 40)
	s := NewService(nil, config.Config{JWTSecret: secret})
	now := time.Now()
	cases := map[string]string{
		"no sid (issued before sessions)": signed(t, secret, jwt.MapClaims{"sub": "user-1", "exp": now.Add(time.Minute).Unix()}),
		"empty sid":                       signed(t, secret, jwt.MapClaims{"sub": "user-1", "sid": "", "exp": now.Add(time.Minute).Unix()}),
		"no subject":                      signed(t, secret, jwt.MapClaims{"sid": "session-1", "exp": now.Add(time.Minute).Unix()}),
		"expired":                         signed(t, secret, jwt.MapClaims{"sub": "user-1", "sid": "session-1", "exp": now.Add(-time.Minute).Unix()}),
		"wrong key":                       signed(t, strings.Repeat("x", 40), jwt.MapClaims{"sub": "user-1", "sid": "session-1", "exp": now.Add(time.Minute).Unix()}),
	}
	for name, raw := range cases {
		if _, _, err := s.ParseAccessToken(raw); err == nil {
			t.Errorf("%s: expected the token to be refused", name)
		}
	}
}

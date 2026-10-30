package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment     string
	HTTPAddr        string
	DatabaseURL     string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	// RefreshReuseGrace is how long a just-rotated refresh token may be presented
	// again without being treated as theft (covers navigation and multi-tab races).
	RefreshReuseGrace time.Duration
	SecureCookie      bool
	DocumentDir       string
	// Abuse limits: failed logins per email+IP and per IP in 15 minutes, and
	// account-creation or token-request calls per IP per hour.
	LoginLimitPerAccount int
	LoginLimitPerIP      int
	SignupLimitPerIP     int
	// TrustedProxies lists proxy addresses whose X-Forwarded-For is believed.
	// Empty means the direct peer address is used, so the header cannot be spoofed.
	TrustedProxies []string
}

func Load() (Config, error) {
	c := Config{
		Environment:          get("APP_ENV", "development"),
		HTTPAddr:             get("HTTP_ADDR", ":8080"),
		DatabaseURL:          os.Getenv("DATABASE_URL"),
		JWTSecret:            os.Getenv("JWT_SECRET"),
		AccessTokenTTL:       parseDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:      parseDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		RefreshReuseGrace:    parseDuration("REFRESH_REUSE_GRACE", 20*time.Second),
		SecureCookie:         os.Getenv("COOKIE_SECURE") == "true",
		DocumentDir:          get("DOCUMENT_DIR", "private_documents"),
		LoginLimitPerAccount: parseInt("LOGIN_LIMIT_PER_ACCOUNT", 5),
		LoginLimitPerIP:      parseInt("LOGIN_LIMIT_PER_IP", 50),
		SignupLimitPerIP:     parseInt("SIGNUP_LIMIT_PER_IP", 20),
		TrustedProxies:       splitList(os.Getenv("TRUSTED_PROXIES")),
	}
	if c.DatabaseURL == "" || len(c.JWTSecret) < 32 {
		return Config{}, errors.New("DATABASE_URL is required and JWT_SECRET must be at least 32 characters")
	}
	return c, nil
}

func get(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func parseInt(key string, fallback int) int {
	if value, err := strconv.Atoi(os.Getenv(key)); err == nil && value > 0 {
		return value
	}
	return fallback
}

func splitList(value string) []string {
	var out []string
	for _, part := range strings.Split(value, ",") {
		if part = strings.TrimSpace(part); part != "" {
			out = append(out, part)
		}
	}
	return out
}

func parseDuration(key string, fallback time.Duration) time.Duration {
	if value, err := time.ParseDuration(os.Getenv(key)); err == nil && value > 0 {
		return value
	}
	return fallback
}

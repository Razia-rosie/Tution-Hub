package config

import (
	"errors"
	"os"
	"time"
)

type Config struct {
	Environment     string
	HTTPAddr        string
	DatabaseURL     string
	JWTSecret       string
	AccessTokenTTL  time.Duration
	RefreshTokenTTL time.Duration
	SecureCookie    bool
}

func Load() (Config, error) {
	c := Config{
		Environment:     get("APP_ENV", "development"),
		HTTPAddr:        get("HTTP_ADDR", ":8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		JWTSecret:       os.Getenv("JWT_SECRET"),
		AccessTokenTTL:  parseDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL: parseDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		SecureCookie:    os.Getenv("COOKIE_SECURE") == "true",
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

func parseDuration(key string, fallback time.Duration) time.Duration {
	if value, err := time.ParseDuration(os.Getenv(key)); err == nil && value > 0 {
		return value
	}
	return fallback
}

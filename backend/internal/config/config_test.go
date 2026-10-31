package config

import (
	"testing"
	"time"
)

func TestLoadDefaultsAndOverrides(t *testing.T) {
	t.Setenv("DATABASE_URL", "user:pass@tcp(localhost:3306)/db")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.RefreshReuseGrace != 20*time.Second || cfg.LoginLimitPerAccount != 5 || cfg.SignupLimitPerIP != 20 || cfg.DocumentDir != "private_documents" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if cfg.DBMaxOpenConns != 25 || cfg.DBMaxIdleConns != 25 || cfg.DBConnMaxLifetime != 5*time.Minute {
		t.Fatalf("unexpected pool defaults: %+v", cfg)
	}
	t.Setenv("REFRESH_REUSE_GRACE", "2s")
	t.Setenv("TRUSTED_PROXIES", "10.0.0.1, 10.0.0.2")
	cfg, _ = Load()
	if cfg.RefreshReuseGrace != 2*time.Second || len(cfg.TrustedProxies) != 2 {
		t.Fatalf("overrides not applied: %+v", cfg)
	}
}

func TestLoadPoolOverridesCapIdleAtOpen(t *testing.T) {
	t.Setenv("DATABASE_URL", "user:pass@tcp(localhost:3306)/db")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	t.Setenv("DB_MAX_OPEN_CONNS", "10")
	cfg, _ := Load()
	if cfg.DBMaxOpenConns != 10 || cfg.DBMaxIdleConns != 10 {
		t.Fatalf("idle should follow the open limit: %+v", cfg)
	}
	t.Setenv("DB_MAX_IDLE_CONNS", "40")
	t.Setenv("DB_CONN_MAX_LIFETIME", "1m")
	cfg, _ = Load()
	if cfg.DBMaxIdleConns != 10 || cfg.DBConnMaxLifetime != time.Minute {
		t.Fatalf("idle must be capped at the open limit: %+v", cfg)
	}
}

func TestLoadRejectsWeakSecret(t *testing.T) {
	t.Setenv("DATABASE_URL", "x")
	t.Setenv("JWT_SECRET", "short")
	if _, err := Load(); err == nil {
		t.Fatal("expected an error for a short JWT secret")
	}
}

package database

import (
	"context"
	"time"

	"github.com/jmoiron/sqlx"
)

// ConfigurePool bounds the connection pool and keeps connections open for reuse
// instead of dialling MySQL for most queries.
func ConfigurePool(db *sqlx.DB, maxOpen, maxIdle int, maxLifetime time.Duration) {
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxIdle)
	db.SetConnMaxLifetime(maxLifetime)
}

func WaitForConnection(db *sqlx.DB, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		if err := db.PingContext(ctx); err == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

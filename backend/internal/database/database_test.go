package database

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestConfigurePoolSetsOpenLimit(t *testing.T) {
	raw, _, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	db := sqlx.NewDb(raw, "sqlmock")
	defer db.Close()
	if got := db.Stats().MaxOpenConnections; got != 0 {
		t.Fatalf("expected the database/sql default (unlimited), got %d", got)
	}
	ConfigurePool(db, 25, 25, 5*time.Minute)
	if got := db.Stats().MaxOpenConnections; got != 25 {
		t.Fatalf("max open connections = %d, want 25", got)
	}
}

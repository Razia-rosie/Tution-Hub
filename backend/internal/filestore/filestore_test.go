package filestore

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/jmoiron/sqlx"
)

func TestDiskRoundTrip(t *testing.T) {
	ctx := context.Background()
	d := Disk{Dir: filepath.Join(t.TempDir(), "files")}
	if err := d.Put(ctx, "abc", "image/png", []byte("data")); err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(filepath.Join(d.Dir, "abc")); err != nil || info.Mode().Perm() != 0o600 {
		t.Fatalf("file not private: %v %v", info, err)
	}
	got, err := d.Get(ctx, "abc")
	if err != nil || string(got) != "data" {
		t.Fatalf("get: %q %v", got, err)
	}
	if _, err := d.Get(ctx, "../abc"); err != nil {
		t.Fatalf("keys are reduced to their base name: %v", err)
	}
	d.Delete(ctx, "abc")
	if _, err := d.Get(ctx, "abc"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted file should be not found: %v", err)
	}
}

func TestDatabaseStore(t *testing.T) {
	ctx := context.Background()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	s := Database{DB: sqlx.NewDb(db, "sqlmock")}
	mock.ExpectExec(`INSERT INTO stored_files`).WithArgs("k1", "image/jpeg", 3, []byte("jpg")).WillReturnResult(sqlmock.NewResult(0, 1))
	if err := s.Put(ctx, "k1", "image/jpeg", []byte("jpg")); err != nil {
		t.Fatal(err)
	}
	mock.ExpectQuery(`SELECT content FROM stored_files`).WithArgs("k1").WillReturnRows(sqlmock.NewRows([]string{"content"}).AddRow([]byte("jpg")))
	if got, err := s.Get(ctx, "k1"); err != nil || string(got) != "jpg" {
		t.Fatalf("get: %q %v", got, err)
	}
	mock.ExpectQuery(`SELECT content FROM stored_files`).WithArgs("missing").WillReturnRows(sqlmock.NewRows([]string{"content"}))
	if _, err := s.Get(ctx, "missing"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing key should be not found: %v", err)
	}
	mock.ExpectExec(`DELETE FROM stored_files`).WithArgs("k1").WillReturnResult(sqlmock.NewResult(0, 1))
	s.Delete(ctx, "k1")
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestNewRejectsUnknownKind(t *testing.T) {
	if _, err := New("s3", nil, ""); err == nil {
		t.Fatal("unknown storage kind should be rejected")
	}
	if s, _ := New("", nil, "x"); s != (Disk{Dir: "x"}) {
		t.Fatalf("empty kind should default to disk: %#v", s)
	}
}

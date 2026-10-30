// Command migrate applies pending SQL migrations from ./migrations in order and
// records each in schema_migrations. It only moves forward: files containing
// destructive statements (DROP TABLE/DATABASE/COLUMN, TRUNCATE, DELETE FROM)
// are refused, so it can never remove existing data.
//
//	DATABASE_URL=... go run ./cmd/migrate            # apply pending
//	DATABASE_URL=... go run ./cmd/migrate -dry-run   # list pending only
//
// Databases created before this tool existed (001 and 002 applied by the MySQL
// container's init scripts) are baselined: a migration whose tables already
// exist is recorded as applied without running it again.
package main

import (
	"crypto/sha256"
	"encoding/hex"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
)

var destructive = regexp.MustCompile(`(?i)\b(DROP\s+(TABLE|DATABASE|SCHEMA|COLUMN)|TRUNCATE|DELETE\s+FROM)\b`)

// baselineMarkers maps migrations that predate this tool to a table they create.
var baselineMarkers = map[string]string{
	"001_auth.sql":      "refresh_tokens",
	"002_workflows.sql": "verification_applications",
}

func main() {
	dir := flag.String("dir", "migrations", "directory of .sql migrations")
	dryRun := flag.Bool("dry-run", false, "list pending migrations without applying them")
	flag.Parse()
	if err := run(*dir, *dryRun); err != nil {
		slog.Error("migrate failed", "error", err)
		os.Exit(1)
	}
}

func run(dir string, dryRun bool) error {
	dsn := os.Getenv("DATABASE_URL")
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return fmt.Errorf("DATABASE_URL: %w", err)
	}
	// Migration files use PREPARE/EXECUTE blocks, so the whole file runs as one multi-statement exec.
	cfg.MultiStatements = true
	db, err := sqlx.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(190) NOT NULL PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`); err != nil {
		return err
	}
	applied := map[string]string{}
	rows := []struct {
		Version  string `db:"version"`
		Checksum string `db:"checksum"`
	}{}
	if err := db.Select(&rows, `SELECT version, checksum FROM schema_migrations`); err != nil {
		return err
	}
	for _, r := range rows {
		applied[r.Version] = r.Checksum
	}
	files, err := filepath.Glob(filepath.Join(dir, "*.sql"))
	if err != nil {
		return err
	}
	sort.Strings(files)
	fmt.Printf("database %s: %d migration file(s), %d recorded\n", cfg.DBName, len(files), len(applied))
	for _, file := range files {
		name := filepath.Base(file)
		data, err := os.ReadFile(file)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(data)
		checksum := hex.EncodeToString(sum[:])
		if prev, ok := applied[name]; ok {
			if prev != checksum {
				fmt.Printf("  %s: applied, but the file changed since (not re-run)\n", name)
			}
			continue
		}
		if destructive.Match(stripComments(data)) {
			return fmt.Errorf("%s contains a destructive statement; refusing", name)
		}
		if marker, ok := baselineMarkers[name]; ok {
			var exists bool
			if err := db.Get(&exists, `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?)`, marker); err != nil {
				return err
			}
			if exists {
				fmt.Printf("  %s: already present, recording as baseline\n", name)
				if !dryRun {
					if _, err := db.Exec(`INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)`, name, checksum); err != nil {
						return err
					}
				}
				continue
			}
		}
		if dryRun {
			fmt.Printf("  %s: pending\n", name)
			continue
		}
		fmt.Printf("  %s: applying\n", name)
		if _, err := db.Exec(string(data)); err != nil {
			return fmt.Errorf("%s: %w", name, err)
		}
		if _, err := db.Exec(`INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)`, name, checksum); err != nil {
			return err
		}
	}
	fmt.Println("done")
	return nil
}

func stripComments(sql []byte) []byte {
	var out []string
	for _, line := range strings.Split(string(sql), "\n") {
		if !strings.HasPrefix(strings.TrimSpace(line), "--") {
			out = append(out, line)
		}
	}
	return []byte(strings.Join(out, "\n"))
}

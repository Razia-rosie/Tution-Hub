package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestPortableSQLRewritesSelectInto(t *testing.T) {
	in := "SET @schema = DATABASE();\nSELECT IF(\n    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND column_name = 'x'),\n    'SELECT 1',\n    'ALTER TABLE users ADD COLUMN x INT NULL'\n) INTO @sql;\nPREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;"
	out := portableSQL(in)
	if strings.Contains(out, "INTO @sql") {
		t.Fatalf("SELECT ... INTO @sql was not rewritten:\n%s", out)
	}
	want := "SET @sql = (SELECT IF(\n    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND column_name = 'x'),\n    'SELECT 1',\n    'ALTER TABLE users ADD COLUMN x INT NULL'\n));"
	if !strings.Contains(out, want) {
		t.Fatalf("unexpected rewrite:\n%s", out)
	}
	if !strings.HasPrefix(out, "SET @schema = DATABASE();") || !strings.HasSuffix(out, "DEALLOCATE PREPARE stmt;") {
		t.Fatalf("surrounding statements changed:\n%s", out)
	}
}

func TestPortableSQLCoversEveryMigration(t *testing.T) {
	files, _ := filepath.Glob("../../migrations/*.sql")
	if len(files) == 0 {
		t.Fatal("no migrations found")
	}
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		if out := portableSQL(string(data)); strings.Contains(strings.ToUpper(out), "INTO @") {
			t.Fatalf("%s still selects INTO a variable after rewriting", filepath.Base(f))
		}
	}
}

-- 005: optional database storage for uploaded files.
--
-- With FILE_STORAGE=database the API keeps verification pictures, profile
-- photos, classroom materials and submissions here instead of on local disk,
-- for hosts without a persistent filesystem. With the default FILE_STORAGE=disk
-- the table stays empty.
--
-- Additive only and safe to re-run. Apply with `go run ./cmd/migrate`.

CREATE TABLE IF NOT EXISTS stored_files (
  storage_key VARCHAR(64) NOT NULL PRIMARY KEY,
  mime_type VARCHAR(100) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  content LONGBLOB NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

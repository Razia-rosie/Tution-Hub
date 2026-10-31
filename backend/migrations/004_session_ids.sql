-- 004: bind access tokens to a server-side session.
--
-- Every refresh token belongs to a session (one sign-in on one device). Rotation
-- keeps the session_id, and access tokens carry it as the "sid" claim, so ending
-- a session (logout, password reset, suspension, reuse detection) rejects its
-- access tokens immediately instead of when they expire.
--
-- Additive only: the column and index are guarded by information_schema checks,
-- existing rows get their own id as session_id (each was a separate session),
-- and the file is safe to re-run. Apply with `go run ./cmd/migrate`.

SET @schema = DATABASE();

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = @schema AND table_name = 'refresh_tokens' AND column_name = 'session_id'),
    'SELECT 1',
    'ALTER TABLE refresh_tokens ADD COLUMN session_id CHAR(36) NULL AFTER user_id'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE refresh_tokens SET session_id = id WHERE session_id IS NULL;

SELECT IF(
    EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = @schema AND table_name = 'refresh_tokens' AND index_name = 'idx_refresh_session'),
    'SELECT 1',
    'ALTER TABLE refresh_tokens ADD INDEX idx_refresh_session (session_id, revoked_at, expires_at)'
) INTO @sql;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

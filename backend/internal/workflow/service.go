package workflow

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"

	"github.com/tuitionhub/backend/internal/filestore"
)

var (
	ErrNotFound     = errors.New("record not found")
	ErrForbidden    = errors.New("forbidden")
	ErrInvalidState = errors.New("invalid state")
	ErrConflict     = errors.New("transition not allowed from current state")
)

type Service struct {
	db    *sqlx.DB
	files filestore.Store
}

func NewService(db *sqlx.DB, files filestore.Store) *Service {
	return &Service{db: db, files: files}
}

type Profile struct {
	UserID            string          `db:"user_id" json:"user_id"`
	DisplayName       *string         `db:"display_name" json:"display_name"`
	Institution       *string         `db:"institution" json:"institution"`
	Education         *string         `db:"education" json:"education"`
	Subjects          json.RawMessage `db:"subjects" json:"subjects"`
	Classes           json.RawMessage `db:"classes" json:"classes"`
	Areas             json.RawMessage `db:"areas" json:"areas"`
	TeachingModes     json.RawMessage `db:"teaching_modes" json:"teaching_modes"`
	Availability      json.RawMessage `db:"availability" json:"availability"`
	ExperienceYears   *float64        `db:"experience_years" json:"experience_years"`
	FeeExpectation    *float64        `db:"fee_expectation" json:"fee_expectation"`
	Address           *string         `db:"address" json:"address"`
	BirthDate         *time.Time      `db:"birth_date" json:"birth_date"`
	GuardianNotes     *string         `db:"guardian_notes" json:"guardian_notes"`
	CompletionPercent uint8           `db:"completion_percent" json:"completion_percent"`
	Bio               *string         `db:"bio" json:"bio"`
	CurrentStudy      *string         `db:"current_study" json:"current_study"`
	Results           *string         `db:"results" json:"results"`
	Mediums           json.RawMessage `db:"mediums" json:"mediums"`
	Gender            *string         `db:"gender" json:"gender"`
	HasPhoto          bool            `db:"has_photo" json:"has_photo"`
	Listed            bool            `db:"listed" json:"listed"`
	ClassName         *string         `db:"class_name" json:"class_name"`
	OpeningHours      *string         `db:"opening_hours" json:"opening_hours"`
	Established       *string         `db:"established" json:"established"`
	District          *string         `db:"district" json:"district"`
}

type Verification struct {
	ID                string     `db:"id" json:"id"`
	UserID            string     `db:"user_id" json:"user_id"`
	Status            string     `db:"status" json:"status"`
	SubmittedAt       *time.Time `db:"submitted_at" json:"submitted_at"`
	ReviewedAt        *time.Time `db:"reviewed_at" json:"reviewed_at"`
	RejectionReason   *string    `db:"rejection_reason" json:"rejection_reason"`
	CorrectionRequest *string    `db:"correction_request" json:"correction_request"`
}

type Document struct {
	ID            string    `db:"id" json:"id"`
	ApplicationID string    `db:"application_id" json:"application_id"`
	DocumentType  string    `db:"document_type" json:"document_type"`
	OriginalName  string    `db:"original_name" json:"original_name"`
	MimeType      string    `db:"mime_type" json:"mime_type"`
	ByteSize      int64     `db:"byte_size" json:"byte_size"`
	UploadedAt    time.Time `db:"uploaded_at" json:"uploaded_at"`
}

type StoredDocument struct {
	Document
	OwnerID    string `db:"owner_id"`
	StorageKey string `db:"storage_key"`
}

type AdminApplication struct {
	Verification
	Name          string          `db:"name" json:"name"`
	Email         string          `db:"email" json:"email"`
	Role          string          `db:"role" json:"role"`
	AccountStatus string          `db:"account_status" json:"account_status"`
	Profile       json.RawMessage `db:"profile" json:"profile"`
	Interviews    json.RawMessage `db:"interviews" json:"interviews"`
	// SubmissionCount > 1 marks a resubmitted application.
	SubmissionCount int `db:"submission_count" json:"submission_count"`
	DocumentCount   int `db:"document_count" json:"document_count"`
	// Family links a parent application to its child invitations, and a
	// student application to the parent who invited them.
	Family any `db:"-" json:"family,omitempty"`
}

func (s *Service) GetDashboard(ctx context.Context, userID string) (map[string]any, error) {
	var account struct {
		Name            string `db:"name" json:"name"`
		ID              string `db:"id" json:"id"`
		Role            string `db:"role" json:"role"`
		Status          string `db:"account_status" json:"status"`
		ProfileComplete uint8  `db:"completion_percent" json:"profile_complete"`
	}
	if err := s.db.GetContext(ctx, &account, `SELECT u.id, u.name, u.role, u.account_status, COALESCE(p.completion_percent, 0) AS completion_percent FROM users u LEFT JOIN role_profiles p ON p.user_id = u.id WHERE u.id = ?`, userID); err != nil {
		return nil, err
	}
	// The profile is returned so the verification form can be prefilled on resubmission.
	// NULL JSON columns cannot scan into json.RawMessage, so they are coalesced to a JSON null literal.
	var profile any
	var stored Profile
	err := s.db.GetContext(ctx, &stored, `SELECT user_id, display_name, institution, education, COALESCE(subjects, 'null') AS subjects, COALESCE(classes, 'null') AS classes, COALESCE(areas, 'null') AS areas, COALESCE(teaching_modes, 'null') AS teaching_modes, COALESCE(availability, 'null') AS availability, experience_years, fee_expectation, address, birth_date, guardian_notes, completion_percent, bio, current_study, results, COALESCE(mediums, 'null') AS mediums, gender, photo_key IS NOT NULL AS has_photo, listed, class_name, opening_hours, established, district FROM role_profiles WHERE user_id = ?`, userID)
	if err == nil {
		profile = stored
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	var verification Verification
	err = s.db.GetContext(ctx, &verification, `SELECT id, user_id, status, submitted_at, reviewed_at, rejection_reason, correction_request FROM verification_applications WHERE user_id = ?`, userID)
	result := map[string]any{"account": account, "verification": nil, "profile": profile, "documents": []Document{}, "requirements": RequirementsFor(account.Role)}
	if errors.Is(err, sql.ErrNoRows) {
		return result, nil
	}
	if err != nil {
		return nil, err
	}
	result["verification"] = verification
	documents, err := s.ListDocuments(ctx, verification.ID)
	if err != nil {
		return nil, err
	}
	result["documents"] = documents
	return result, nil
}

func (s *Service) UpsertProfile(ctx context.Context, userID string, input map[string]any) error {
	var lock struct {
		Role   string         `db:"role"`
		Status sql.NullString `db:"status"`
	}
	if err := s.db.GetContext(ctx, &lock, `SELECT u.role, v.status FROM users u LEFT JOIN verification_applications v ON v.user_id = u.id WHERE u.id = ?`, userID); err != nil {
		return err
	}
	// The reviewer must see exactly what was submitted, so the fields under review
	// freeze while an application is pending; other profile fields stay editable.
	reviewed := map[string]bool{"display_name": true, "institution": true, "education": true, "subjects": true, "classes": true, "areas": true}
	if familyRole(lock.Role) {
		reviewed = map[string]bool{}
		for _, r := range familyProfileRequirements[lock.Role] {
			reviewed[r.Column] = true
		}
	}
	if verifiableRole(lock.Role) && (lock.Status.String == "pending" || lock.Status.String == "under_review") {
		for key := range input {
			if reviewed[key] {
				return ErrConflict
			}
		}
	}
	allowed := map[string]bool{"display_name": true, "institution": true, "education": true, "subjects": true, "classes": true, "areas": true, "teaching_modes": true, "availability": true, "experience_years": true, "fee_expectation": true, "address": true, "birth_date": true, "guardian_notes": true,
		"bio": true, "current_study": true, "results": true, "mediums": true, "gender": true, "listed": true, "class_name": true, "opening_hours": true, "established": true, "district": true}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	for key, value := range input {
		if !allowed[key] {
			_ = tx.Rollback()
			return fmt.Errorf("unsupported profile field: %s", key)
		}
		var encoded any = value
		switch key {
		case "subjects", "classes", "areas", "teaching_modes", "availability", "mediums":
			data, marshalErr := json.Marshal(value)
			if marshalErr != nil {
				_ = tx.Rollback()
				return marshalErr
			}
			encoded = data
		}
		query := fmt.Sprintf("INSERT INTO role_profiles (user_id, %s) VALUES (?, ?) ON DUPLICATE KEY UPDATE %s = VALUES(%s)", key, key, key)
		if _, err = tx.ExecContext(ctx, query, userID, encoded); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO role_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id`, userID); err != nil {
		_ = tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE role_profiles SET completion_percent = LEAST(100, (display_name IS NOT NULL AND display_name <> '') * 20 + (education IS NOT NULL AND education <> '') * 20 + (subjects IS NOT NULL) * 20 + (classes IS NOT NULL) * 20 + (areas IS NOT NULL) * 20) WHERE user_id = ?`, userID); err != nil {
		_ = tx.Rollback()
		return err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE users u JOIN role_profiles p ON p.user_id = u.id JOIN verification_applications v ON v.user_id = u.id AND v.status = 'approved' SET u.account_status = 'active', u.profile_completed_at = UTC_TIMESTAMP(6) WHERE u.id = ? AND u.account_status = 'profile_incomplete' AND p.completion_percent = 100`, userID); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// IncompleteError lists what must be provided before an application can be submitted.
type IncompleteError struct{ Missing []string }

func (e *IncompleteError) Error() string { return "verification application is incomplete" }

// editableApplication reports whether the applicant may still change pictures
// and profile details: before the first submission and when corrections are
// requested. From submission onwards the evidence is frozen for the reviewer.
func editableApplication(status string) bool {
	return status == "" || status == "draft" || status == "resubmission_required"
}

func (s *Service) SubmitVerification(ctx context.Context, userID string) (Verification, error) {
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return Verification{}, err
	}
	defer tx.Rollback()
	var account struct {
		Role   string `db:"role"`
		Status string `db:"account_status"`
	}
	if err = tx.GetContext(ctx, &account, `SELECT role, account_status FROM users WHERE id = ? FOR UPDATE`, userID); err != nil {
		return Verification{}, err
	}
	if !verifiableRole(account.Role) {
		return Verification{}, ErrForbidden
	}
	// Approved, rejected, suspended or interviewing accounts cannot reset their
	// application to pending by submitting again. Parents and students who
	// registered before family verification existed are already active; they
	// may still submit once, and keep their access while it is reviewed.
	grandfathered := familyRole(account.Role) && account.Status == "active"
	if account.Status != "pending" && account.Status != "resubmission_required" && !grandfathered {
		return Verification{}, ErrInvalidState
	}
	var application struct {
		ID     string `db:"id"`
		Status string `db:"status"`
	}
	err = tx.GetContext(ctx, &application, `SELECT id, status FROM verification_applications WHERE user_id = ? FOR UPDATE`, userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Verification{}, err
	}
	if application.ID != "" && application.Status != "draft" && application.Status != "resubmission_required" {
		return Verification{}, ErrInvalidState
	}

	var missing []string
	uploaded := map[string]bool{}
	if application.ID != "" {
		var types []string
		if err = tx.SelectContext(ctx, &types, `SELECT document_type FROM verification_documents WHERE application_id = ?`, application.ID); err != nil {
			return Verification{}, err
		}
		for _, t := range types {
			uploaded[t] = true
		}
	}
	missing = append(missing, missingRequired(account.Role, uploaded)...)
	if familyRole(account.Role) {
		profileMissing, err := s.missingFamilyProfile(ctx, tx, account.Role, userID)
		if err != nil {
			return Verification{}, err
		}
		missing = append(missing, profileMissing...)
	} else {
		var completion uint8
		if err = tx.GetContext(ctx, &completion, `SELECT COALESCE((SELECT completion_percent FROM role_profiles WHERE user_id = ?), 0)`, userID); err != nil {
			return Verification{}, err
		}
		if completion < 100 {
			missing = append(missing, "Complete profile details")
		}
	}
	if len(missing) > 0 {
		return Verification{}, &IncompleteError{Missing: missing}
	}

	if _, err = tx.ExecContext(ctx, `UPDATE verification_applications SET status = 'pending', submitted_at = UTC_TIMESTAMP(6), rejection_reason = NULL, correction_request = NULL WHERE id = ?`, application.ID); err != nil {
		return Verification{}, err
	}
	if !grandfathered {
		if _, err = tx.ExecContext(ctx, `UPDATE users SET account_status = 'pending' WHERE id = ?`, userID); err != nil {
			return Verification{}, err
		}
	}
	action := "verification_submitted"
	if application.Status == "resubmission_required" {
		action = "verification_resubmitted"
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('application_id', ?))`, uuid.NewString(), userID, userID, action, application.ID); err != nil {
		return Verification{}, err
	}
	if err = tx.Commit(); err != nil {
		return Verification{}, err
	}
	var out Verification
	err = s.db.GetContext(ctx, &out, `SELECT id, user_id, status, submitted_at, reviewed_at, rejection_reason, correction_request FROM verification_applications WHERE user_id = ?`, userID)
	return out, err
}

func (s *Service) ReviewVerification(ctx context.Context, reviewerID, applicationID, decision, reason string) error {
	if decision != "approved" && decision != "rejected" && decision != "resubmission_required" {
		return ErrInvalidState
	}
	if (decision == "rejected" || decision == "resubmission_required") && len(strings.TrimSpace(reason)) < 10 {
		return ErrInvalidState
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	var application struct {
		UserID string `db:"user_id"`
		Status string `db:"status"`
		Role   string `db:"role"`
	}
	if err = tx.GetContext(ctx, &application, `SELECT v.user_id, v.status, u.role FROM verification_applications v JOIN users u ON u.id = v.user_id WHERE v.id = ? FOR UPDATE`, applicationID); err != nil {
		_ = tx.Rollback()
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if application.Status != "pending" && application.Status != "under_review" {
		_ = tx.Rollback()
		return ErrConflict
	}
	userID := application.UserID
	var completion uint8
	if err = tx.GetContext(ctx, &completion, `SELECT COALESCE((SELECT completion_percent FROM role_profiles WHERE user_id = ?), 0)`, userID); err != nil {
		_ = tx.Rollback()
		return err
	}
	accountStatus := decisionAccountStatus(decision, completion)
	if familyRole(application.Role) {
		// Parents and students have no separate profile-completion step.
		if decision == "approved" {
			accountStatus = "active"
		}
		if err = s.applyFamilyDecision(ctx, tx, reviewerID, application.Role, userID, decision); err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	var rejectionReason, correctionRequest any
	switch decision {
	case "rejected":
		rejectionReason = nullIfEmpty(reason)
	case "resubmission_required":
		correctionRequest = nullIfEmpty(reason)
	}
	_, err = tx.ExecContext(ctx, `UPDATE verification_applications SET status = ?, reviewed_at = UTC_TIMESTAMP(6), reviewer_id = ?, rejection_reason = ?, correction_request = ? WHERE id = ?`, decision, reviewerID, rejectionReason, correctionRequest, applicationID)
	if err == nil {
		_, err = tx.ExecContext(ctx, `UPDATE users SET account_status = ?, profile_completed_at = IF(? = 'active', UTC_TIMESTAMP(6), profile_completed_at) WHERE id = ?`, accountStatus, accountStatus, userID)
	}
	if err == nil {
		_, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('reason', ?))`, uuid.NewString(), reviewerID, userID, "verification_"+decision, reason)
	}
	if err == nil {
		title, body := decisionNotification(decision)
		_, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, ?, ?, ?)`, uuid.NewString(), userID, "verification_"+decision, title, body)
	}
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// decisionAccountStatus maps a review decision to the next account status. An
// approved applicant whose profile is already complete becomes active at once;
// otherwise UpsertProfile activates the account when the profile reaches 100%.
func decisionAccountStatus(decision string, completion uint8) string {
	switch decision {
	case "approved":
		if completion >= 100 {
			return "active"
		}
		return "profile_incomplete"
	case "rejected":
		return "rejected"
	default:
		return "resubmission_required"
	}
}

func decisionNotification(decision string) (string, string) {
	switch decision {
	case "approved":
		return "Verification approved", "Your verification was approved. Complete any remaining profile fields to activate your account."
	case "rejected":
		return "Verification rejected", "Your verification application was rejected. Review the reason in your verification center."
	default:
		return "Corrections requested", "An administrator requested corrections to your verification application."
	}
}

func nullIfEmpty(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func (s *Service) ListVerifications(ctx context.Context, status, role string) ([]AdminApplication, error) {
	var rows []AdminApplication
	query := `SELECT v.id, v.user_id, v.status, v.submitted_at, v.reviewed_at, v.rejection_reason, v.correction_request, u.name, u.email, u.role, u.account_status, COALESCE(p.profile, JSON_OBJECT()) AS profile, COALESCE(i.interviews, JSON_ARRAY()) AS interviews, (SELECT COUNT(*) FROM audit_logs a WHERE a.subject_user_id = v.user_id AND a.action IN ('verification_submitted', 'verification_resubmitted')) AS submission_count, (SELECT COUNT(*) FROM verification_documents d WHERE d.application_id = v.id) AS document_count FROM verification_applications v JOIN users u ON u.id = v.user_id LEFT JOIN (SELECT user_id, JSON_OBJECT('display_name', display_name, 'institution', institution, 'education', education, 'subjects', subjects, 'classes', classes, 'areas', areas, 'completion_percent', completion_percent) AS profile FROM role_profiles) p ON p.user_id = u.id LEFT JOIN (SELECT application_id, JSON_ARRAYAGG(JSON_OBJECT('id', id, 'mode', mode, 'scheduled_at', DATE_FORMAT(scheduled_at, '%Y-%m-%dT%H:%i:%sZ'), 'location_or_link', location_or_link, 'status', status, 'notes', notes)) AS interviews FROM interviews GROUP BY application_id) i ON i.application_id = v.id`
	args := []any{}
	conditions := []string{}
	if status != "" {
		conditions = append(conditions, "v.status = ?")
		args = append(args, status)
	} else {
		// Drafts have not been submitted, so they are not the reviewer's business yet.
		conditions = append(conditions, "v.status <> 'draft'")
	}
	if role != "" {
		conditions = append(conditions, "u.role = ?")
		args = append(args, role)
	}
	if len(conditions) > 0 {
		query += ` WHERE ` + strings.Join(conditions, " AND ")
	}
	query += ` ORDER BY v.submitted_at ASC`
	if err := s.db.SelectContext(ctx, &rows, query, args...); err != nil {
		return nil, err
	}
	for i := range rows {
		if !familyRole(rows[i].Role) {
			continue
		}
		family, err := s.familyContext(ctx, rows[i].Role, rows[i].UserID)
		if err != nil {
			return nil, err
		}
		rows[i].Family = family
	}
	return rows, nil
}

func (s *Service) RecordInterviewOutcome(ctx context.Context, reviewerID, interviewID, status, notes string) error {
	if status != "completed" && status != "cancelled" {
		return ErrInvalidState
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	var applicationID, currentStatus string
	if err = tx.QueryRowxContext(ctx, `SELECT application_id, status FROM interviews WHERE id = ? FOR UPDATE`, interviewID).Scan(&applicationID, &currentStatus); err != nil {
		_ = tx.Rollback()
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if currentStatus != "scheduled" {
		_ = tx.Rollback()
		return ErrConflict
	}
	var userID string
	if err = tx.GetContext(ctx, &userID, `SELECT user_id FROM verification_applications WHERE id = ?`, applicationID); err != nil {
		_ = tx.Rollback()
		return err
	}
	// A cancelled interview returns the account to the review queue instead of
	// leaving it stuck in interview_scheduled.
	nextAccountStatus := "pending"
	if status == "completed" {
		nextAccountStatus = "interview_completed"
	}
	if _, err = tx.ExecContext(ctx, `UPDATE interviews SET status = ?, notes = ? WHERE id = ?`, status, nullIfEmpty(notes), interviewID); err == nil {
		_, err = tx.ExecContext(ctx, `UPDATE users SET account_status = ? WHERE id = ? AND account_status = 'interview_scheduled'`, nextAccountStatus, userID)
	}
	if err == nil {
		_, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('interview_id', ?, 'notes', ?))`, uuid.NewString(), reviewerID, userID, "interview_"+status, interviewID, notes)
	}
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (s *Service) ListDocuments(ctx context.Context, applicationID string) ([]Document, error) {
	documents := []Document{}
	err := s.db.SelectContext(ctx, &documents, `SELECT id, application_id, document_type, original_name, mime_type, byte_size, uploaded_at FROM verification_documents WHERE application_id = ? ORDER BY uploaded_at DESC`, applicationID)
	return documents, err
}

func (s *Service) GetDocument(ctx context.Context, documentID string) (StoredDocument, error) {
	var document StoredDocument
	err := s.db.GetContext(ctx, &document, `SELECT d.id, d.application_id, d.document_type, d.original_name, d.mime_type, d.byte_size, d.uploaded_at, a.user_id AS owner_id, d.storage_key FROM verification_documents d JOIN verification_applications a ON a.id = d.application_id WHERE d.id = ?`, documentID)
	if errors.Is(err, sql.ErrNoRows) {
		return StoredDocument{}, ErrNotFound
	}
	return document, err
}

// DocumentContent loads a stored verification picture.
func (s *Service) DocumentContent(ctx context.Context, key string) ([]byte, error) {
	return s.files.Get(ctx, key)
}

func (s *Service) CreateInterview(ctx context.Context, reviewerID, applicationID, mode, scheduledAt, location string) error {
	if mode != "online" && mode != "in_person" {
		return ErrInvalidState
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	var application struct {
		UserID string `db:"user_id"`
		Status string `db:"status"`
	}
	if err = tx.GetContext(ctx, &application, `SELECT user_id, status FROM verification_applications WHERE id = ? FOR UPDATE`, applicationID); err != nil {
		_ = tx.Rollback()
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if application.Status != "pending" && application.Status != "under_review" {
		_ = tx.Rollback()
		return ErrConflict
	}
	userID := application.UserID
	_, err = tx.ExecContext(ctx, `INSERT INTO interviews (id, application_id, scheduled_by, mode, scheduled_at, location_or_link) VALUES (?, ?, ?, ?, ?, ?)`, uuid.NewString(), applicationID, reviewerID, mode, scheduledAt, nullIfEmpty(location))
	if err == nil {
		_, err = tx.ExecContext(ctx, `UPDATE users SET account_status = 'interview_scheduled' WHERE id = ?`, userID)
	}
	if err == nil {
		_, err = tx.ExecContext(ctx, `INSERT INTO notifications (id, user_id, kind, title, body) VALUES (?, ?, 'interview_scheduled', 'Interview scheduled', 'An administrator scheduled your verification interview.')`, uuid.NewString(), userID)
	}
	if err == nil {
		_, err = tx.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, 'interview_scheduled', JSON_OBJECT('application_id', ?, 'mode', ?, 'scheduled_at', ?))`, uuid.NewString(), reviewerID, userID, applicationID, mode, scheduledAt)
	}
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func (s *Service) Notifications(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.db.QueryxContext(ctx, `SELECT id, kind, title, body, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []map[string]any
	for rows.Next() {
		var id, kind, title, body string
		var readAt, createdAt *time.Time
		if err := rows.Scan(&id, &kind, &title, &body, &readAt, &createdAt); err != nil {
			return nil, err
		}
		result = append(result, map[string]any{"id": id, "kind": kind, "title": title, "body": body, "read_at": readAt, "created_at": createdAt})
	}
	return result, rows.Err()
}

func (s *Service) CreateRelationship(ctx context.Context, guardianID, studentID, relationship string) error {
	var roles struct {
		GuardianRole string `db:"guardian_role"`
		StudentRole  string `db:"student_role"`
	}
	if err := s.db.GetContext(ctx, &roles, `SELECT (SELECT role FROM users WHERE id = ?) AS guardian_role, (SELECT role FROM users WHERE id = ?) AS student_role`, guardianID, studentID); err != nil {
		return err
	}
	if roles.GuardianRole != "parent" || roles.StudentRole != "student" || relationship == "" {
		return ErrForbidden
	}
	_, err := s.db.ExecContext(ctx, `INSERT INTO guardian_student_links (id, guardian_id, student_id, relationship) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE relationship = VALUES(relationship), status = 'pending', reviewed_by = NULL, reviewed_at = NULL`, uuid.NewString(), guardianID, studentID, relationship)
	return err
}

func (s *Service) Relationships(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.db.QueryxContext(ctx, `SELECT id, guardian_id, student_id, relationship, status, created_at FROM guardian_student_links WHERE guardian_id = ? OR student_id = ? ORDER BY created_at DESC`, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []map[string]any
	for rows.Next() {
		var id, guardianID, studentID, relationship, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &guardianID, &studentID, &relationship, &status, &createdAt); err != nil {
			return nil, err
		}
		result = append(result, map[string]any{"id": id, "guardian_id": guardianID, "student_id": studentID, "relationship": relationship, "status": status, "created_at": createdAt})
	}
	return result, rows.Err()
}

func (s *Service) ListTuition(ctx context.Context, subject, className, area string) ([]map[string]any, error) {
	query := `SELECT id, owner_id, subject, class_name, area, mode, schedule, budget, requirements, created_at FROM tuition_listings WHERE status = 'open'`
	args := []any{}
	if subject != "" {
		query += ` AND subject = ?`
		args = append(args, subject)
	}
	if className != "" {
		query += ` AND class_name = ?`
		args = append(args, className)
	}
	if area != "" {
		query += ` AND area = ?`
		args = append(args, area)
	}
	query += ` ORDER BY created_at DESC LIMIT 100`
	rows, err := s.db.QueryxContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []map[string]any
	for rows.Next() {
		var id, ownerID, subjectValue, classValue, areaValue, mode string
		var requirements *string // optional on posts
		var schedule []byte
		var budget *float64
		var createdAt time.Time
		if err := rows.Scan(&id, &ownerID, &subjectValue, &classValue, &areaValue, &mode, &schedule, &budget, &requirements, &createdAt); err != nil {
			return nil, err
		}
		result = append(result, map[string]any{"id": id, "owner_id": ownerID, "subject": subjectValue, "class_name": classValue, "area": areaValue, "mode": mode, "schedule": json.RawMessage(schedule), "budget": budget, "requirements": requirements, "created_at": createdAt})
	}
	return result, rows.Err()
}

// SaveDocument stores one verification picture for the applicant, creating a
// draft application on the first upload. requestedApplicationID is optional;
// when given it must be the caller's own application.
func (s *Service) SaveDocument(ctx context.Context, ownerID, requestedApplicationID, documentType, originalName string, content []byte) (Document, error) {
	mime, err := validateImage(content)
	if err != nil {
		return Document{}, err
	}
	var role string
	if err := s.db.GetContext(ctx, &role, `SELECT role FROM users WHERE id = ?`, ownerID); err != nil {
		return Document{}, err
	}
	if !verifiableRole(role) {
		return Document{}, ErrForbidden
	}
	if !allowedDocumentType(role, documentType) {
		return Document{}, ErrInvalidState
	}
	if requestedApplicationID != "" {
		var owner string
		err := s.db.GetContext(ctx, &owner, `SELECT user_id FROM verification_applications WHERE id = ?`, requestedApplicationID)
		if errors.Is(err, sql.ErrNoRows) || (err == nil && owner != ownerID) {
			return Document{}, ErrForbidden
		}
		if err != nil {
			return Document{}, err
		}
	}
	// INSERT IGNORE relies on the one-application-per-user unique key, so concurrent first uploads share one draft.
	if _, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO verification_applications (id, user_id, status) VALUES (?, ?, 'draft')`, uuid.NewString(), ownerID); err != nil {
		return Document{}, err
	}
	var application struct {
		ID     string `db:"id"`
		Status string `db:"status"`
	}
	if err := s.db.GetContext(ctx, &application, `SELECT id, status FROM verification_applications WHERE user_id = ?`, ownerID); err != nil {
		return Document{}, err
	}
	if !editableApplication(application.Status) {
		return Document{}, ErrConflict
	}
	var previousKey string
	err = s.db.GetContext(ctx, &previousKey, `SELECT storage_key FROM verification_documents WHERE application_id = ? AND document_type = ?`, application.ID, documentType)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return Document{}, err
	}
	key := uuid.NewString()
	if err := s.files.Put(ctx, key, mime, content); err != nil {
		return Document{}, err
	}
	digest := sha256.Sum256(content)
	name := filepath.Base(originalName)
	if len(name) > 200 {
		name = name[len(name)-200:]
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO verification_documents (id, application_id, document_type, storage_key, original_name, mime_type, byte_size, sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE storage_key = VALUES(storage_key), original_name = VALUES(original_name), mime_type = VALUES(mime_type), byte_size = VALUES(byte_size), sha256 = VALUES(sha256), uploaded_at = UTC_TIMESTAMP(6)`, uuid.NewString(), application.ID, documentType, key, name, mime, len(content), hex.EncodeToString(digest[:]))
	if err != nil {
		s.files.Delete(ctx, key)
		return Document{}, err
	}
	// A re-upload replaces the row, so the superseded file would otherwise be orphaned.
	if previousKey != "" {
		s.files.Delete(ctx, previousKey)
	}
	_, _ = s.db.ExecContext(ctx, `INSERT INTO audit_logs (id, actor_id, subject_user_id, action, metadata) VALUES (?, ?, ?, 'document_uploaded', JSON_OBJECT('application_id', ?, 'document_type', ?, 'replaced', ?))`, uuid.NewString(), ownerID, ownerID, application.ID, documentType, previousKey != "")
	var doc Document
	err = s.db.GetContext(ctx, &doc, `SELECT id, application_id, document_type, original_name, mime_type, byte_size, uploaded_at FROM verification_documents WHERE application_id = ? AND document_type = ?`, application.ID, documentType)
	return doc, err
}

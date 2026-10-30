package platform

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// ---------- public discovery ----------

// TutorCard is what anyone may see about a verified, listed tutor. Contact
// details are never included; they are shared only inside an active tuition.
type TutorCard struct {
	ID              string          `db:"id" json:"id"`
	Name            string          `db:"name" json:"name"`
	Bio             *string         `db:"bio" json:"bio"`
	Institution     *string         `db:"institution" json:"institution"`
	Education       *string         `db:"education" json:"education"`
	CurrentStudy    *string         `db:"current_study" json:"current_study"`
	Results         *string         `db:"results" json:"results"`
	Subjects        json.RawMessage `db:"subjects" json:"subjects"`
	Classes         json.RawMessage `db:"classes" json:"classes"`
	Areas           json.RawMessage `db:"areas" json:"areas"`
	Mediums         json.RawMessage `db:"mediums" json:"mediums"`
	TeachingModes   json.RawMessage `db:"teaching_modes" json:"teaching_modes"`
	Availability    json.RawMessage `db:"availability" json:"availability"`
	ExperienceYears *float64        `db:"experience_years" json:"experience_years"`
	Fee             *float64        `db:"fee_expectation" json:"fee_expectation"`
	Gender          *string         `db:"gender" json:"gender"`
	HasPhoto        bool            `db:"has_photo" json:"has_photo"`
	Rating          float64         `db:"rating" json:"rating"`
	ReviewCount     int             `db:"review_count" json:"review_count"`
	TuitionsDone    int             `db:"tuitions_done" json:"tuitions_done"`
	EducationProof  bool            `db:"education_proof" json:"education_verified"`
	MemberSince     time.Time       `db:"created_at" json:"member_since"`
}

const tutorCardSelect = `SELECT u.id, u.name, p.bio, p.institution, p.education, p.current_study, p.results,
	COALESCE(p.subjects, JSON_ARRAY()) AS subjects, COALESCE(p.classes, JSON_ARRAY()) AS classes, COALESCE(p.areas, JSON_ARRAY()) AS areas,
	COALESCE(p.mediums, JSON_ARRAY()) AS mediums, COALESCE(p.teaching_modes, JSON_ARRAY()) AS teaching_modes, COALESCE(p.availability, JSON_OBJECT()) AS availability,
	p.experience_years, p.fee_expectation, p.gender, p.photo_key IS NOT NULL AS has_photo,
	COALESCE((SELECT AVG(r.stars) FROM reviews r WHERE r.subject_id = u.id), 0) AS rating,
	(SELECT COUNT(*) FROM reviews r WHERE r.subject_id = u.id) AS review_count,
	(SELECT COUNT(*) FROM engagements e WHERE e.tutor_id = u.id AND e.status IN ('active', 'completed')) AS tuitions_done,
	EXISTS(SELECT 1 FROM verification_documents d JOIN verification_applications v ON v.id = d.application_id WHERE v.user_id = u.id AND v.status = 'approved' AND d.document_type = 'education') AS education_proof,
	u.created_at
	FROM users u JOIN role_profiles p ON p.user_id = u.id`

// Only approved, active, listed accounts of the role are discoverable.
const discoverable = ` u.account_status = 'active' AND p.listed = 1 AND EXISTS(SELECT 1 FROM verification_applications v WHERE v.user_id = u.id AND v.status = 'approved')`

type tutorFilter struct {
	Subject, Area, Class, Mode, Query string
	MaxFee                            float64
	Limit, Offset                     int
}

func (s *Service) SearchTutors(ctx context.Context, f tutorFilter) ([]TutorCard, int, error) {
	where := []string{"u.role = 'tutor' AND" + discoverable}
	args := []any{}
	for _, jf := range []struct{ col, val string }{{"p.subjects", f.Subject}, {"p.areas", f.Area}, {"p.classes", f.Class}, {"p.teaching_modes", f.Mode}} {
		if jf.val != "" {
			where = append(where, "JSON_CONTAINS("+jf.col+", JSON_QUOTE(?))")
			args = append(args, jf.val)
		}
	}
	if f.MaxFee > 0 {
		where = append(where, "(p.fee_expectation IS NULL OR p.fee_expectation <= ?)")
		args = append(args, f.MaxFee)
	}
	if strings.TrimSpace(f.Query) != "" {
		where = append(where, "(u.name LIKE ? OR p.bio LIKE ? OR p.institution LIKE ?)")
		like := likePattern(f.Query)
		args = append(args, like, like, like)
	}
	cond := " WHERE " + strings.Join(where, " AND ")
	var total int
	if err := s.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM users u JOIN role_profiles p ON p.user_id = u.id`+cond, args...); err != nil {
		return nil, 0, err
	}
	cards := []TutorCard{}
	query := tutorCardSelect + cond + ` ORDER BY rating DESC, review_count DESC, u.created_at ASC LIMIT ? OFFSET ?`
	err := s.db.SelectContext(ctx, &cards, query, append(args, f.Limit, f.Offset)...)
	return cards, total, err
}

func (s *Service) Tutor(ctx context.Context, id string) (TutorCard, error) {
	var card TutorCard
	query := tutorCardSelect + ` WHERE u.id = ? AND u.role = 'tutor' AND` + discoverable
	err := s.db.GetContext(ctx, &card, query, id)
	if errors.Is(err, sql.ErrNoRows) {
		return card, notFound("tutor not found")
	}
	return card, err
}

type CentreCard struct {
	ID          string          `db:"id" json:"id"`
	Name        string          `db:"name" json:"name"`
	Institution *string         `db:"institution" json:"institution"`
	Bio         *string         `db:"bio" json:"about"`
	Subjects    json.RawMessage `db:"subjects" json:"subjects"`
	Classes     json.RawMessage `db:"classes" json:"levels"`
	Areas       json.RawMessage `db:"areas" json:"areas"`
	Hours       *string         `db:"opening_hours" json:"opening_hours"`
	Established *string         `db:"established" json:"established"`
	HasPhoto    bool            `db:"has_photo" json:"has_photo"`
	Rating      float64         `db:"rating" json:"rating"`
	ReviewCount int             `db:"review_count" json:"review_count"`
	Teachers    int             `db:"teachers" json:"teachers"`
	Students    int             `db:"students" json:"students"`
	Batches     int             `db:"batches" json:"batches"`
}

const centreSelect = `SELECT u.id, u.name, p.institution, p.bio, COALESCE(p.subjects, JSON_ARRAY()) AS subjects, COALESCE(p.classes, JSON_ARRAY()) AS classes,
	COALESCE(p.areas, JSON_ARRAY()) AS areas, p.opening_hours, p.established, p.photo_key IS NOT NULL AS has_photo,
	COALESCE((SELECT AVG(r.stars) FROM reviews r WHERE r.subject_id = u.id), 0) AS rating,
	(SELECT COUNT(*) FROM reviews r WHERE r.subject_id = u.id) AS review_count,
	(SELECT COUNT(*) FROM coaching_teachers t WHERE t.coaching_id = u.id AND t.status = 'active') AS teachers,
	(SELECT COUNT(*) FROM coaching_students cs WHERE cs.coaching_id = u.id AND cs.status = 'active') AS students,
	(SELECT COUNT(*) FROM coaching_batches b WHERE b.coaching_id = u.id AND b.status = 'active') AS batches
	FROM users u JOIN role_profiles p ON p.user_id = u.id`

func (s *Service) SearchCentres(ctx context.Context, subject, area, q string, limit, offset int) ([]CentreCard, int, error) {
	where := []string{"u.role = 'coaching' AND" + discoverable}
	args := []any{}
	if subject != "" {
		where = append(where, "JSON_CONTAINS(p.subjects, JSON_QUOTE(?))")
		args = append(args, subject)
	}
	if area != "" {
		where = append(where, "JSON_CONTAINS(p.areas, JSON_QUOTE(?))")
		args = append(args, area)
	}
	if strings.TrimSpace(q) != "" {
		where = append(where, "(u.name LIKE ? OR p.institution LIKE ?)")
		args = append(args, likePattern(q), likePattern(q))
	}
	cond := " WHERE " + strings.Join(where, " AND ")
	var total int
	if err := s.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM users u JOIN role_profiles p ON p.user_id = u.id`+cond, args...); err != nil {
		return nil, 0, err
	}
	out := []CentreCard{}
	err := s.db.SelectContext(ctx, &out, centreSelect+cond+` ORDER BY rating DESC, u.created_at ASC LIMIT ? OFFSET ?`, append(args, limit, offset)...)
	return out, total, err
}

type CentreDetail struct {
	CentreCard
	TeacherList []struct {
		Name    string  `db:"name" json:"name"`
		Subject *string `db:"subject" json:"subject"`
	} `json:"teacher_list"`
	BatchList []struct {
		Name     string   `db:"name" json:"name"`
		Subject  string   `db:"subject" json:"subject"`
		Class    *string  `db:"class_name" json:"class_name"`
		Days     *string  `db:"days" json:"days"`
		TimeSlot *string  `db:"time_slot" json:"time_slot"`
		Fee      *float64 `db:"monthly_fee" json:"monthly_fee"`
	} `json:"batch_list"`
}

func (s *Service) Centre(ctx context.Context, id string) (CentreDetail, error) {
	var d CentreDetail
	err := s.db.GetContext(ctx, &d.CentreCard, centreSelect+` WHERE u.id = ? AND u.role = 'coaching' AND`+discoverable, id)
	if errors.Is(err, sql.ErrNoRows) {
		return d, notFound("coaching centre not found")
	}
	if err != nil {
		return d, err
	}
	if err = s.db.SelectContext(ctx, &d.TeacherList, `SELECT name, subject FROM coaching_teachers WHERE coaching_id = ? AND status = 'active' ORDER BY name`, id); err != nil {
		return d, err
	}
	err = s.db.SelectContext(ctx, &d.BatchList, `SELECT name, subject, class_name, days, time_slot, monthly_fee FROM coaching_batches WHERE coaching_id = ? AND status = 'active' ORDER BY name`, id)
	return d, err
}

type PublicReview struct {
	ID        string     `db:"id" json:"id"`
	Stars     int        `db:"stars" json:"stars"`
	Body      *string    `db:"body" json:"body"`
	Reply     *string    `db:"reply" json:"reply"`
	By        string     `db:"reviewer" json:"by"`
	ByRole    string     `db:"reviewer_role" json:"by_role"`
	Subject   string     `db:"subject" json:"subject"`
	CreatedAt time.Time  `db:"created_at" json:"created_at"`
	RepliedAt *time.Time `db:"replied_at" json:"replied_at"`
}

func (s *Service) ReviewsFor(ctx context.Context, userID string) ([]PublicReview, error) {
	out := []PublicReview{}
	err := s.db.SelectContext(ctx, &out, `SELECT r.id, r.stars, r.body, r.reply, u.name AS reviewer, u.role AS reviewer_role, CONCAT(e.subject, ', ', e.class_name) AS subject, r.created_at, r.replied_at
		FROM reviews r JOIN users u ON u.id = r.reviewer_id JOIN engagements e ON e.id = r.engagement_id WHERE r.subject_id = ? ORDER BY r.created_at DESC LIMIT 100`, userID)
	return out, err
}

// ---------- tuition posts ----------

type Listing struct {
	ID           string    `db:"id" json:"id"`
	OwnerID      string    `db:"owner_id" json:"owner_id"`
	OwnerRole    string    `db:"owner_role" json:"owner_role"`
	OwnerName    string    `db:"owner_name" json:"owner_name"`
	StudentID    *string   `db:"student_id" json:"student_id"`
	Subject      string    `db:"subject" json:"subject"`
	ClassName    string    `db:"class_name" json:"class_name"`
	Medium       *string   `db:"medium" json:"medium"`
	Area         string    `db:"area" json:"area"`
	Mode         string    `db:"mode" json:"mode"`
	Days         *string   `db:"days" json:"days"`
	TimeSlot     *string   `db:"time_slot" json:"time_slot"`
	Budget       *float64  `db:"budget" json:"budget"`
	Requirements *string   `db:"requirements" json:"requirements"`
	Status       string    `db:"status" json:"status"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	Applicants   int       `db:"applicants" json:"applicants"`
	// Caller-specific fields; empty for anonymous callers.
	MyApplication *string `db:"my_application" json:"my_application"`
	Saved         bool    `db:"saved" json:"saved"`
}

const listingSelect = `SELECT l.id, l.owner_id, o.role AS owner_role, o.name AS owner_name, l.student_id, l.subject, l.class_name, l.medium, l.area, l.mode, l.days, l.time_slot, l.budget, l.requirements, l.status, l.created_at,
	(SELECT COUNT(*) FROM tuition_applications a WHERE a.listing_id = l.id AND a.status <> 'withdrawn') AS applicants,
	(SELECT a.status FROM tuition_applications a WHERE a.listing_id = l.id AND a.tutor_id = ?) AS my_application,
	EXISTS(SELECT 1 FROM saved_listings sv WHERE sv.listing_id = l.id AND sv.user_id = ?) AS saved
	FROM tuition_listings l JOIN users o ON o.id = l.owner_id`

type listingFilter struct {
	Subject, Class, Area, Mode, Query string
	MinBudget                         float64
	SavedOnly                         bool
	Limit, Offset                     int
}

func (s *Service) SearchListings(ctx context.Context, viewer string, f listingFilter) ([]Listing, int, error) {
	where := []string{"l.status = 'open'", "o.account_status <> 'suspended'"}
	args := []any{}
	for _, eq := range []struct{ col, val string }{{"l.subject", f.Subject}, {"l.class_name", f.Class}, {"l.area", f.Area}, {"l.mode", f.Mode}} {
		if eq.val != "" {
			where = append(where, eq.col+" = ?")
			args = append(args, eq.val)
		}
	}
	if f.MinBudget > 0 {
		where = append(where, "l.budget >= ?")
		args = append(args, f.MinBudget)
	}
	if strings.TrimSpace(f.Query) != "" {
		where = append(where, "(l.subject LIKE ? OR l.requirements LIKE ? OR l.area LIKE ?)")
		like := likePattern(f.Query)
		args = append(args, like, like, like)
	}
	if f.SavedOnly {
		where = append(where, "EXISTS(SELECT 1 FROM saved_listings sv WHERE sv.listing_id = l.id AND sv.user_id = ?)")
		args = append(args, viewer)
	}
	cond := " WHERE " + strings.Join(where, " AND ")
	var total int
	if err := s.db.GetContext(ctx, &total, `SELECT COUNT(*) FROM tuition_listings l JOIN users o ON o.id = l.owner_id`+cond, args...); err != nil {
		return nil, 0, err
	}
	out := []Listing{}
	err := s.db.SelectContext(ctx, &out, listingSelect+cond+` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`, append(append([]any{viewer, viewer}, args...), f.Limit, f.Offset)...)
	return out, total, err
}

func (s *Service) Listing(ctx context.Context, viewer, id string) (Listing, error) {
	var l Listing
	err := s.db.GetContext(ctx, &l, listingSelect+` WHERE l.id = ?`, viewer, viewer, id)
	if errors.Is(err, sql.ErrNoRows) {
		return l, notFound("tuition post not found")
	}
	return l, err
}

type listingInput struct {
	Subject      string   `json:"subject" validate:"required,max=100"`
	ClassName    string   `json:"class_name" validate:"required,max=60"`
	Medium       string   `json:"medium" validate:"max=60"`
	Area         string   `json:"area" validate:"required,max=120"`
	Mode         string   `json:"mode" validate:"required,oneof=online offline both"`
	Days         string   `json:"days" validate:"max=80"`
	TimeSlot     string   `json:"time_slot" validate:"max=60"`
	Budget       *float64 `json:"budget" validate:"omitempty,gte=0,lte=1000000"`
	Requirements string   `json:"requirements" validate:"max=2000"`
	StudentID    string   `json:"student_id" validate:"omitempty,uuid"`
}

// CreateListing lets a parent (for a linked child) or a student post a tuition need.
func (s *Service) CreateListing(ctx context.Context, ownerID, ownerRole string, in listingInput) (string, error) {
	if ownerRole == "parent" && in.StudentID != "" && !s.guardianOf(ctx, ownerID, in.StudentID) {
		return "", forbidden("you can only post for a student linked to your account")
	}
	studentID := in.StudentID
	if ownerRole == "student" {
		studentID = ownerID
	}
	id := newID()
	_, err := s.db.ExecContext(ctx, `INSERT INTO tuition_listings (id, owner_id, student_id, subject, class_name, medium, area, mode, days, time_slot, budget, requirements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, ownerID, nullable(studentID), strings.TrimSpace(in.Subject), strings.TrimSpace(in.ClassName), nullable(in.Medium), strings.TrimSpace(in.Area), in.Mode, nullable(in.Days), nullable(in.TimeSlot), in.Budget, nullable(in.Requirements))
	return id, err
}

func (s *Service) MyListings(ctx context.Context, ownerID string) ([]Listing, error) {
	out := []Listing{}
	err := s.db.SelectContext(ctx, &out, listingSelect+` WHERE l.owner_id = ? ORDER BY l.created_at DESC`, ownerID, ownerID, ownerID)
	return out, err
}

func (s *Service) UpdateListing(ctx context.Context, actorID, actorRole, id string, in listingInput, status string) error {
	var owner, current string
	if err := s.db.QueryRowxContext(ctx, `SELECT owner_id, status FROM tuition_listings WHERE id = ?`, id).Scan(&owner, &current); errors.Is(err, sql.ErrNoRows) {
		return notFound("tuition post not found")
	} else if err != nil {
		return err
	}
	if owner != actorID && actorRole != "admin" {
		return forbidden("only the poster can change this tuition post")
	}
	if status != "" {
		if status != "open" && status != "paused" && status != "filled" && status != "closed" {
			return badRequest("status must be open, paused, filled or closed")
		}
		if current == "closed" && actorRole != "admin" {
			return conflict("a closed post cannot be reopened")
		}
		_, err := s.db.ExecContext(ctx, `UPDATE tuition_listings SET status = ? WHERE id = ?`, status, id)
		return err
	}
	_, err := s.db.ExecContext(ctx, `UPDATE tuition_listings SET subject = ?, class_name = ?, medium = ?, area = ?, mode = ?, days = ?, time_slot = ?, budget = ?, requirements = ? WHERE id = ?`,
		strings.TrimSpace(in.Subject), strings.TrimSpace(in.ClassName), nullable(in.Medium), strings.TrimSpace(in.Area), in.Mode, nullable(in.Days), nullable(in.TimeSlot), in.Budget, nullable(in.Requirements), id)
	return err
}

// ---------- applications ----------

type Application struct {
	ID        string    `db:"id" json:"id"`
	ListingID string    `db:"listing_id" json:"listing_id"`
	TutorID   string    `db:"tutor_id" json:"tutor_id"`
	TutorName string    `db:"tutor_name" json:"tutor_name"`
	Note      *string   `db:"note" json:"note"`
	Status    string    `db:"status" json:"status"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	Subject   string    `db:"subject" json:"subject"`
	ClassName string    `db:"class_name" json:"class_name"`
	Area      string    `db:"area" json:"area"`
	Budget    *float64  `db:"budget" json:"budget"`
	PostState string    `db:"post_status" json:"post_status"`
	OwnerID   string    `db:"owner_id" json:"owner_id"`
	OwnerName string    `db:"owner_name" json:"owner_name"`
	Rating    float64   `db:"rating" json:"tutor_rating"`
}

const applicationSelect = `SELECT a.id, a.listing_id, a.tutor_id, t.name AS tutor_name, a.note, a.status, a.created_at, l.subject, l.class_name, l.area, l.budget, l.status AS post_status, l.owner_id, o.name AS owner_name,
	COALESCE((SELECT AVG(r.stars) FROM reviews r WHERE r.subject_id = a.tutor_id), 0) AS rating
	FROM tuition_applications a JOIN tuition_listings l ON l.id = a.listing_id JOIN users t ON t.id = a.tutor_id JOIN users o ON o.id = l.owner_id`

func (s *Service) Apply(ctx context.Context, tutorID, listingID, note string) error {
	var owner, status string
	if err := s.db.QueryRowxContext(ctx, `SELECT owner_id, status FROM tuition_listings WHERE id = ?`, listingID).Scan(&owner, &status); errors.Is(err, sql.ErrNoRows) {
		return notFound("tuition post not found")
	} else if err != nil {
		return err
	}
	if status != "open" {
		return conflict("this tuition post is not accepting applications")
	}
	if s.blocked(ctx, tutorID, owner) {
		return forbidden("you cannot apply to this post")
	}
	// A withdrawn application may be renewed; any other existing one is a duplicate.
	res, err := s.db.ExecContext(ctx, `INSERT INTO tuition_applications (id, listing_id, tutor_id, note) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE note = IF(status = 'withdrawn', VALUES(note), note), status = IF(status = 'withdrawn', 'applied', status)`, newID(), listingID, tutorID, nullable(note))
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return conflict("you have already applied to this tuition post")
	}
	s.notify(ctx, owner, "application_received", "New tutor application", s.userName(ctx, tutorID)+" applied to your tuition post.")
	return nil
}

func (s *Service) MyApplications(ctx context.Context, tutorID string) ([]Application, error) {
	out := []Application{}
	err := s.db.SelectContext(ctx, &out, applicationSelect+` WHERE a.tutor_id = ? ORDER BY a.created_at DESC`, tutorID)
	return out, err
}

func (s *Service) ListingApplications(ctx context.Context, actorID, actorRole, listingID string) ([]Application, error) {
	var owner string
	if err := s.db.GetContext(ctx, &owner, `SELECT owner_id FROM tuition_listings WHERE id = ?`, listingID); errors.Is(err, sql.ErrNoRows) {
		return nil, notFound("tuition post not found")
	} else if err != nil {
		return nil, err
	}
	if owner != actorID && actorRole != "admin" {
		return nil, forbidden("only the poster can see applications")
	}
	out := []Application{}
	err := s.db.SelectContext(ctx, &out, applicationSelect+` WHERE a.listing_id = ? AND a.status <> 'withdrawn' ORDER BY a.created_at`, listingID)
	return out, err
}

// SetApplicationStatus moves an application through its lifecycle. The tutor
// may only withdraw; the poster may shortlist, decline or accept. Accepting
// opens a conversation so the two can arrange a demo class.
func (s *Service) SetApplicationStatus(ctx context.Context, actorID, appID, status string) (map[string]any, error) {
	var a struct {
		TutorID, OwnerID, Status, ListingID string
	}
	err := s.db.QueryRowxContext(ctx, `SELECT a.tutor_id, l.owner_id, a.status, a.listing_id FROM tuition_applications a JOIN tuition_listings l ON l.id = a.listing_id WHERE a.id = ?`, appID).Scan(&a.TutorID, &a.OwnerID, &a.Status, &a.ListingID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, notFound("application not found")
	} else if err != nil {
		return nil, err
	}
	allowed := map[string]map[string][]string{
		// actor -> target status -> statuses it may come from
		"tutor": {"withdrawn": {"applied", "shortlisted"}},
		"owner": {"shortlisted": {"applied"}, "declined": {"applied", "shortlisted"}, "accepted": {"applied", "shortlisted"}},
	}
	who := ""
	switch actorID {
	case a.TutorID:
		who = "tutor"
	case a.OwnerID:
		who = "owner"
	default:
		return nil, forbidden("this is not your application")
	}
	from, ok := allowed[who][status]
	if !ok {
		return nil, badRequest("you cannot set this status")
	}
	valid := false
	for _, f := range from {
		valid = valid || f == a.Status
	}
	if !valid {
		return nil, conflict("the application cannot move from " + a.Status + " to " + status)
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE tuition_applications SET status = ? WHERE id = ?`, status, appID); err != nil {
		return nil, err
	}
	out := map[string]any{"status": status}
	switch status {
	case "accepted":
		conv, err := s.ensureConversation(ctx, a.OwnerID, a.TutorID, "Application accepted. You can now discuss details and arrange a demo class.")
		if err != nil {
			return nil, err
		}
		out["conversation_id"] = conv
		s.notify(ctx, a.TutorID, "application_accepted", "Application accepted", "A guardian accepted your tuition application. Open Messages to continue.")
	case "shortlisted":
		s.notify(ctx, a.TutorID, "application_shortlisted", "You were shortlisted", "A guardian shortlisted your tuition application.")
	case "declined":
		s.notify(ctx, a.TutorID, "application_declined", "Application declined", "A guardian declined your tuition application.")
	case "withdrawn":
		s.notify(ctx, a.OwnerID, "application_withdrawn", "Application withdrawn", s.userName(ctx, a.TutorID)+" withdrew their application.")
	}
	return out, nil
}

func (s *Service) SetSaved(ctx context.Context, userID, listingID string, save bool) error {
	if save {
		_, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO saved_listings (user_id, listing_id) SELECT ?, id FROM tuition_listings WHERE id = ?`, userID, listingID)
		return err
	}
	_, err := s.db.ExecContext(ctx, `DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?`, userID, listingID)
	return err
}

// ---------- profile photo ----------

func (s *Service) SetPhoto(c *gin.Context) {
	f, content, err := s.readUpload(c, "photo", false)
	if err == nil && f == nil {
		err = badRequest("choose a picture")
	}
	if err != nil {
		fail(c, err)
		return
	}
	if err := s.saveFile(f, content); err != nil {
		fail(c, err)
		return
	}
	var previous sql.NullString
	_ = s.db.GetContext(c.Request.Context(), &previous, `SELECT photo_key FROM role_profiles WHERE user_id = ?`, uid(c))
	if _, err := s.db.ExecContext(c.Request.Context(), `INSERT INTO role_profiles (user_id, photo_key, photo_mime) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE photo_key = VALUES(photo_key), photo_mime = VALUES(photo_mime)`, uid(c), f.Key, f.Mime); err != nil {
		s.removeFile(f.Key)
		fail(c, err)
		return
	}
	s.removeFile(previous.String)
	c.Status(http.StatusNoContent)
}

// Photo serves a profile picture. Photos of discoverable tutors and centres are
// public; anyone else's photo is visible only to themselves and admins.
func (s *Service) Photo(c *gin.Context, viewer, viewerRole string) {
	var p struct {
		Key  sql.NullString `db:"photo_key"`
		Mime sql.NullString `db:"photo_mime"`
		Pub  bool           `db:"pub"`
	}
	err := s.db.GetContext(c.Request.Context(), &p, `SELECT p.photo_key, p.photo_mime, (u.role IN ('tutor', 'coaching') AND`+discoverable+`) AS pub FROM users u JOIN role_profiles p ON p.user_id = u.id WHERE u.id = ?`, c.Param("id"))
	if err != nil || !p.Key.Valid {
		fail(c, notFound("photo not found"))
		return
	}
	if !p.Pub && viewer != c.Param("id") && viewerRole != "admin" && !s.related(c.Request.Context(), viewer, c.Param("id")) {
		fail(c, notFound("photo not found"))
		return
	}
	s.serveFile(c, p.Key.String, "photo", p.Mime.String)
}

// related reports whether two users share a conversation or a tuition.
func (s *Service) related(ctx context.Context, a, b string) bool {
	if a == "" {
		return false
	}
	var n int
	_ = s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM conversation_participants x JOIN conversation_participants y ON y.conversation_id = x.conversation_id WHERE x.user_id = ? AND y.user_id = ?`, a, b)
	return n > 0
}

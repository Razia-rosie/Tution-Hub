package platform

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type access int

const (
	noAccess     access = iota
	viewerAccess        // a guardian of a member: read-only
	memberAccess        // an enrolled student
	ownerAccess         // the tutor or coaching centre running the classroom
)

// classroomAccess decides what the user may do in a classroom.
func (s *Service) classroomAccess(ctx context.Context, userID, userRole, classroomID string) (access, error) {
	var owner string
	if err := s.db.GetContext(ctx, &owner, `SELECT owner_id FROM classrooms WHERE id = ?`, classroomID); errors.Is(err, sql.ErrNoRows) {
		return noAccess, notFound("classroom not found")
	} else if err != nil {
		return noAccess, err
	}
	if owner == userID {
		return ownerAccess, nil
	}
	if userRole == "admin" {
		return viewerAccess, nil
	}
	var n int
	if err := s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM classroom_members WHERE classroom_id = ? AND student_id = ?`, classroomID, userID); err != nil {
		return noAccess, err
	}
	if n > 0 {
		return memberAccess, nil
	}
	if err := s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM classroom_members m JOIN guardian_student_links l ON l.student_id = m.student_id AND l.status = 'approved' WHERE m.classroom_id = ? AND l.guardian_id = ?`, classroomID, userID); err != nil {
		return noAccess, err
	}
	if n > 0 {
		return viewerAccess, nil
	}
	return noAccess, notFound("classroom not found")
}

func (s *Service) needAccess(ctx context.Context, c *gin.Context, classroomID string, min access) (access, error) {
	a, err := s.classroomAccess(ctx, uid(c), role(c), classroomID)
	if err != nil {
		return a, err
	}
	if a < min {
		if min == ownerAccess {
			return a, forbidden("only the classroom's teacher can do this")
		}
		return a, forbidden("you cannot do this in this classroom")
	}
	return a, nil
}

type ClassroomSummary struct {
	ID           string    `db:"id" json:"id"`
	Name         string    `db:"name" json:"name"`
	Subject      *string   `db:"subject" json:"subject"`
	OwnerID      string    `db:"owner_id" json:"owner_id"`
	OwnerName    string    `db:"owner_name" json:"owner_name"`
	OwnerRole    string    `db:"owner_role" json:"owner_role"`
	EngagementID *string   `db:"engagement_id" json:"engagement_id"`
	Members      int       `db:"members" json:"members"`
	OpenWork     int       `db:"open_work" json:"open_assignments"`
	NextSession  *string   `db:"next_session" json:"next_session"`
	Archived     bool      `db:"archived" json:"archived"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	// Which linked child gives a guardian access (guardians only).
	ChildName *string `db:"child_name" json:"child_name"`
}

const classroomSummarySelect = `SELECT c.id, c.name, c.subject, c.owner_id, o.name AS owner_name, o.role AS owner_role, c.engagement_id,
	(SELECT COUNT(*) FROM classroom_members m WHERE m.classroom_id = c.id) AS members,
	(SELECT COUNT(*) FROM assignments a WHERE a.classroom_id = c.id AND a.due_at > UTC_TIMESTAMP(6)) AS open_work,
	(SELECT DATE_FORMAT(MIN(cs.starts_at), '%Y-%m-%dT%H:%i:%sZ') FROM class_sessions cs WHERE cs.classroom_id = c.id AND cs.status = 'scheduled' AND cs.starts_at > UTC_TIMESTAMP(6)) AS next_session,
	c.archived_at IS NOT NULL AS archived, c.created_at`

// Classrooms lists the classrooms the user teaches, attends, or (as a guardian) monitors.
func (s *Service) Classrooms(ctx context.Context, userID string) ([]ClassroomSummary, error) {
	out := []ClassroomSummary{}
	err := s.db.SelectContext(ctx, &out, classroomSummarySelect+`, NULL AS child_name FROM classrooms c JOIN users o ON o.id = c.owner_id
		WHERE c.owner_id = ? OR EXISTS(SELECT 1 FROM classroom_members m WHERE m.classroom_id = c.id AND m.student_id = ?)
		UNION ALL `+classroomSummarySelect+`, st.name AS child_name FROM classrooms c JOIN users o ON o.id = c.owner_id
		JOIN classroom_members m ON m.classroom_id = c.id JOIN guardian_student_links l ON l.student_id = m.student_id AND l.status = 'approved' AND l.guardian_id = ? JOIN users st ON st.id = m.student_id
		ORDER BY archived, created_at DESC`, userID, userID, userID)
	return out, err
}

func (s *Service) CreateClassroom(ctx context.Context, ownerID, name, subject, description string) (string, error) {
	id := newID()
	_, err := s.db.ExecContext(ctx, `INSERT INTO classrooms (id, owner_id, name, subject, description) VALUES (?, ?, ?, ?, ?)`, id, ownerID, strings.TrimSpace(name), nullable(subject), nullable(description))
	return id, err
}

type ClassroomDetail struct {
	ClassroomSummary
	Description *string `db:"description" json:"description"`
	Access      string  `db:"-" json:"access"`
	Members     []struct {
		ID    string  `db:"id" json:"id"`
		Name  string  `db:"name" json:"name"`
		Class *string `db:"class_name" json:"class_name"`
	} `db:"-" json:"members"`
	Materials   []Material   `db:"-" json:"materials"`
	Assignments []Assignment `db:"-" json:"assignments"`
	Sessions    []Session    `db:"-" json:"sessions"`
	Diary       []DiaryEntry `db:"-" json:"diary"`
}

type Material struct {
	ID        string    `db:"id" json:"id"`
	Title     string    `db:"title" json:"title"`
	Body      *string   `db:"body" json:"body"`
	LinkURL   *string   `db:"link_url" json:"link_url"`
	FileName  *string   `db:"file_name" json:"file_name"`
	FileMime  *string   `db:"file_mime" json:"file_mime"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type Assignment struct {
	ID           string    `db:"id" json:"id"`
	Kind         string    `db:"kind" json:"kind"`
	Title        string    `db:"title" json:"title"`
	Instructions *string   `db:"instructions" json:"instructions"`
	DueAt        time.Time `db:"due_at" json:"due_at"`
	MaxScore     *float64  `db:"max_score" json:"max_score"`
	CreatedAt    time.Time `db:"created_at" json:"created_at"`
	Submitted    int       `db:"submitted" json:"submitted_count"`
	// For a student viewer: their own submission.
	MyStatus   *string  `db:"my_status" json:"my_status"`
	MyScore    *float64 `db:"my_score" json:"my_score"`
	MyFeedback *string  `db:"my_feedback" json:"my_feedback"`
}

type Session struct {
	ID       string     `db:"id" json:"id"`
	StartsAt time.Time  `db:"starts_at" json:"starts_at"`
	EndsAt   *time.Time `db:"ends_at" json:"ends_at"`
	Status   string     `db:"status" json:"status"`
	Note     *string    `db:"note" json:"note"`
	Marks    []Mark     `db:"-" json:"marks"`
}

type Mark struct {
	SessionID   string `db:"session_id" json:"-"`
	LearnerKind string `db:"learner_kind" json:"learner_kind"`
	LearnerID   string `db:"learner_id" json:"learner_id"`
	Mark        string `db:"mark" json:"mark"`
}

type DiaryEntry struct {
	ID        string    `db:"id" json:"id"`
	EntryDate time.Time `db:"entry_date" json:"entry_date"`
	Topics    string    `db:"topics" json:"topics"`
	Homework  *string   `db:"homework" json:"homework"`
	Note      *string   `db:"note" json:"note"`
}

// ClassroomDetail returns everything a viewer may see. Students see only their
// own submission state and attendance marks; owners and guardians see members'.
func (s *Service) ClassroomDetail(c *gin.Context, id string) (ClassroomDetail, error) {
	ctx := c.Request.Context()
	var d ClassroomDetail
	a, err := s.needAccess(ctx, c, id, viewerAccess)
	if err != nil {
		return d, err
	}
	d.Access = map[access]string{viewerAccess: "viewer", memberAccess: "member", ownerAccess: "owner"}[a]
	if err = s.db.GetContext(ctx, &d, classroomSummarySelect+`, NULL AS child_name, c.description FROM classrooms c JOIN users o ON o.id = c.owner_id WHERE c.id = ?`, id); err != nil {
		return d, err
	}
	if err = s.db.SelectContext(ctx, &d.Members, `SELECT u.id, u.name, p.class_name FROM classroom_members m JOIN users u ON u.id = m.student_id LEFT JOIN role_profiles p ON p.user_id = u.id WHERE m.classroom_id = ? ORDER BY u.name`, id); err != nil {
		return d, err
	}
	d.Materials = []Material{}
	if err = s.db.SelectContext(ctx, &d.Materials, `SELECT id, title, body, link_url, file_name, file_mime, created_at FROM classroom_materials WHERE classroom_id = ? ORDER BY created_at DESC`, id); err != nil {
		return d, err
	}
	d.Assignments = []Assignment{}
	if err = s.db.SelectContext(ctx, &d.Assignments, `SELECT a.id, a.kind, a.title, a.instructions, a.due_at, a.max_score, a.created_at,
		(SELECT COUNT(*) FROM submissions x WHERE x.assignment_id = a.id) AS submitted,
		s.status AS my_status, s.score AS my_score, s.feedback AS my_feedback
		FROM assignments a LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ? WHERE a.classroom_id = ? ORDER BY a.due_at DESC`, uid(c), id); err != nil {
		return d, err
	}
	d.Sessions = []Session{}
	if err = s.db.SelectContext(ctx, &d.Sessions, `SELECT id, starts_at, ends_at, status, note FROM class_sessions WHERE classroom_id = ? ORDER BY starts_at DESC LIMIT 200`, id); err != nil {
		return d, err
	}
	marks := []Mark{}
	markQuery := `SELECT am.session_id, am.learner_kind, am.learner_id, am.mark FROM attendance_marks am JOIN class_sessions cs ON cs.id = am.session_id WHERE cs.classroom_id = ?`
	args := []any{id}
	if a == memberAccess {
		markQuery += ` AND am.learner_kind = 'user' AND am.learner_id = ?`
		args = append(args, uid(c))
	} else if a == viewerAccess && role(c) != "admin" {
		markQuery += ` AND am.learner_kind = 'user' AND am.learner_id IN (SELECT student_id FROM guardian_student_links WHERE guardian_id = ? AND status = 'approved')`
		args = append(args, uid(c))
	}
	if err = s.db.SelectContext(ctx, &marks, markQuery, args...); err != nil {
		return d, err
	}
	bySession := map[string][]Mark{}
	for _, m := range marks {
		bySession[m.SessionID] = append(bySession[m.SessionID], m)
	}
	for i := range d.Sessions {
		d.Sessions[i].Marks = bySession[d.Sessions[i].ID]
		if d.Sessions[i].Marks == nil {
			d.Sessions[i].Marks = []Mark{}
		}
	}
	d.Diary = []DiaryEntry{}
	err = s.db.SelectContext(ctx, &d.Diary, `SELECT id, entry_date, topics, homework, note FROM diary_entries WHERE classroom_id = ? ORDER BY entry_date DESC LIMIT 100`, id)
	return d, err
}

// AddMember enrols a student account (by email) into a tutor's classroom.
func (s *Service) AddMember(ctx context.Context, classroomID, email string) error {
	var st struct {
		ID   string `db:"id"`
		Role string `db:"role"`
	}
	err := s.db.GetContext(ctx, &st, `SELECT id, role FROM users WHERE email = ?`, strings.ToLower(strings.TrimSpace(email)))
	if errors.Is(err, sql.ErrNoRows) || (err == nil && st.Role != "student") {
		return notFound("no student account uses that email")
	}
	if err != nil {
		return err
	}
	if _, err = s.db.ExecContext(ctx, `INSERT IGNORE INTO classroom_members (classroom_id, student_id) VALUES (?, ?)`, classroomID, st.ID); err != nil {
		return err
	}
	s.notify(ctx, st.ID, "classroom_added", "Added to a classroom", "You were added to a classroom. Open My Tuition to see it.")
	return nil
}

func (s *Service) RemoveMember(ctx context.Context, classroomID, studentID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM classroom_members WHERE classroom_id = ? AND student_id = ?`, classroomID, studentID)
	return err
}

// notifyMembers tells every student in the classroom, and their approved guardians.
func (s *Service) notifyMembers(ctx context.Context, classroomID, kind, title, body string) {
	var ids []string
	_ = s.db.SelectContext(ctx, &ids, `SELECT student_id FROM classroom_members WHERE classroom_id = ? UNION SELECT l.guardian_id FROM classroom_members m JOIN guardian_student_links l ON l.student_id = m.student_id AND l.status = 'approved' WHERE m.classroom_id = ?`, classroomID, classroomID)
	for _, id := range ids {
		s.notify(ctx, id, kind, title, body)
	}
}

func (s *Service) AddMaterial(c *gin.Context, classroomID string) (string, error) {
	ctx := c.Request.Context()
	title := strings.TrimSpace(c.PostForm("title"))
	if title == "" || len(title) > 200 {
		return "", badRequest("a title of up to 200 characters is required")
	}
	link := strings.TrimSpace(c.PostForm("link_url"))
	if link != "" && !strings.HasPrefix(link, "https://") && !strings.HasPrefix(link, "http://") {
		return "", badRequest("links must start with http:// or https://")
	}
	f, content, err := s.readUpload(c, "file", true)
	if err != nil {
		return "", err
	}
	var key, name, mime any
	if f != nil {
		if err := s.saveFile(f, content); err != nil {
			return "", err
		}
		key, name, mime = f.Key, f.Name, f.Mime
	}
	id := newID()
	if _, err := s.db.ExecContext(ctx, `INSERT INTO classroom_materials (id, classroom_id, author_id, title, body, link_url, file_key, file_name, file_mime) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		id, classroomID, uid(c), title, nullable(c.PostForm("body")), nullable(link), key, name, mime); err != nil {
		if f != nil {
			s.removeFile(f.Key)
		}
		return "", err
	}
	s.notifyMembers(ctx, classroomID, "material_added", "New study material", title)
	return id, nil
}

func (s *Service) MaterialFile(c *gin.Context, materialID string) {
	var m struct {
		Classroom string         `db:"classroom_id"`
		Key       sql.NullString `db:"file_key"`
		Name      sql.NullString `db:"file_name"`
		Mime      sql.NullString `db:"file_mime"`
	}
	if err := s.db.GetContext(c.Request.Context(), &m, `SELECT classroom_id, file_key, file_name, file_mime FROM classroom_materials WHERE id = ?`, materialID); err != nil || !m.Key.Valid {
		fail(c, notFound("file not found"))
		return
	}
	if _, err := s.needAccess(c.Request.Context(), c, m.Classroom, viewerAccess); err != nil {
		fail(c, err)
		return
	}
	s.serveFile(c, m.Key.String, m.Name.String, m.Mime.String)
}

type assignmentInput struct {
	Kind         string   `json:"kind" validate:"required,oneof=homework assignment"`
	Title        string   `json:"title" validate:"required,max=200"`
	Instructions string   `json:"instructions" validate:"max=5000"`
	DueAt        string   `json:"due_at" validate:"required"`
	MaxScore     *float64 `json:"max_score" validate:"omitempty,gt=0,lte=1000"`
}

func (s *Service) CreateAssignment(ctx context.Context, authorID, classroomID string, in assignmentInput) (string, error) {
	due, err := time.Parse(time.RFC3339, in.DueAt)
	if err != nil {
		return "", badRequest("due_at must be an ISO date and time")
	}
	id := newID()
	if _, err := s.db.ExecContext(ctx, `INSERT INTO assignments (id, classroom_id, author_id, kind, title, instructions, due_at, max_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, classroomID, authorID, in.Kind, strings.TrimSpace(in.Title), nullable(in.Instructions), due.UTC(), in.MaxScore); err != nil {
		return "", err
	}
	s.notifyMembers(ctx, classroomID, "assignment_created", "New "+in.Kind, in.Title+" is due "+due.Format("2 Jan 2006 15:04")+" UTC.")
	return id, nil
}

func (s *Service) assignmentClassroom(ctx context.Context, assignmentID string) (string, error) {
	var classroom string
	err := s.db.GetContext(ctx, &classroom, `SELECT classroom_id FROM assignments WHERE id = ?`, assignmentID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", notFound("assignment not found")
	}
	return classroom, err
}

// Submit records (or, before review, replaces) a student's submission.
func (s *Service) Submit(c *gin.Context, assignmentID string) error {
	ctx := c.Request.Context()
	classroom, err := s.assignmentClassroom(ctx, assignmentID)
	if err != nil {
		return err
	}
	if a, err := s.needAccess(ctx, c, classroom, memberAccess); err != nil {
		return err
	} else if a != memberAccess {
		return forbidden("only students in this classroom submit work")
	}
	note := strings.TrimSpace(c.PostForm("note"))
	f, content, err := s.readUpload(c, "file", true)
	if err != nil {
		return err
	}
	if f == nil && note == "" {
		return badRequest("add a note or attach a file")
	}
	var prev struct {
		Status string         `db:"status"`
		Key    sql.NullString `db:"file_key"`
	}
	err = s.db.GetContext(ctx, &prev, `SELECT status, file_key FROM submissions WHERE assignment_id = ? AND student_id = ?`, assignmentID, uid(c))
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if prev.Status == "reviewed" {
		return conflict("this work was already reviewed")
	}
	var key, name, mime any
	if f != nil {
		if err := s.saveFile(f, content); err != nil {
			return err
		}
		key, name, mime = f.Key, f.Name, f.Mime
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO submissions (id, assignment_id, student_id, note, file_key, file_name, file_mime) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE note = VALUES(note), file_key = COALESCE(VALUES(file_key), file_key), file_name = COALESCE(VALUES(file_name), file_name), file_mime = COALESCE(VALUES(file_mime), file_mime), status = 'submitted', submitted_at = UTC_TIMESTAMP(6)`,
		newID(), assignmentID, uid(c), nullable(note), key, name, mime)
	if err != nil {
		if f != nil {
			s.removeFile(f.Key)
		}
		return err
	}
	if f != nil && prev.Key.Valid {
		s.removeFile(prev.Key.String)
	}
	var owner string
	_ = s.db.GetContext(ctx, &owner, `SELECT owner_id FROM classrooms WHERE id = ?`, classroom)
	s.notify(ctx, owner, "submission_received", "New submission", s.userName(ctx, uid(c))+" submitted work.")
	return nil
}

type SubmissionRow struct {
	ID          string     `db:"id" json:"id"`
	StudentID   string     `db:"student_id" json:"student_id"`
	StudentName string     `db:"student_name" json:"student_name"`
	Note        *string    `db:"note" json:"note"`
	FileName    *string    `db:"file_name" json:"file_name"`
	Status      string     `db:"status" json:"status"`
	Score       *float64   `db:"score" json:"score"`
	Feedback    *string    `db:"feedback" json:"feedback"`
	SubmittedAt time.Time  `db:"submitted_at" json:"submitted_at"`
	ReviewedAt  *time.Time `db:"reviewed_at" json:"reviewed_at"`
	Late        bool       `db:"late" json:"late"`
}

func (s *Service) Submissions(c *gin.Context, assignmentID string) ([]SubmissionRow, error) {
	ctx := c.Request.Context()
	classroom, err := s.assignmentClassroom(ctx, assignmentID)
	if err != nil {
		return nil, err
	}
	a, err := s.needAccess(ctx, c, classroom, viewerAccess)
	if err != nil {
		return nil, err
	}
	query := `SELECT s.id, s.student_id, u.name AS student_name, s.note, s.file_name, s.status, s.score, s.feedback, s.submitted_at, s.reviewed_at, s.submitted_at > a.due_at AS late
		FROM submissions s JOIN users u ON u.id = s.student_id JOIN assignments a ON a.id = s.assignment_id WHERE s.assignment_id = ?`
	args := []any{assignmentID}
	switch {
	case a == memberAccess:
		query += ` AND s.student_id = ?`
		args = append(args, uid(c))
	case a == viewerAccess && role(c) != "admin":
		query += ` AND s.student_id IN (SELECT student_id FROM guardian_student_links WHERE guardian_id = ? AND status = 'approved')`
		args = append(args, uid(c))
	}
	out := []SubmissionRow{}
	err = s.db.SelectContext(ctx, &out, query+` ORDER BY s.submitted_at`, args...)
	return out, err
}

func (s *Service) ReviewSubmission(c *gin.Context, submissionID string, score *float64, feedback, status string) error {
	ctx := c.Request.Context()
	var sub struct {
		Assignment string   `db:"assignment_id"`
		Student    string   `db:"student_id"`
		Max        *float64 `db:"max_score"`
		Classroom  string   `db:"classroom_id"`
		Title      string   `db:"title"`
	}
	if err := s.db.GetContext(ctx, &sub, `SELECT s.assignment_id, s.student_id, a.max_score, a.classroom_id, a.title FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?`, submissionID); errors.Is(err, sql.ErrNoRows) {
		return notFound("submission not found")
	} else if err != nil {
		return err
	}
	if _, err := s.needAccess(ctx, c, sub.Classroom, ownerAccess); err != nil {
		return err
	}
	if status != "reviewed" && status != "revision" {
		return badRequest("status must be reviewed or revision")
	}
	if score != nil && (*score < 0 || (sub.Max != nil && *score > *sub.Max)) {
		return badRequest("score is outside the allowed range")
	}
	if _, err := s.db.ExecContext(ctx, `UPDATE submissions SET status = ?, score = ?, feedback = ?, reviewed_at = UTC_TIMESTAMP(6) WHERE id = ?`, status, score, nullable(feedback), submissionID); err != nil {
		return err
	}
	title := "Work reviewed"
	if status == "revision" {
		title = "Revision requested"
	}
	s.notify(ctx, sub.Student, "submission_"+status, title, sub.Title)
	return nil
}

func (s *Service) SubmissionFile(c *gin.Context, submissionID string) {
	var f struct {
		Classroom string         `db:"classroom_id"`
		Student   string         `db:"student_id"`
		Key       sql.NullString `db:"file_key"`
		Name      sql.NullString `db:"file_name"`
		Mime      sql.NullString `db:"file_mime"`
	}
	ctx := c.Request.Context()
	if err := s.db.GetContext(ctx, &f, `SELECT a.classroom_id, s.student_id, s.file_key, s.file_name, s.file_mime FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?`, submissionID); err != nil || !f.Key.Valid {
		fail(c, notFound("file not found"))
		return
	}
	a, err := s.classroomAccess(ctx, uid(c), role(c), f.Classroom)
	ok := err == nil && (a == ownerAccess || uid(c) == f.Student || role(c) == "admin" || (a == viewerAccess && s.guardianOf(ctx, uid(c), f.Student)))
	if !ok {
		fail(c, notFound("file not found"))
		return
	}
	s.serveFile(c, f.Key.String, f.Name.String, f.Mime.String)
}

// ---------- schedule and attendance ----------

type sessionInput struct {
	StartsAt string `json:"starts_at" validate:"required"`
	EndsAt   string `json:"ends_at"`
	Repeat   int    `json:"repeat_weeks" validate:"gte=0,lte=26"`
}

// CreateSessions schedules a class, optionally repeating weekly.
func (s *Service) CreateSessions(ctx context.Context, classroomID string, in sessionInput) (int, error) {
	start, err := time.Parse(time.RFC3339, in.StartsAt)
	if err != nil {
		return 0, badRequest("starts_at must be an ISO date and time")
	}
	var dur time.Duration
	if in.EndsAt != "" {
		end, err := time.Parse(time.RFC3339, in.EndsAt)
		if err != nil || !end.After(start) {
			return 0, badRequest("ends_at must be after starts_at")
		}
		dur = end.Sub(start)
	}
	for i := 0; i <= in.Repeat; i++ {
		st := start.AddDate(0, 0, 7*i).UTC()
		var end any
		if dur > 0 {
			end = st.Add(dur)
		}
		if _, err := s.db.ExecContext(ctx, `INSERT INTO class_sessions (id, classroom_id, starts_at, ends_at) VALUES (?, ?, ?, ?)`, newID(), classroomID, st, end); err != nil {
			return i, err
		}
	}
	s.notifyMembers(ctx, classroomID, "schedule_updated", "Class schedule updated", "New class times were added starting "+start.Format("Mon 2 Jan 15:04")+" UTC.")
	return in.Repeat + 1, nil
}

func (s *Service) sessionClassroom(ctx context.Context, sessionID string) (string, error) {
	var classroom string
	err := s.db.GetContext(ctx, &classroom, `SELECT classroom_id FROM class_sessions WHERE id = ?`, sessionID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", notFound("class not found")
	}
	return classroom, err
}

func (s *Service) SetSessionStatus(ctx context.Context, sessionID, status, note, newStart string) error {
	classroom, err := s.sessionClassroom(ctx, sessionID)
	if err != nil {
		return err
	}
	switch status {
	case "held", "cancelled":
		_, err = s.db.ExecContext(ctx, `UPDATE class_sessions SET status = ?, note = ? WHERE id = ?`, status, nullable(note), sessionID)
	case "rescheduled":
		t, perr := time.Parse(time.RFC3339, newStart)
		if perr != nil {
			return badRequest("a new start time is required to reschedule")
		}
		_, err = s.db.ExecContext(ctx, `UPDATE class_sessions SET status = 'rescheduled', note = ? WHERE id = ?`, nullable(note), sessionID)
		if err == nil {
			_, err = s.db.ExecContext(ctx, `INSERT INTO class_sessions (id, classroom_id, starts_at, note) VALUES (?, ?, ?, ?)`, newID(), classroom, t.UTC(), "Rescheduled class")
		}
	default:
		return badRequest("status must be held, cancelled or rescheduled")
	}
	if err == nil && status != "held" {
		s.notifyMembers(ctx, classroom, "class_"+status, "Class "+status, strings.TrimSpace("A class was "+status+". "+note))
	}
	return err
}

type markInput struct {
	LearnerKind string `json:"learner_kind" validate:"required,oneof=user roster"`
	LearnerID   string `json:"learner_id" validate:"required,uuid"`
	Mark        string `json:"mark" validate:"required,oneof=present absent late excused"`
}

// MarkAttendance records marks for learners who belong to the session's
// classroom (members) or batch (roster), and tells guardians about absences.
func (s *Service) MarkAttendance(ctx context.Context, markerID, sessionID string, marks []markInput) error {
	classroom, err := s.sessionClassroom(ctx, sessionID)
	if err != nil {
		return err
	}
	tx, err := s.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	absent := []string{}
	for _, m := range marks {
		var belongs int
		if m.LearnerKind == "user" {
			err = tx.GetContext(ctx, &belongs, `SELECT COUNT(*) FROM classroom_members WHERE classroom_id = ? AND student_id = ?`, classroom, m.LearnerID)
		} else {
			err = tx.GetContext(ctx, &belongs, `SELECT COUNT(*) FROM batch_enrollments e JOIN coaching_batches b ON b.id = e.batch_id WHERE b.classroom_id = ? AND e.student_id = ?`, classroom, m.LearnerID)
		}
		if err != nil {
			return err
		}
		if belongs == 0 {
			return badRequest("a learner in the list is not in this class")
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO attendance_marks (session_id, learner_kind, learner_id, mark, marked_by) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE mark = VALUES(mark), marked_by = VALUES(marked_by), marked_at = UTC_TIMESTAMP(6)`,
			sessionID, m.LearnerKind, m.LearnerID, m.Mark, markerID); err != nil {
			return err
		}
		if m.Mark == "absent" && m.LearnerKind == "user" {
			absent = append(absent, m.LearnerID)
		}
	}
	if _, err = tx.ExecContext(ctx, `UPDATE class_sessions SET status = 'held' WHERE id = ? AND status = 'scheduled'`, sessionID); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	for _, student := range absent {
		var guardians []string
		_ = s.db.SelectContext(ctx, &guardians, `SELECT guardian_id FROM guardian_student_links WHERE student_id = ? AND status = 'approved'`, student)
		for _, g := range guardians {
			s.notify(ctx, g, "attendance_absent", "Absence recorded", s.userName(ctx, student)+" was marked absent from a class.")
		}
	}
	return nil
}

type diaryInput struct {
	EntryDate string `json:"entry_date" validate:"required"`
	Topics    string `json:"topics" validate:"required,max=4000"`
	Homework  string `json:"homework" validate:"max=2000"`
	Note      string `json:"note" validate:"max=2000"`
}

func (s *Service) SaveDiary(ctx context.Context, authorID, classroomID string, in diaryInput) error {
	day, err := parseDate(in.EntryDate)
	if err != nil || day == nil {
		return badRequest("entry_date must be YYYY-MM-DD")
	}
	_, err = s.db.ExecContext(ctx, `INSERT INTO diary_entries (id, classroom_id, author_id, entry_date, topics, homework, note) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE topics = VALUES(topics), homework = VALUES(homework), note = VALUES(note), author_id = VALUES(author_id)`,
		newID(), classroomID, authorID, day, strings.TrimSpace(in.Topics), nullable(in.Homework), nullable(in.Note))
	if err == nil {
		s.notifyMembers(ctx, classroomID, "diary_updated", "Class diary updated", "Today's class notes are available.")
	}
	return err
}

// Progress summarises a student's attendance and graded work across the
// classrooms the viewer may see for that student.
type Progress struct {
	StudentID   string   `json:"student_id"`
	Present     int      `json:"present"`
	Absent      int      `json:"absent"`
	Late        int      `json:"late"`
	Attendance  *float64 `json:"attendance_percent"`
	Assigned    int      `json:"assigned"`
	Submitted   int      `json:"submitted"`
	Reviewed    int      `json:"reviewed"`
	AvgScorePct *float64 `json:"average_score_percent"`
}

func (s *Service) StudentProgress(ctx context.Context, viewerID, viewerRole, studentID string) (Progress, error) {
	p := Progress{StudentID: studentID}
	if viewerID != studentID && viewerRole != "admin" && !s.guardianOf(ctx, viewerID, studentID) {
		// A teacher may see progress for students in a classroom they run.
		var teaches int
		_ = s.db.GetContext(ctx, &teaches, `SELECT COUNT(*) FROM classroom_members m JOIN classrooms c ON c.id = m.classroom_id WHERE m.student_id = ? AND c.owner_id = ?`, studentID, viewerID)
		if teaches == 0 {
			return p, notFound("student not found")
		}
	}
	var att struct {
		Present int `db:"present"`
		Absent  int `db:"absent"`
		Late    int `db:"late"`
	}
	if err := s.db.GetContext(ctx, &att, `SELECT COALESCE(SUM(mark = 'present'), 0) AS present, COALESCE(SUM(mark = 'absent'), 0) AS absent, COALESCE(SUM(mark = 'late'), 0) AS late FROM attendance_marks WHERE learner_kind = 'user' AND learner_id = ?`, studentID); err != nil {
		return p, err
	}
	p.Present, p.Absent, p.Late = att.Present, att.Absent, att.Late
	if total := att.Present + att.Absent + att.Late; total > 0 {
		v := float64(att.Present+att.Late) * 100 / float64(total)
		p.Attendance = &v
	}
	var work struct {
		Assigned  int      `db:"assigned"`
		Submitted int      `db:"submitted"`
		Reviewed  int      `db:"reviewed"`
		Avg       *float64 `db:"avg_pct"`
	}
	err := s.db.GetContext(ctx, &work, `SELECT COUNT(a.id) AS assigned, COUNT(s.id) AS submitted, COALESCE(SUM(s.status = 'reviewed'), 0) AS reviewed,
		AVG(CASE WHEN s.score IS NOT NULL AND a.max_score > 0 THEN s.score * 100 / a.max_score END) AS avg_pct
		FROM classroom_members m JOIN assignments a ON a.classroom_id = m.classroom_id LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = m.student_id WHERE m.student_id = ?`, studentID)
	p.Assigned, p.Submitted, p.Reviewed, p.AvgScorePct = work.Assigned, work.Submitted, work.Reviewed, work.Avg
	return p, err
}

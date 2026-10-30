package platform

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Every coaching query is scoped by coaching_id = the caller, so one centre can
// never read or change another centre's records even with a guessed ID.

type Teacher struct {
	ID            string  `db:"id" json:"id"`
	Name          string  `db:"name" json:"name"`
	Subject       *string `db:"subject" json:"subject"`
	Qualification *string `db:"qualification" json:"qualification"`
	Phone         *string `db:"phone" json:"phone"`
	Email         *string `db:"email" json:"email"`
	Status        string  `db:"status" json:"status"`
	Batches       int     `db:"batches" json:"batches"`
}

type teacherInput struct {
	Name          string `json:"name" validate:"required,max=120"`
	Subject       string `json:"subject" validate:"max=100"`
	Qualification string `json:"qualification" validate:"max=160"`
	Phone         string `json:"phone" validate:"max=32"`
	Email         string `json:"email" validate:"omitempty,email,max=255"`
	Status        string `json:"status" validate:"omitempty,oneof=active invited inactive"`
}

func (s *Service) Teachers(ctx context.Context, coachingID string) ([]Teacher, error) {
	out := []Teacher{}
	err := s.db.SelectContext(ctx, &out, `SELECT t.id, t.name, t.subject, t.qualification, t.phone, t.email, t.status, (SELECT COUNT(*) FROM coaching_batches b WHERE b.teacher_id = t.id AND b.status = 'active') AS batches FROM coaching_teachers t WHERE t.coaching_id = ? ORDER BY t.status, t.name`, coachingID)
	return out, err
}

func (s *Service) SaveTeacher(ctx context.Context, coachingID, id string, in teacherInput) (string, error) {
	status := in.Status
	if status == "" {
		status = "active"
	}
	if id == "" {
		id = newID()
		_, err := s.db.ExecContext(ctx, `INSERT INTO coaching_teachers (id, coaching_id, name, subject, qualification, phone, email, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, id, coachingID, strings.TrimSpace(in.Name), nullable(in.Subject), nullable(in.Qualification), nullable(in.Phone), nullable(in.Email), status)
		return id, err
	}
	return id, s.scopedUpdate(ctx, `UPDATE coaching_teachers SET name = ?, subject = ?, qualification = ?, phone = ?, email = ?, status = ? WHERE id = ? AND coaching_id = ?`, strings.TrimSpace(in.Name), nullable(in.Subject), nullable(in.Qualification), nullable(in.Phone), nullable(in.Email), status, id, coachingID)
}

// scopedUpdate runs an UPDATE/DELETE whose WHERE includes the owner and maps "no row" to 404.
func (s *Service) scopedUpdate(ctx context.Context, query string, args ...any) error {
	r, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	if n, _ := r.RowsAffected(); n == 0 {
		var exists int
		// RowsAffected is 0 both for "not yours" and for "no change"; distinguish by id + owner (the last two args).
		if len(args) >= 2 {
			table := strings.Fields(query)[1]
			_ = s.db.GetContext(ctx, &exists, `SELECT COUNT(*) FROM `+table+` WHERE id = ? AND coaching_id = ?`, args[len(args)-2], args[len(args)-1])
		}
		if exists == 0 {
			return notFound("record not found")
		}
	}
	return nil
}

type Course struct {
	ID          string          `db:"id" json:"id"`
	Name        string          `db:"name" json:"name"`
	Description *string         `db:"description" json:"description"`
	Subjects    json.RawMessage `db:"subjects" json:"subjects"`
	MonthlyFee  *float64        `db:"monthly_fee" json:"monthly_fee"`
	Batches     int             `db:"batches" json:"batches"`
}

type courseInput struct {
	Name        string   `json:"name" validate:"required,max=120"`
	Description string   `json:"description" validate:"max=2000"`
	Subjects    []string `json:"subjects" validate:"max=30,dive,max=100"`
	MonthlyFee  *float64 `json:"monthly_fee" validate:"omitempty,gte=0,lte=1000000"`
}

func (s *Service) Courses(ctx context.Context, coachingID string) ([]Course, error) {
	out := []Course{}
	err := s.db.SelectContext(ctx, &out, `SELECT c.id, c.name, c.description, COALESCE(c.subjects, JSON_ARRAY()) AS subjects, c.monthly_fee, (SELECT COUNT(*) FROM coaching_batches b WHERE b.course_id = c.id) AS batches FROM coaching_courses c WHERE c.coaching_id = ? ORDER BY c.name`, coachingID)
	return out, err
}

func (s *Service) SaveCourse(ctx context.Context, coachingID, id string, in courseInput) (string, error) {
	subjects, _ := json.Marshal(in.Subjects)
	if id == "" {
		id = newID()
		_, err := s.db.ExecContext(ctx, `INSERT INTO coaching_courses (id, coaching_id, name, description, subjects, monthly_fee) VALUES (?, ?, ?, ?, ?, ?)`, id, coachingID, strings.TrimSpace(in.Name), nullable(in.Description), subjects, in.MonthlyFee)
		return id, err
	}
	return id, s.scopedUpdate(ctx, `UPDATE coaching_courses SET name = ?, description = ?, subjects = ?, monthly_fee = ? WHERE id = ? AND coaching_id = ?`, strings.TrimSpace(in.Name), nullable(in.Description), subjects, in.MonthlyFee, id, coachingID)
}

type Branch struct {
	ID      string  `db:"id" json:"id"`
	Name    string  `db:"name" json:"name"`
	Address *string `db:"address" json:"address"`
}

func (s *Service) Branches(ctx context.Context, coachingID string) ([]Branch, error) {
	out := []Branch{}
	err := s.db.SelectContext(ctx, &out, `SELECT id, name, address FROM coaching_branches WHERE coaching_id = ? ORDER BY name`, coachingID)
	return out, err
}

func (s *Service) SaveBranch(ctx context.Context, coachingID, id, name, address string) (string, error) {
	if strings.TrimSpace(name) == "" || len(name) > 120 {
		return "", badRequest("branch name is required")
	}
	if id == "" {
		id = newID()
		_, err := s.db.ExecContext(ctx, `INSERT INTO coaching_branches (id, coaching_id, name, address) VALUES (?, ?, ?, ?)`, id, coachingID, strings.TrimSpace(name), nullable(address))
		return id, err
	}
	return id, s.scopedUpdate(ctx, `UPDATE coaching_branches SET name = ?, address = ? WHERE id = ? AND coaching_id = ?`, strings.TrimSpace(name), nullable(address), id, coachingID)
}

type RosterStudent struct {
	ID            string     `db:"id" json:"id"`
	Name          string     `db:"name" json:"name"`
	ClassName     *string    `db:"class_name" json:"class_name"`
	GuardianName  *string    `db:"guardian_name" json:"guardian_name"`
	GuardianPhone *string    `db:"guardian_phone" json:"guardian_phone"`
	Status        string     `db:"status" json:"status"`
	AdmittedAt    *time.Time `db:"admitted_at" json:"admitted_at"`
	HasAccount    bool       `db:"has_account" json:"has_account"`
	BatchIDs      *string    `db:"batch_ids" json:"-"`
	Batches       []string   `db:"-" json:"batch_ids"`
}

type rosterInput struct {
	Name          string `json:"name" validate:"required,max=120"`
	ClassName     string `json:"class_name" validate:"max=60"`
	GuardianName  string `json:"guardian_name" validate:"max=120"`
	GuardianPhone string `json:"guardian_phone" validate:"max=32"`
	StudentEmail  string `json:"student_email" validate:"omitempty,email"`
	GuardianEmail string `json:"guardian_email" validate:"omitempty,email"`
	Status        string `json:"status" validate:"omitempty,oneof=active paused left"`
	AdmittedAt    string `json:"admitted_at"`
}

func (s *Service) Roster(ctx context.Context, coachingID string) ([]RosterStudent, error) {
	out := []RosterStudent{}
	if err := s.db.SelectContext(ctx, &out, `SELECT st.id, st.name, st.class_name, st.guardian_name, st.guardian_phone, st.status, st.admitted_at, st.user_id IS NOT NULL AS has_account,
		(SELECT GROUP_CONCAT(e.batch_id) FROM batch_enrollments e WHERE e.student_id = st.id) AS batch_ids
		FROM coaching_students st WHERE st.coaching_id = ? ORDER BY st.status, st.name`, coachingID); err != nil {
		return nil, err
	}
	for i := range out {
		out[i].Batches = []string{}
		if out[i].BatchIDs != nil && *out[i].BatchIDs != "" {
			out[i].Batches = strings.Split(*out[i].BatchIDs, ",")
		}
	}
	return out, nil
}

// SaveRosterStudent admits or updates a learner. Optional emails link the
// roster entry to existing student / parent accounts so they can see their
// classes; the accounts must already exist.
func (s *Service) SaveRosterStudent(ctx context.Context, coachingID, id string, in rosterInput) (string, error) {
	lookup := func(email, wantRole string) (any, error) {
		if email == "" {
			return nil, nil
		}
		var u struct {
			ID   string `db:"id"`
			Role string `db:"role"`
		}
		err := s.db.GetContext(ctx, &u, `SELECT id, role FROM users WHERE email = ?`, strings.ToLower(strings.TrimSpace(email)))
		if errors.Is(err, sql.ErrNoRows) || (err == nil && u.Role != wantRole) {
			return nil, notFound("no " + wantRole + " account uses " + email)
		}
		return u.ID, err
	}
	studentUser, err := lookup(in.StudentEmail, "student")
	if err != nil {
		return "", err
	}
	guardianUser, err := lookup(in.GuardianEmail, "parent")
	if err != nil {
		return "", err
	}
	admitted, err := parseDate(in.AdmittedAt)
	if err != nil {
		return "", err
	}
	status := in.Status
	if status == "" {
		status = "active"
	}
	if id == "" {
		id = newID()
		if admitted == nil {
			admitted = ptr(time.Now().UTC())
		}
		_, err = s.db.ExecContext(ctx, `INSERT INTO coaching_students (id, coaching_id, user_id, name, class_name, guardian_name, guardian_phone, guardian_user_id, status, admitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, coachingID, studentUser, strings.TrimSpace(in.Name), nullable(in.ClassName), nullable(in.GuardianName), nullable(in.GuardianPhone), guardianUser, status, admitted)
	} else {
		err = s.scopedUpdate(ctx, `UPDATE coaching_students SET user_id = COALESCE(?, user_id), name = ?, class_name = ?, guardian_name = ?, guardian_phone = ?, guardian_user_id = COALESCE(?, guardian_user_id), status = ? WHERE id = ? AND coaching_id = ?`,
			studentUser, strings.TrimSpace(in.Name), nullable(in.ClassName), nullable(in.GuardianName), nullable(in.GuardianPhone), guardianUser, status, id, coachingID)
	}
	if err == nil && studentUser != nil {
		// Give the linked account access to the classrooms of the batches it is enrolled in.
		_, err = s.db.ExecContext(ctx, `INSERT IGNORE INTO classroom_members (classroom_id, student_id) SELECT b.classroom_id, ? FROM batch_enrollments e JOIN coaching_batches b ON b.id = e.batch_id WHERE e.student_id = ? AND b.classroom_id IS NOT NULL`, studentUser, id)
	}
	return id, err
}

type Batch struct {
	ID          string   `db:"id" json:"id"`
	Name        string   `db:"name" json:"name"`
	Subject     string   `db:"subject" json:"subject"`
	ClassName   *string  `db:"class_name" json:"class_name"`
	CourseID    *string  `db:"course_id" json:"course_id"`
	BranchID    *string  `db:"branch_id" json:"branch_id"`
	TeacherID   *string  `db:"teacher_id" json:"teacher_id"`
	TeacherName *string  `db:"teacher_name" json:"teacher_name"`
	ClassroomID *string  `db:"classroom_id" json:"classroom_id"`
	Days        *string  `db:"days" json:"days"`
	TimeSlot    *string  `db:"time_slot" json:"time_slot"`
	Room        *string  `db:"room" json:"room"`
	Capacity    *int     `db:"capacity" json:"capacity"`
	MonthlyFee  *float64 `db:"monthly_fee" json:"monthly_fee"`
	Status      string   `db:"status" json:"status"`
	Enrolled    int      `db:"enrolled" json:"enrolled"`
}

type batchInput struct {
	Name       string   `json:"name" validate:"required,max=120"`
	Subject    string   `json:"subject" validate:"required,max=100"`
	ClassName  string   `json:"class_name" validate:"max=60"`
	CourseID   string   `json:"course_id" validate:"omitempty,uuid"`
	BranchID   string   `json:"branch_id" validate:"omitempty,uuid"`
	TeacherID  string   `json:"teacher_id" validate:"omitempty,uuid"`
	Days       string   `json:"days" validate:"max=80"`
	TimeSlot   string   `json:"time_slot" validate:"max=60"`
	Room       string   `json:"room" validate:"max=60"`
	Capacity   *int     `json:"capacity" validate:"omitempty,gt=0,lte=1000"`
	MonthlyFee *float64 `json:"monthly_fee" validate:"omitempty,gte=0,lte=1000000"`
	Status     string   `json:"status" validate:"omitempty,oneof=active closed"`
}

func (s *Service) Batches(ctx context.Context, coachingID string) ([]Batch, error) {
	out := []Batch{}
	err := s.db.SelectContext(ctx, &out, `SELECT b.id, b.name, b.subject, b.class_name, b.course_id, b.branch_id, b.teacher_id, t.name AS teacher_name, b.classroom_id, b.days, b.time_slot, b.room, b.capacity, b.monthly_fee, b.status,
		(SELECT COUNT(*) FROM batch_enrollments e WHERE e.batch_id = b.id) AS enrolled
		FROM coaching_batches b LEFT JOIN coaching_teachers t ON t.id = b.teacher_id WHERE b.coaching_id = ? ORDER BY b.status, b.name`, coachingID)
	return out, err
}

// ownsAll checks that referenced teacher/course/branch rows belong to this centre.
func (s *Service) ownsAll(ctx context.Context, coachingID string, refs map[string]string) error {
	for table, id := range refs {
		if id == "" {
			continue
		}
		var n int
		if err := s.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM `+table+` WHERE id = ? AND coaching_id = ?`, id, coachingID); err != nil {
			return err
		}
		if n == 0 {
			return badRequest("a referenced teacher, course or branch does not belong to your centre")
		}
	}
	return nil
}

// SaveBatch creates or updates a batch. A new batch gets its own classroom so
// materials, assignments, schedules and attendance work the same as for tutors.
func (s *Service) SaveBatch(ctx context.Context, coachingID, id string, in batchInput) (string, error) {
	if err := s.ownsAll(ctx, coachingID, map[string]string{"coaching_teachers": in.TeacherID, "coaching_courses": in.CourseID, "coaching_branches": in.BranchID}); err != nil {
		return "", err
	}
	status := in.Status
	if status == "" {
		status = "active"
	}
	if id == "" {
		id = newID()
		classroom, err := s.CreateClassroom(ctx, coachingID, in.Name, in.Subject, "")
		if err != nil {
			return "", err
		}
		_, err = s.db.ExecContext(ctx, `INSERT INTO coaching_batches (id, coaching_id, course_id, branch_id, teacher_id, classroom_id, name, subject, class_name, days, time_slot, room, capacity, monthly_fee, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			id, coachingID, nullable(in.CourseID), nullable(in.BranchID), nullable(in.TeacherID), classroom, strings.TrimSpace(in.Name), strings.TrimSpace(in.Subject), nullable(in.ClassName), nullable(in.Days), nullable(in.TimeSlot), nullable(in.Room), in.Capacity, in.MonthlyFee, status)
		return id, err
	}
	err := s.scopedUpdate(ctx, `UPDATE coaching_batches SET course_id = ?, branch_id = ?, teacher_id = ?, name = ?, subject = ?, class_name = ?, days = ?, time_slot = ?, room = ?, capacity = ?, monthly_fee = ?, status = ? WHERE id = ? AND coaching_id = ?`,
		nullable(in.CourseID), nullable(in.BranchID), nullable(in.TeacherID), strings.TrimSpace(in.Name), strings.TrimSpace(in.Subject), nullable(in.ClassName), nullable(in.Days), nullable(in.TimeSlot), nullable(in.Room), in.Capacity, in.MonthlyFee, status, id, coachingID)
	if err == nil {
		_, err = s.db.ExecContext(ctx, `UPDATE classrooms c JOIN coaching_batches b ON b.classroom_id = c.id SET c.name = b.name, c.subject = b.subject, c.archived_at = IF(b.status = 'closed', COALESCE(c.archived_at, UTC_TIMESTAMP(6)), NULL) WHERE b.id = ?`, id)
	}
	return id, err
}

// SetEnrollment adds or removes a roster student in a batch, keeping the
// batch classroom's membership in step for students with accounts.
func (s *Service) SetEnrollment(ctx context.Context, coachingID, batchID, studentID string, enrol bool) error {
	var b struct {
		Classroom *string `db:"classroom_id"`
		Capacity  *int    `db:"capacity"`
		Enrolled  int     `db:"enrolled"`
	}
	if err := s.db.GetContext(ctx, &b, `SELECT classroom_id, capacity, (SELECT COUNT(*) FROM batch_enrollments e WHERE e.batch_id = b.id) AS enrolled FROM coaching_batches b WHERE b.id = ? AND b.coaching_id = ?`, batchID, coachingID); errors.Is(err, sql.ErrNoRows) {
		return notFound("batch not found")
	} else if err != nil {
		return err
	}
	var account sql.NullString
	if err := s.db.GetContext(ctx, &account, `SELECT user_id FROM coaching_students WHERE id = ? AND coaching_id = ?`, studentID, coachingID); errors.Is(err, sql.ErrNoRows) {
		return notFound("student not found")
	} else if err != nil {
		return err
	}
	if enrol {
		if b.Capacity != nil && b.Enrolled >= *b.Capacity {
			return conflict("this batch is full")
		}
		if _, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO batch_enrollments (batch_id, student_id) VALUES (?, ?)`, batchID, studentID); err != nil {
			return err
		}
		if account.Valid && b.Classroom != nil {
			_, _ = s.db.ExecContext(ctx, `INSERT IGNORE INTO classroom_members (classroom_id, student_id) VALUES (?, ?)`, *b.Classroom, account.String)
			s.notify(ctx, account.String, "batch_enrolled", "Enrolled in a batch", "You were enrolled in a new batch.")
		}
		return nil
	}
	if _, err := s.db.ExecContext(ctx, `DELETE FROM batch_enrollments WHERE batch_id = ? AND student_id = ?`, batchID, studentID); err != nil {
		return err
	}
	if account.Valid && b.Classroom != nil {
		_, _ = s.db.ExecContext(ctx, `DELETE FROM classroom_members WHERE classroom_id = ? AND student_id = ?`, *b.Classroom, account.String)
	}
	return nil
}

type BatchLearner struct {
	Kind string `db:"kind" json:"learner_kind"`
	ID   string `db:"id" json:"learner_id"`
	Name string `db:"name" json:"name"`
}

// BatchLearners lists a batch's roster for attendance (roster IDs).
func (s *Service) BatchLearners(ctx context.Context, coachingID, batchID string) ([]BatchLearner, error) {
	out := []BatchLearner{}
	err := s.db.SelectContext(ctx, &out, `SELECT 'roster' AS kind, st.id, st.name FROM batch_enrollments e JOIN coaching_students st ON st.id = e.student_id JOIN coaching_batches b ON b.id = e.batch_id WHERE e.batch_id = ? AND b.coaching_id = ? ORDER BY st.name`, batchID, coachingID)
	return out, err
}

// ---------- exams ----------

type Exam struct {
	ID          string     `db:"id" json:"id"`
	BatchID     string     `db:"batch_id" json:"batch_id"`
	BatchName   string     `db:"batch_name" json:"batch_name"`
	Title       string     `db:"title" json:"title"`
	ExamDate    time.Time  `db:"exam_date" json:"exam_date"`
	TotalMarks  float64    `db:"total_marks" json:"total_marks"`
	PublishedAt *time.Time `db:"published_at" json:"published_at"`
	Entered     int        `db:"entered" json:"marks_entered"`
	Average     *float64   `db:"average" json:"average"`
}

func (s *Service) Exams(ctx context.Context, coachingID string) ([]Exam, error) {
	out := []Exam{}
	err := s.db.SelectContext(ctx, &out, `SELECT x.id, x.batch_id, b.name AS batch_name, x.title, x.exam_date, x.total_marks, x.published_at,
		(SELECT COUNT(*) FROM exam_marks m WHERE m.exam_id = x.id AND m.marks IS NOT NULL) AS entered,
		(SELECT AVG(m.marks) FROM exam_marks m WHERE m.exam_id = x.id) AS average
		FROM exams x JOIN coaching_batches b ON b.id = x.batch_id WHERE b.coaching_id = ? ORDER BY x.exam_date DESC`, coachingID)
	return out, err
}

func (s *Service) CreateExam(ctx context.Context, coachingID, batchID, title, date string, total float64) (string, error) {
	if err := s.ownsAll(ctx, coachingID, map[string]string{"coaching_batches": batchID}); err != nil {
		return "", err
	}
	day, err := parseDate(date)
	if err != nil || day == nil || strings.TrimSpace(title) == "" || total <= 0 {
		return "", badRequest("title, exam date (YYYY-MM-DD) and total marks are required")
	}
	id := newID()
	_, err = s.db.ExecContext(ctx, `INSERT INTO exams (id, batch_id, title, exam_date, total_marks) VALUES (?, ?, ?, ?, ?)`, id, batchID, strings.TrimSpace(title), day, total)
	return id, err
}

type ExamMark struct {
	StudentID string   `db:"student_id" json:"student_id"`
	Name      string   `db:"name" json:"name"`
	Marks     *float64 `db:"marks" json:"marks"`
}

func (s *Service) examOwned(ctx context.Context, coachingID, examID string) (float64, *time.Time, error) {
	var x struct {
		Total     float64    `db:"total_marks"`
		Published *time.Time `db:"published_at"`
	}
	err := s.db.GetContext(ctx, &x, `SELECT x.total_marks, x.published_at FROM exams x JOIN coaching_batches b ON b.id = x.batch_id WHERE x.id = ? AND b.coaching_id = ?`, examID, coachingID)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, nil, notFound("exam not found")
	}
	return x.Total, x.Published, err
}

func (s *Service) ExamMarks(ctx context.Context, coachingID, examID string) ([]ExamMark, error) {
	if _, _, err := s.examOwned(ctx, coachingID, examID); err != nil {
		return nil, err
	}
	out := []ExamMark{}
	err := s.db.SelectContext(ctx, &out, `SELECT st.id AS student_id, st.name, m.marks FROM exams x JOIN batch_enrollments e ON e.batch_id = x.batch_id JOIN coaching_students st ON st.id = e.student_id
		LEFT JOIN exam_marks m ON m.exam_id = x.id AND m.student_id = st.id WHERE x.id = ? ORDER BY st.name`, examID)
	return out, err
}

func (s *Service) SaveExamMarks(ctx context.Context, coachingID, examID string, marks map[string]*float64, publish bool) error {
	total, published, err := s.examOwned(ctx, coachingID, examID)
	if err != nil {
		return err
	}
	if published != nil && len(marks) > 0 {
		return conflict("published results cannot be changed")
	}
	for studentID, m := range marks {
		if m != nil && (*m < 0 || *m > total) {
			return badRequest("marks must be between 0 and the exam total")
		}
		var enrolled int
		if err := s.db.GetContext(ctx, &enrolled, `SELECT COUNT(*) FROM exams x JOIN batch_enrollments e ON e.batch_id = x.batch_id WHERE x.id = ? AND e.student_id = ?`, examID, studentID); err != nil {
			return err
		}
		if enrolled == 0 {
			return badRequest("a student in the list is not in this batch")
		}
		if _, err := s.db.ExecContext(ctx, `INSERT INTO exam_marks (exam_id, student_id, marks) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE marks = VALUES(marks)`, examID, studentID, m); err != nil {
			return err
		}
	}
	if publish && published == nil {
		if _, err := s.db.ExecContext(ctx, `UPDATE exams SET published_at = UTC_TIMESTAMP(6) WHERE id = ?`, examID); err != nil {
			return err
		}
		var accounts []string
		_ = s.db.SelectContext(ctx, &accounts, `SELECT st.user_id FROM exams x JOIN batch_enrollments e ON e.batch_id = x.batch_id JOIN coaching_students st ON st.id = e.student_id WHERE x.id = ? AND st.user_id IS NOT NULL
			UNION SELECT st.guardian_user_id FROM exams x JOIN batch_enrollments e ON e.batch_id = x.batch_id JOIN coaching_students st ON st.id = e.student_id WHERE x.id = ? AND st.guardian_user_id IS NOT NULL`, examID, examID)
		for _, id := range accounts {
			s.notify(ctx, id, "results_published", "Exam results published", "New exam results are available.")
		}
	}
	return nil
}

// MyResults lists published exam results for a student account or a parent's
// linked roster entries.
func (s *Service) MyResults(ctx context.Context, userID string) ([]map[string]any, error) {
	rows, err := s.db.QueryxContext(ctx, `SELECT st.name AS student, u.name AS centre, b.name AS batch, x.title, x.exam_date, x.total_marks, m.marks
		FROM exam_marks m JOIN exams x ON x.id = m.exam_id AND x.published_at IS NOT NULL JOIN coaching_students st ON st.id = m.student_id
		JOIN coaching_batches b ON b.id = x.batch_id JOIN users u ON u.id = b.coaching_id
		WHERE st.user_id = ? OR st.guardian_user_id = ? ORDER BY x.exam_date DESC LIMIT 200`, userID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var r struct {
			Student string    `db:"student"`
			Centre  string    `db:"centre"`
			Batch   string    `db:"batch"`
			Title   string    `db:"title"`
			Date    time.Time `db:"exam_date"`
			Total   float64   `db:"total_marks"`
			Marks   *float64  `db:"marks"`
		}
		if err := rows.StructScan(&r); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"student": r.Student, "centre": r.Centre, "batch": r.Batch, "title": r.Title, "exam_date": r.Date, "total_marks": r.Total, "marks": r.Marks})
	}
	return out, rows.Err()
}

// ---------- fees ----------

type Fee struct {
	ID          string     `db:"id" json:"id"`
	StudentID   string     `db:"student_id" json:"student_id"`
	StudentName string     `db:"student_name" json:"student_name"`
	Month       string     `db:"month" json:"month"`
	Amount      float64    `db:"amount" json:"amount"`
	Status      string     `db:"status" json:"status"`
	PaidAt      *time.Time `db:"paid_at" json:"paid_at"`
	RemindedAt  *time.Time `db:"reminded_at" json:"reminded_at"`
}

func (s *Service) Fees(ctx context.Context, coachingID, month string) ([]Fee, error) {
	out := []Fee{}
	query := `SELECT f.id, f.student_id, st.name AS student_name, f.month, f.amount, f.status, f.paid_at, f.reminded_at FROM coaching_fees f JOIN coaching_students st ON st.id = f.student_id WHERE f.coaching_id = ?`
	args := []any{coachingID}
	if month != "" {
		query += ` AND f.month = ?`
		args = append(args, month)
	}
	err := s.db.SelectContext(ctx, &out, query+` ORDER BY f.month DESC, st.name`, args...)
	return out, err
}

// GenerateFees creates the month's due fee for every active student from the
// sum of their active batches' monthly fees. Existing rows are left alone.
func (s *Service) GenerateFees(ctx context.Context, coachingID, month string) (int64, error) {
	if len(month) != 7 || month[4] != '-' {
		return 0, badRequest("month must be YYYY-MM")
	}
	r, err := s.db.ExecContext(ctx, `INSERT IGNORE INTO coaching_fees (id, coaching_id, student_id, month, amount)
		SELECT UUID(), ?, st.id, ?, SUM(b.monthly_fee) FROM coaching_students st JOIN batch_enrollments e ON e.student_id = st.id JOIN coaching_batches b ON b.id = e.batch_id
		WHERE st.coaching_id = ? AND st.status = 'active' AND b.status = 'active' AND b.monthly_fee IS NOT NULL GROUP BY st.id HAVING SUM(b.monthly_fee) > 0`, coachingID, month, coachingID)
	if err != nil {
		return 0, err
	}
	return r.RowsAffected()
}

func (s *Service) FeeAction(ctx context.Context, coachingID, feeID, action string) error {
	switch action {
	case "paid":
		return s.scopedUpdate(ctx, `UPDATE coaching_fees SET status = 'paid', paid_at = UTC_TIMESTAMP(6) WHERE id = ? AND coaching_id = ?`, feeID, coachingID)
	case "waive":
		return s.scopedUpdate(ctx, `UPDATE coaching_fees SET status = 'waived' WHERE id = ? AND coaching_id = ?`, feeID, coachingID)
	case "remind":
		var f struct {
			Guardian sql.NullString `db:"guardian_user_id"`
			Month    string         `db:"month"`
			Status   string         `db:"status"`
		}
		if err := s.db.GetContext(ctx, &f, `SELECT st.guardian_user_id, f.month, f.status FROM coaching_fees f JOIN coaching_students st ON st.id = f.student_id WHERE f.id = ? AND f.coaching_id = ?`, feeID, coachingID); errors.Is(err, sql.ErrNoRows) {
			return notFound("fee not found")
		} else if err != nil {
			return err
		}
		if f.Status != "due" {
			return conflict("only due fees can be reminded")
		}
		if !f.Guardian.Valid {
			return conflict("this student has no linked guardian account to remind; call them instead")
		}
		s.notify(ctx, f.Guardian.String, "fee_reminder", "Coaching fee reminder", "The "+f.Month+" coaching fee is due.")
		_, err := s.db.ExecContext(ctx, `UPDATE coaching_fees SET reminded_at = UTC_TIMESTAMP(6) WHERE id = ?`, feeID)
		return err
	}
	return badRequest("action must be paid, waive or remind")
}

// CoachingReport returns operational figures computed from the centre's data.
func (s *Service) CoachingReport(ctx context.Context, coachingID string) (map[string]any, error) {
	var r struct {
		Students       int      `db:"students"`
		Teachers       int      `db:"teachers"`
		Batches        int      `db:"batches"`
		Present        int      `db:"present"`
		Marked         int      `db:"marked"`
		FeesDue        *float64 `db:"fees_due"`
		FeesPaid       *float64 `db:"fees_paid"`
		ExamsPublished int      `db:"exams_published"`
		AvgExamPct     *float64 `db:"avg_exam_pct"`
	}
	err := s.db.GetContext(ctx, &r, `SELECT
		(SELECT COUNT(*) FROM coaching_students WHERE coaching_id = ? AND status = 'active') AS students,
		(SELECT COUNT(*) FROM coaching_teachers WHERE coaching_id = ? AND status = 'active') AS teachers,
		(SELECT COUNT(*) FROM coaching_batches WHERE coaching_id = ? AND status = 'active') AS batches,
		(SELECT COUNT(*) FROM attendance_marks am JOIN class_sessions cs ON cs.id = am.session_id JOIN coaching_batches b ON b.classroom_id = cs.classroom_id WHERE b.coaching_id = ? AND am.mark IN ('present', 'late')) AS present,
		(SELECT COUNT(*) FROM attendance_marks am JOIN class_sessions cs ON cs.id = am.session_id JOIN coaching_batches b ON b.classroom_id = cs.classroom_id WHERE b.coaching_id = ?) AS marked,
		(SELECT SUM(amount) FROM coaching_fees WHERE coaching_id = ? AND status = 'due') AS fees_due,
		(SELECT SUM(amount) FROM coaching_fees WHERE coaching_id = ? AND status = 'paid') AS fees_paid,
		(SELECT COUNT(*) FROM exams x JOIN coaching_batches b ON b.id = x.batch_id WHERE b.coaching_id = ? AND x.published_at IS NOT NULL) AS exams_published,
		(SELECT AVG(m.marks * 100 / x.total_marks) FROM exam_marks m JOIN exams x ON x.id = m.exam_id JOIN coaching_batches b ON b.id = x.batch_id WHERE b.coaching_id = ? AND m.marks IS NOT NULL) AS avg_exam_pct`,
		coachingID, coachingID, coachingID, coachingID, coachingID, coachingID, coachingID, coachingID, coachingID)
	if err != nil {
		return nil, err
	}
	var attendance *float64
	if r.Marked > 0 {
		attendance = ptr(float64(r.Present) * 100 / float64(r.Marked))
	}
	return map[string]any{"students": r.Students, "teachers": r.Teachers, "batches": r.Batches, "attendance_percent": attendance, "attendance_marks": r.Marked,
		"fees_due": r.FeesDue, "fees_paid": r.FeesPaid, "exams_published": r.ExamsPublished, "average_exam_percent": r.AvgExamPct}, nil
}

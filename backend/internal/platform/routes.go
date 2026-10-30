package platform

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuitionhub/backend/internal/auth"
	"github.com/tuitionhub/backend/internal/ratelimit"
)

func RegisterRoutes(r *gin.RouterGroup, authService *auth.Service, s *Service) {
	// Public discovery (no contact details). OptionalAuth personalises results when signed in.
	pub := r.Group("/public", auth.OptionalAuth(authService))
	pub.GET("/tutors", s.hSearchTutors)
	pub.GET("/tutors/:id", s.hTutor)
	pub.GET("/coaching", s.hSearchCentres)
	pub.GET("/coaching/:id", s.hCentre)
	pub.GET("/tuition", s.hSearchListings(false))
	pub.GET("/tuition/:id", s.hListing)
	pub.GET("/info", func(c *gin.Context) { out, err := s.PublicInfo(c.Request.Context()); respond(c, 200, err, out) })
	// Anonymous contact form: capped per address so it cannot be used to flood the support queue.
	contactLimit := ratelimit.New(10, time.Hour)
	pub.POST("/contact", func(c *gin.Context) {
		if ok, _ := contactLimit.Allow(c.ClientIP()); !ok {
			fail(c, apiError{http.StatusTooManyRequests, "too many messages; please try again later"})
			return
		}
		contactLimit.Hit(c.ClientIP())
		var in struct {
			Name     string `json:"name" validate:"required,max=120"`
			Email    string `json:"email" validate:"required,email,max=255"`
			Category string `json:"category" validate:"max=30"`
			Subject  string `json:"subject" validate:"required,max=200"`
			Body     string `json:"body" validate:"required,min=10,max=5000"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		respond(c, 201, s.ContactRequest(c.Request.Context(), uid(c), in.Name, in.Email, in.Category, in.Subject, in.Body), nil)
	})
	pub.GET("/users/:id/photo", func(c *gin.Context) { s.Photo(c, uid(c), role(c)) })

	a := r.Group("", auth.RequireAuth(authService))

	a.POST("/profile/photo", s.SetPhoto)
	a.GET("/users/:id/awards", func(c *gin.Context) {
		out, err := s.Awards(c.Request.Context(), c.Param("id"))
		respond(c, 200, err, gin.H{"awards": out})
	})
	a.POST("/users/:id/block", func(c *gin.Context) {
		respond(c, 204, s.SetBlock(c.Request.Context(), uid(c), c.Param("id"), true), nil)
	})
	a.DELETE("/users/:id/block", func(c *gin.Context) {
		respond(c, 204, s.SetBlock(c.Request.Context(), uid(c), c.Param("id"), false), nil)
	})

	// Tuition posts and applications.
	a.GET("/tuition-posts", s.hSearchListings(true))
	a.GET("/tuition-posts/mine", func(c *gin.Context) {
		out, err := s.MyListings(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"posts": out})
	})
	a.POST("/tuition-posts", s.hCreateListing)
	a.PUT("/tuition-posts/:id", s.hUpdateListing)
	a.POST("/tuition-posts/:id/status", s.hListingStatus)
	a.POST("/tuition-posts/:id/apply", s.hApply)
	a.GET("/tuition-posts/:id/applications", func(c *gin.Context) {
		out, err := s.ListingApplications(c.Request.Context(), uid(c), role(c), c.Param("id"))
		respond(c, 200, err, gin.H{"applications": out})
	})
	a.POST("/tuition-posts/:id/save", func(c *gin.Context) {
		respond(c, 204, s.SetSaved(c.Request.Context(), uid(c), c.Param("id"), true), nil)
	})
	a.DELETE("/tuition-posts/:id/save", func(c *gin.Context) {
		respond(c, 204, s.SetSaved(c.Request.Context(), uid(c), c.Param("id"), false), nil)
	})
	a.GET("/applications/mine", func(c *gin.Context) {
		out, err := s.MyApplications(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"applications": out})
	})
	a.POST("/applications/:id/status", s.hApplicationStatus)

	// Guardian links.
	a.GET("/links", func(c *gin.Context) {
		out, err := s.Links(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"links": out})
	})
	a.POST("/links", s.hRequestLink)
	a.POST("/links/:id/respond", s.hRespondLink)
	a.GET("/students/:id/progress", func(c *gin.Context) {
		out, err := s.StudentProgress(c.Request.Context(), uid(c), role(c), c.Param("id"))
		respond(c, 200, err, out)
	})
	a.GET("/results", func(c *gin.Context) {
		out, err := s.MyResults(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"results": out})
	})

	// Chat requests and messaging.
	a.GET("/chat-requests", func(c *gin.Context) {
		out, err := s.ChatRequests(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"requests": out})
	})
	a.POST("/chat-requests", s.hRequestChat)
	a.POST("/chat-requests/:id/:action", func(c *gin.Context) {
		out, err := s.RespondChat(c.Request.Context(), uid(c), c.Param("id"), c.Param("action"))
		respond(c, 200, err, out)
	})
	a.GET("/conversations", func(c *gin.Context) {
		out, err := s.Conversations(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"conversations": out})
	})
	a.GET("/conversations/unread", func(c *gin.Context) {
		n, err := s.UnreadMessages(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"unread": n})
	})
	a.GET("/conversations/:id/messages", s.hMessages)
	a.POST("/conversations/:id/messages", s.hSendMessage)
	a.POST("/conversations/:id/read", func(c *gin.Context) {
		respond(c, 204, s.MarkConversationRead(c.Request.Context(), uid(c), c.Param("id")), nil)
	})

	// Tuition agreements, payments and reviews.
	a.GET("/engagements", func(c *gin.Context) {
		out, err := s.Engagements(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"engagements": out})
	})
	a.POST("/engagements", s.hCreateEngagement)
	a.POST("/engagements/:id/actions", s.hEngagementAction)
	a.GET("/engagements/:id/payments", func(c *gin.Context) {
		out, err := s.Payments(c.Request.Context(), uid(c), c.Param("id"))
		respond(c, 200, err, gin.H{"payments": out})
	})
	a.POST("/engagements/:id/payments", s.hPaymentAction)
	a.POST("/engagements/:id/review", s.hReview)
	a.GET("/users/:id/reviews", func(c *gin.Context) {
		out, err := s.ReviewsFor(c.Request.Context(), c.Param("id"))
		respond(c, 200, err, gin.H{"reviews": out})
	})
	a.POST("/reviews/:id/reply", s.hReplyReview)

	// Classrooms.
	a.GET("/classrooms", func(c *gin.Context) {
		out, err := s.Classrooms(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"classrooms": out})
	})
	a.POST("/classrooms", s.hCreateClassroom)
	a.GET("/classrooms/:id", func(c *gin.Context) { out, err := s.ClassroomDetail(c, c.Param("id")); respond(c, 200, err, out) })
	a.POST("/classrooms/:id/members", s.owner(func(c *gin.Context) error {
		var in struct {
			Email string `json:"email" validate:"required,email"`
		}
		if err := s.bind(c, &in); err != nil {
			return err
		}
		return s.AddMember(c.Request.Context(), c.Param("id"), in.Email)
	}))
	a.DELETE("/classrooms/:id/members/:student", s.owner(func(c *gin.Context) error {
		return s.RemoveMember(c.Request.Context(), c.Param("id"), c.Param("student"))
	}))
	a.POST("/classrooms/:id/materials", s.owner(func(c *gin.Context) error {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFileBytes+1<<20)
		_, err := s.AddMaterial(c, c.Param("id"))
		return err
	}))
	a.GET("/materials/:id/file", func(c *gin.Context) { s.MaterialFile(c, c.Param("id")) })
	a.POST("/classrooms/:id/assignments", s.owner(func(c *gin.Context) error {
		var in assignmentInput
		if err := s.bind(c, &in); err != nil {
			return err
		}
		_, err := s.CreateAssignment(c.Request.Context(), uid(c), c.Param("id"), in)
		return err
	}))
	a.POST("/assignments/:id/submit", func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxFileBytes+1<<20)
		respond(c, 201, s.Submit(c, c.Param("id")), nil)
	})
	a.GET("/assignments/:id/submissions", func(c *gin.Context) {
		out, err := s.Submissions(c, c.Param("id"))
		respond(c, 200, err, gin.H{"submissions": out})
	})
	a.POST("/submissions/:id/review", func(c *gin.Context) {
		var in struct {
			Score    *float64 `json:"score"`
			Feedback string   `json:"feedback" validate:"max=4000"`
			Status   string   `json:"status" validate:"required"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		respond(c, 204, s.ReviewSubmission(c, c.Param("id"), in.Score, in.Feedback, in.Status), nil)
	})
	a.GET("/submissions/:id/file", func(c *gin.Context) { s.SubmissionFile(c, c.Param("id")) })
	a.POST("/classrooms/:id/sessions", s.owner(func(c *gin.Context) error {
		var in sessionInput
		if err := s.bind(c, &in); err != nil {
			return err
		}
		_, err := s.CreateSessions(c.Request.Context(), c.Param("id"), in)
		return err
	}))
	a.POST("/sessions/:id/status", s.sessionOwner(func(c *gin.Context) error {
		var in struct {
			Status   string `json:"status" validate:"required"`
			Note     string `json:"note" validate:"max=255"`
			StartsAt string `json:"new_starts_at"`
		}
		if err := s.bind(c, &in); err != nil {
			return err
		}
		return s.SetSessionStatus(c.Request.Context(), c.Param("id"), in.Status, in.Note, in.StartsAt)
	}))
	a.POST("/sessions/:id/attendance", s.sessionOwner(func(c *gin.Context) error {
		var in struct {
			Marks []markInput `json:"marks" validate:"required,min=1,max=500,dive"`
		}
		if err := s.bind(c, &in); err != nil {
			return err
		}
		return s.MarkAttendance(c.Request.Context(), uid(c), c.Param("id"), in.Marks)
	}))
	a.POST("/classrooms/:id/diary", s.owner(func(c *gin.Context) error {
		var in diaryInput
		if err := s.bind(c, &in); err != nil {
			return err
		}
		return s.SaveDiary(c.Request.Context(), uid(c), c.Param("id"), in)
	}))

	// Coaching centre management (coaching accounts only, scoped to the caller).
	co := a.Group("/coaching", func(c *gin.Context) {
		if role(c) != "coaching" {
			fail(c, forbidden("coaching centre accounts only"))
			return
		}
		c.Next()
	})
	co.GET("/teachers", func(c *gin.Context) {
		out, err := s.Teachers(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"teachers": out})
	})
	co.POST("/teachers", s.save(func(c *gin.Context, id string) (string, error) {
		var in teacherInput
		if err := s.bind(c, &in); err != nil {
			return "", err
		}
		return s.SaveTeacher(c.Request.Context(), uid(c), id, in)
	}))
	co.PUT("/teachers/:id", s.save(func(c *gin.Context, id string) (string, error) {
		var in teacherInput
		if err := s.bind(c, &in); err != nil {
			return "", err
		}
		return s.SaveTeacher(c.Request.Context(), uid(c), id, in)
	}))
	co.GET("/courses", func(c *gin.Context) {
		out, err := s.Courses(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"courses": out})
	})
	saveCourse := s.save(func(c *gin.Context, id string) (string, error) {
		var in courseInput
		if err := s.bind(c, &in); err != nil {
			return "", err
		}
		return s.SaveCourse(c.Request.Context(), uid(c), id, in)
	})
	co.POST("/courses", saveCourse)
	co.PUT("/courses/:id", saveCourse)
	co.GET("/branches", func(c *gin.Context) {
		out, err := s.Branches(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"branches": out})
	})
	saveBranch := s.save(func(c *gin.Context, id string) (string, error) {
		var in struct {
			Name    string `json:"name" validate:"required,max=120"`
			Address string `json:"address" validate:"max=255"`
		}
		if err := s.bind(c, &in); err != nil {
			return "", err
		}
		return s.SaveBranch(c.Request.Context(), uid(c), id, in.Name, in.Address)
	})
	co.POST("/branches", saveBranch)
	co.PUT("/branches/:id", saveBranch)
	co.GET("/students", func(c *gin.Context) {
		out, err := s.Roster(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"students": out})
	})
	saveStudent := s.save(func(c *gin.Context, id string) (string, error) {
		var in rosterInput
		if err := s.bind(c, &in); err != nil {
			return "", err
		}
		return s.SaveRosterStudent(c.Request.Context(), uid(c), id, in)
	})
	co.POST("/students", saveStudent)
	co.PUT("/students/:id", saveStudent)
	co.GET("/batches", func(c *gin.Context) {
		out, err := s.Batches(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"batches": out})
	})
	saveBatch := s.save(func(c *gin.Context, id string) (string, error) {
		var in batchInput
		if err := s.bind(c, &in); err != nil {
			return "", err
		}
		return s.SaveBatch(c.Request.Context(), uid(c), id, in)
	})
	co.POST("/batches", saveBatch)
	co.PUT("/batches/:id", saveBatch)
	co.GET("/batches/:id/learners", func(c *gin.Context) {
		out, err := s.BatchLearners(c.Request.Context(), uid(c), c.Param("id"))
		respond(c, 200, err, gin.H{"learners": out})
	})
	co.POST("/batches/:id/enrollments/:student", func(c *gin.Context) {
		respond(c, 204, s.SetEnrollment(c.Request.Context(), uid(c), c.Param("id"), c.Param("student"), true), nil)
	})
	co.DELETE("/batches/:id/enrollments/:student", func(c *gin.Context) {
		respond(c, 204, s.SetEnrollment(c.Request.Context(), uid(c), c.Param("id"), c.Param("student"), false), nil)
	})
	co.GET("/exams", func(c *gin.Context) {
		out, err := s.Exams(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"exams": out})
	})
	co.POST("/exams", s.save(func(c *gin.Context, _ string) (string, error) {
		var in struct {
			BatchID    string  `json:"batch_id" validate:"required,uuid"`
			Title      string  `json:"title" validate:"required,max=160"`
			ExamDate   string  `json:"exam_date" validate:"required"`
			TotalMarks float64 `json:"total_marks" validate:"required,gt=0,lte=1000"`
		}
		if err := s.bind(c, &in); err != nil {
			return "", err
		}
		return s.CreateExam(c.Request.Context(), uid(c), in.BatchID, in.Title, in.ExamDate, in.TotalMarks)
	}))
	co.GET("/exams/:id/marks", func(c *gin.Context) {
		out, err := s.ExamMarks(c.Request.Context(), uid(c), c.Param("id"))
		respond(c, 200, err, gin.H{"marks": out})
	})
	co.POST("/exams/:id/marks", func(c *gin.Context) {
		var in struct {
			Marks   map[string]*float64 `json:"marks"`
			Publish bool                `json:"publish"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		respond(c, 204, s.SaveExamMarks(c.Request.Context(), uid(c), c.Param("id"), in.Marks, in.Publish), nil)
	})
	co.GET("/fees", func(c *gin.Context) {
		out, err := s.Fees(c.Request.Context(), uid(c), c.Query("month"))
		respond(c, 200, err, gin.H{"fees": out})
	})
	co.POST("/fees/generate", func(c *gin.Context) {
		var in struct {
			Month string `json:"month" validate:"required"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		n, err := s.GenerateFees(c.Request.Context(), uid(c), in.Month)
		respond(c, 200, err, gin.H{"created": n})
	})
	co.POST("/fees/:id/:action", func(c *gin.Context) {
		respond(c, 204, s.FeeAction(c.Request.Context(), uid(c), c.Param("id"), c.Param("action")), nil)
	})
	co.GET("/report", func(c *gin.Context) {
		out, err := s.CoachingReport(c.Request.Context(), uid(c))
		respond(c, 200, err, out)
	})

	// Support and reports from any user.
	a.POST("/support-tickets", func(c *gin.Context) {
		var in ticketInput
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		id, err := s.CreateTicket(c.Request.Context(), uid(c), in)
		respond(c, 201, err, gin.H{"id": id})
	})
	a.GET("/support-tickets/mine", func(c *gin.Context) {
		out, err := s.MyTickets(c.Request.Context(), uid(c))
		respond(c, 200, err, gin.H{"tickets": out})
	})

	// Platform administration.
	ad := a.Group("/admin", func(c *gin.Context) {
		if role(c) != "admin" {
			fail(c, forbidden("administrator access required"))
			return
		}
		c.Next()
	})
	ad.GET("/tickets", func(c *gin.Context) {
		out, err := s.AdminTickets(c.Request.Context(), c.Query("status"), c.Query("category"), queryInt(c, "limit", 50, 200), queryInt(c, "offset", 0, 1<<30))
		respond(c, 200, err, gin.H{"tickets": out})
	})
	ad.POST("/tickets/:id", func(c *gin.Context) {
		var in struct {
			Status     string `json:"status" validate:"required"`
			Resolution string `json:"resolution" validate:"max=4000"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		respond(c, 204, s.UpdateTicket(c.Request.Context(), uid(c), c.Param("id"), in.Status, in.Resolution), nil)
	})
	ad.GET("/tuition-posts", func(c *gin.Context) {
		out, total, err := s.AdminListings(c.Request.Context(), c.Query("status"), c.Query("q"), queryInt(c, "limit", 25, 100), queryInt(c, "offset", 0, 1<<30))
		respond(c, 200, err, gin.H{"posts": out, "total": total})
	})
	ad.POST("/tuition-posts/:id/status", func(c *gin.Context) {
		var in struct {
			Status string `json:"status" validate:"required"`
			Reason string `json:"reason" validate:"max=500"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		err := s.UpdateListing(c.Request.Context(), uid(c), "admin", c.Param("id"), listingInput{}, in.Status)
		if err == nil {
			s.audit(c.Request.Context(), uid(c), "", "tuition_post_"+in.Status, map[string]any{"listing_id": c.Param("id"), "reason": in.Reason})
		}
		respond(c, 204, err, nil)
	})
	ad.GET("/settings", func(c *gin.Context) {
		out, err := s.Settings(c.Request.Context())
		respond(c, 200, err, gin.H{"settings": out})
	})
	ad.PUT("/settings", func(c *gin.Context) {
		var in map[string]any
		if err := c.ShouldBindJSON(&in); err != nil {
			fail(c, badRequest("invalid settings"))
			return
		}
		respond(c, 204, s.SaveSettings(c.Request.Context(), uid(c), in), nil)
	})
	ad.POST("/announcements", func(c *gin.Context) {
		var in struct {
			Role  string `json:"role"`
			Title string `json:"title" validate:"required"`
			Body  string `json:"body" validate:"required,max=2000"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		n, err := s.Broadcast(c.Request.Context(), uid(c), in.Role, in.Title, in.Body)
		respond(c, 200, err, gin.H{"recipients": n})
	})
	ad.POST("/awards", func(c *gin.Context) {
		var in struct {
			UserID      string `json:"user_id" validate:"required,uuid"`
			Title       string `json:"title" validate:"required"`
			Description string `json:"description" validate:"max=255"`
		}
		if err := s.bind(c, &in); err != nil {
			fail(c, err)
			return
		}
		respond(c, 204, s.GrantAward(c.Request.Context(), uid(c), in.UserID, in.Title, in.Description), nil)
	})
	ad.GET("/users/:id", func(c *gin.Context) {
		out, err := s.UserActivity(c.Request.Context(), c.Param("id"))
		respond(c, 200, err, out)
	})
	ad.GET("/reports", func(c *gin.Context) {
		to := time.Now().UTC()
		from := to.AddDate(0, 0, -30)
		if t, err := time.Parse("2006-01-02", c.Query("from")); err == nil {
			from = t
		}
		if t, err := time.Parse("2006-01-02", c.Query("to")); err == nil {
			to = t.Add(24*time.Hour - time.Nanosecond)
		}
		out, err := s.PlatformReport(c.Request.Context(), from, to)
		respond(c, 200, err, out)
	})
	ad.GET("/engagements", func(c *gin.Context) {
		out, err := s.AdminEngagements(c.Request.Context(), c.Query("status"))
		respond(c, 200, err, gin.H{"engagements": out})
	})
	ad.GET("/reviews", func(c *gin.Context) {
		out, err := s.AdminReviews(c.Request.Context())
		respond(c, 200, err, gin.H{"reviews": out})
	})
	ad.GET("/payments", func(c *gin.Context) {
		out, err := s.AdminPayments(c.Request.Context(), c.Query("status"))
		respond(c, 200, err, gin.H{"payments": out})
	})
	ad.GET("/suspicious", func(c *gin.Context) {
		out, err := s.Suspicious(c.Request.Context())
		respond(c, 200, err, gin.H{"accounts": out})
	})
}

// owner wraps a classroom action that only the classroom's teacher may perform.
func (s *Service) owner(fn func(*gin.Context) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		if _, err := s.needAccess(c.Request.Context(), c, c.Param("id"), ownerAccess); err != nil {
			fail(c, err)
			return
		}
		respond(c, http.StatusNoContent, fn(c), nil)
	}
}

func (s *Service) sessionOwner(fn func(*gin.Context) error) gin.HandlerFunc {
	return func(c *gin.Context) {
		classroom, err := s.sessionClassroom(c.Request.Context(), c.Param("id"))
		if err == nil {
			_, err = s.needAccess(c.Request.Context(), c, classroom, ownerAccess)
		}
		if err != nil {
			fail(c, err)
			return
		}
		respond(c, http.StatusNoContent, fn(c), nil)
	}
}

// save wraps create (POST, no :id) and update (PUT /:id) handlers that return an id.
func (s *Service) save(fn func(*gin.Context, string) (string, error)) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, err := fn(c, c.Param("id"))
		status := http.StatusCreated
		if c.Param("id") != "" {
			status = http.StatusOK
		}
		respond(c, status, err, gin.H{"id": id})
	}
}

func (s *Service) hSearchTutors(c *gin.Context) {
	fee, _ := strconv.ParseFloat(c.Query("max_fee"), 64)
	out, total, err := s.SearchTutors(c.Request.Context(), tutorFilter{Subject: c.Query("subject"), Area: c.Query("area"), Class: c.Query("class"), Mode: c.Query("mode"), Query: c.Query("q"), MaxFee: fee,
		Limit: queryInt(c, "limit", 20, 50), Offset: queryInt(c, "offset", 0, 1<<30)})
	respond(c, 200, err, gin.H{"tutors": out, "total": total})
}

func (s *Service) hTutor(c *gin.Context) {
	card, err := s.Tutor(c.Request.Context(), c.Param("id"))
	if err != nil {
		fail(c, err)
		return
	}
	reviews, err := s.ReviewsFor(c.Request.Context(), card.ID)
	if err != nil {
		fail(c, err)
		return
	}
	awards, err := s.Awards(c.Request.Context(), card.ID)
	respond(c, 200, err, gin.H{"tutor": card, "reviews": reviews, "awards": awards})
}

func (s *Service) hSearchCentres(c *gin.Context) {
	out, total, err := s.SearchCentres(c.Request.Context(), c.Query("subject"), c.Query("area"), c.Query("q"), queryInt(c, "limit", 20, 50), queryInt(c, "offset", 0, 1<<30))
	respond(c, 200, err, gin.H{"centres": out, "total": total})
}

func (s *Service) hCentre(c *gin.Context) {
	d, err := s.Centre(c.Request.Context(), c.Param("id"))
	if err != nil {
		fail(c, err)
		return
	}
	reviews, err := s.ReviewsFor(c.Request.Context(), d.ID)
	respond(c, 200, err, gin.H{"centre": d, "reviews": reviews})
}

func (s *Service) hSearchListings(signedIn bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		budget, _ := strconv.ParseFloat(c.Query("min_budget"), 64)
		out, total, err := s.SearchListings(c.Request.Context(), uid(c), listingFilter{Subject: c.Query("subject"), Class: c.Query("class"), Area: c.Query("area"), Mode: c.Query("mode"), Query: c.Query("q"),
			MinBudget: budget, SavedOnly: signedIn && c.Query("saved") == "1", Limit: queryInt(c, "limit", 20, 50), Offset: queryInt(c, "offset", 0, 1<<30)})
		respond(c, 200, err, gin.H{"posts": out, "total": total})
	}
}

func (s *Service) hListing(c *gin.Context) {
	l, err := s.Listing(c.Request.Context(), uid(c), c.Param("id"))
	if err == nil && l.Status != "open" && l.OwnerID != uid(c) && role(c) != "admin" && (l.MyApplication == nil) {
		err = notFound("tuition post not found")
	}
	respond(c, 200, err, gin.H{"post": l})
}

func (s *Service) hCreateListing(c *gin.Context) {
	if err := requireRole(c, "parent", "student"); err != nil {
		fail(c, err)
		return
	}
	var in listingInput
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	id, err := s.CreateListing(c.Request.Context(), uid(c), role(c), in)
	respond(c, 201, err, gin.H{"id": id})
}

func (s *Service) hUpdateListing(c *gin.Context) {
	var in listingInput
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	respond(c, 204, s.UpdateListing(c.Request.Context(), uid(c), role(c), c.Param("id"), in, ""), nil)
}

func (s *Service) hListingStatus(c *gin.Context) {
	var in struct {
		Status string `json:"status" validate:"required"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	respond(c, 204, s.UpdateListing(c.Request.Context(), uid(c), role(c), c.Param("id"), listingInput{}, in.Status), nil)
}

func (s *Service) hApply(c *gin.Context) {
	if err := requireRole(c, "tutor"); err != nil {
		fail(c, err)
		return
	}
	if err := requireActive(c); err != nil {
		fail(c, err)
		return
	}
	var in struct {
		Note string `json:"note" validate:"max=2000"`
	}
	_ = c.ShouldBindJSON(&in)
	respond(c, 201, s.Apply(c.Request.Context(), uid(c), c.Param("id"), in.Note), nil)
}

func (s *Service) hApplicationStatus(c *gin.Context) {
	var in struct {
		Status string `json:"status" validate:"required"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	out, err := s.SetApplicationStatus(c.Request.Context(), uid(c), c.Param("id"), in.Status)
	respond(c, 200, err, out)
}

func (s *Service) hRequestLink(c *gin.Context) {
	if err := requireRole(c, "parent"); err != nil {
		fail(c, err)
		return
	}
	var in struct {
		StudentEmail string `json:"student_email" validate:"required,email"`
		Relationship string `json:"relationship" validate:"required,max=64"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	respond(c, 201, s.RequestLink(c.Request.Context(), uid(c), in.StudentEmail, strings.TrimSpace(in.Relationship)), nil)
}

func (s *Service) hRespondLink(c *gin.Context) {
	var in struct {
		Accept bool `json:"accept"`
	}
	_ = c.ShouldBindJSON(&in)
	respond(c, 204, s.RespondLink(c.Request.Context(), uid(c), c.Param("id"), in.Accept), nil)
}

func (s *Service) hRequestChat(c *gin.Context) {
	var in struct {
		ToID      string `json:"to_id" validate:"required,uuid"`
		ListingID string `json:"listing_id" validate:"omitempty,uuid"`
		StudentID string `json:"student_id" validate:"omitempty,uuid"`
		Message   string `json:"message" validate:"max=2000"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	id, err := s.RequestChat(c.Request.Context(), uid(c), role(c), in.ToID, in.ListingID, in.StudentID, in.Message)
	respond(c, 201, err, gin.H{"id": id})
}

func (s *Service) hMessages(c *gin.Context) {
	var after *time.Time
	if t, err := time.Parse(time.RFC3339Nano, c.Query("after")); err == nil {
		after = &t
	}
	out, err := s.Messages(c.Request.Context(), uid(c), c.Param("id"), after)
	respond(c, 200, err, gin.H{"messages": out})
}

func (s *Service) hSendMessage(c *gin.Context) {
	var in struct {
		Body string `json:"body" validate:"required"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	m, err := s.SendMessage(c.Request.Context(), uid(c), c.Param("id"), in.Body)
	respond(c, 201, err, gin.H{"message": m})
}

func (s *Service) hCreateEngagement(c *gin.Context) {
	var in engagementInput
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	id, err := s.CreateEngagement(c.Request.Context(), uid(c), role(c), in)
	respond(c, 201, err, gin.H{"id": id})
}

func (s *Service) hEngagementAction(c *gin.Context) {
	var in engagementAction
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	out, err := s.ActOnEngagement(c.Request.Context(), uid(c), c.Param("id"), in)
	respond(c, 200, err, out)
}

func (s *Service) hPaymentAction(c *gin.Context) {
	var in struct {
		Action string `json:"action" validate:"required,oneof=due mark_paid confirm dispute"`
		Month  string `json:"month" validate:"required"`
		Note   string `json:"note" validate:"max=255"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	respond(c, 204, s.PaymentAction(c.Request.Context(), uid(c), c.Param("id"), in.Action, in.Month, in.Note), nil)
}

func (s *Service) hReview(c *gin.Context) {
	var in struct {
		Stars int    `json:"stars" validate:"required,min=1,max=5"`
		Body  string `json:"body" validate:"max=2000"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	respond(c, 204, s.Review(c.Request.Context(), uid(c), c.Param("id"), in.Stars, in.Body), nil)
}

func (s *Service) hReplyReview(c *gin.Context) {
	var in struct {
		Reply string `json:"reply" validate:"required,max=2000"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	respond(c, 204, s.ReplyReview(c.Request.Context(), uid(c), c.Param("id"), in.Reply), nil)
}

func (s *Service) hCreateClassroom(c *gin.Context) {
	if err := requireRole(c, "tutor", "coaching"); err != nil {
		fail(c, err)
		return
	}
	if err := requireActive(c); err != nil {
		fail(c, err)
		return
	}
	var in struct {
		Name        string `json:"name" validate:"required,max=160"`
		Subject     string `json:"subject" validate:"max=100"`
		Description string `json:"description" validate:"max=2000"`
	}
	if err := s.bind(c, &in); err != nil {
		fail(c, err)
		return
	}
	id, err := s.CreateClassroom(c.Request.Context(), uid(c), in.Name, in.Subject, in.Description)
	respond(c, 201, err, gin.H{"id": id})
}

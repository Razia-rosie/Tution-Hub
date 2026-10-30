package workflow

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/tuitionhub/backend/internal/auth"
)

func RegisterRoutes(r *gin.RouterGroup, authService *auth.Service, service *Service) {
	api := r.Group("/workflow")
	api.Use(auth.RequireAuth(authService))
	api.GET("/dashboard", dashboard(service))
	api.PUT("/profile", profile(service))
	api.POST("/verification/submit", submitVerification(service))
	api.POST("/verification/documents", uploadDocument(service))
	api.GET("/verification/documents/:id", document(service, authService))
	api.GET("/notifications", notifications(service))
	api.POST("/notifications/read", markNotificationsRead(service))
	api.GET("/relationships", relationships(service))
	api.POST("/relationships", createRelationship(service))
	api.GET("/tuition", requireActive(service, tuition(service)))

	admin := api.Group("/admin")
	admin.Use(requireAdmin())
	admin.GET("/verifications", listVerifications(service))
	admin.GET("/verifications/:id/documents", listDocuments(service))
	admin.POST("/verifications/:id/decision", reviewVerification(service))
	admin.POST("/verifications/:id/interviews", scheduleInterview(service))
	admin.POST("/verifications/:id/interviews/:interviewID/outcome", interviewOutcome(service))
	admin.GET("/verifications/:id/history", applicationHistory(service))
	admin.GET("/stats", adminStats(service))
	admin.GET("/users", adminUsers(service))
	admin.POST("/users/:id/suspend", setSuspended(service, true))
	admin.POST("/users/:id/reactivate", setSuspended(service, false))
	admin.GET("/audit-logs", auditLogs(service))
}

func userID(c *gin.Context) string { return c.GetString("user_id") }

// serverError logs the underlying cause, which the client never sees, and aborts with a generic 500.
func serverError(c *gin.Context, message string, err error) {
	slog.Error(message, "error", err, "method", c.Request.Method, "path", c.FullPath(), "user_id", userID(c))
	c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": message})
}

func dashboard(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		result, err := s.GetDashboard(c.Request.Context(), userID(c))
		if err != nil {
			serverError(c, "could not load dashboard", err)
			return
		}
		c.JSON(http.StatusOK, result)
	}
}

func profile(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var input map[string]any
		if err := c.ShouldBindJSON(&input); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid profile data"})
			return
		}
		if err := s.UpsertProfile(c.Request.Context(), userID(c), input); errors.Is(err, ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": "your profile is locked while your verification is under review"})
			return
		} else if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "could not save profile"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func submitVerification(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		verification, err := s.SubmitVerification(c.Request.Context(), userID(c))
		var incomplete *IncompleteError
		if errors.As(err, &incomplete) {
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "please complete your application before submitting", "missing": incomplete.Missing})
			return
		}
		if errors.Is(err, ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "only tutors and coaching centres go through verification"})
			return
		}
		if errors.Is(err, ErrInvalidState) {
			c.JSON(http.StatusConflict, gin.H{"error": "verification cannot be submitted in the current account state"})
			return
		}
		if err != nil {
			serverError(c, "could not submit verification", err)
			return
		}
		c.JSON(http.StatusAccepted, gin.H{"verification": verification})
	}
}

func uploadDocument(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Cap the whole multipart body (file plus form fields) before parsing it.
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxDocumentBytes+1<<20)
		applicationID := strings.TrimSpace(c.PostForm("application_id"))
		documentType := strings.TrimSpace(c.PostForm("document_type"))
		if documentType == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "document_type is required"})
			return
		}
		file, header, err := c.Request.FormFile("document")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "an image file of 10 MB or less is required"})
			return
		}
		defer file.Close()
		if header.Size <= 0 || header.Size > maxDocumentBytes {
			c.JSON(http.StatusBadRequest, gin.H{"error": "document must be 10 MB or smaller"})
			return
		}
		// A single Read may return fewer bytes than requested; ReadFull does not.
		content := make([]byte, header.Size)
		if _, err := io.ReadFull(file, content); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "could not read document"})
			return
		}
		doc, err := s.SaveDocument(c.Request.Context(), userID(c), applicationID, documentType, header.Filename, content)
		switch {
		case errors.Is(err, ErrInvalidImage):
			c.JSON(http.StatusBadRequest, gin.H{"error": "only real JPEG, PNG or WebP pictures are accepted"})
		case errors.Is(err, ErrInvalidState):
			c.JSON(http.StatusBadRequest, gin.H{"error": "this document type is not accepted for your account"})
		case errors.Is(err, ErrForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "you cannot upload to this verification request"})
		case errors.Is(err, ErrConflict):
			c.JSON(http.StatusConflict, gin.H{"error": "pictures cannot be changed while the application is under review or after a decision"})
		case err != nil:
			serverError(c, "could not save document", err)
		default:
			c.JSON(http.StatusCreated, gin.H{"document": doc})
		}
	}
}

func document(s *Service, authService *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		stored, err := s.GetDocument(c.Request.Context(), c.Param("id"))
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		if err != nil {
			serverError(c, "could not load document", err)
			return
		}
		if userID(c) != stored.OwnerID && c.GetString("role") != "admin" {
			// 404 rather than 403 so document IDs cannot be probed for existence.
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		path := s.DocumentPath(stored.StorageKey)
		if _, err := os.Stat(path); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
			return
		}
		if c.GetString("role") == "admin" && userID(c) != stored.OwnerID {
			s.Audit(c.Request.Context(), userID(c), stored.OwnerID, "document_viewed", map[string]any{"document_id": stored.ID, "document_type": stored.DocumentType})
		}
		// Identity pictures: never cache, never sniff, never run anything embedded.
		c.Header("Cache-Control", "private, no-store")
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("Content-Security-Policy", "default-src 'none'; img-src 'self'; sandbox")
		c.Header("Content-Type", stored.MimeType)
		c.Header("Content-Disposition", "inline; filename="+strconv.Quote(stored.OriginalName))
		c.File(path)
	}
}

func notifications(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := s.Notifications(c.Request.Context(), userID(c))
		if err != nil {
			serverError(c, "could not load notifications", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"notifications": items})
	}
}

func relationships(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := s.Relationships(c.Request.Context(), userID(c))
		if err != nil {
			serverError(c, "could not load relationships", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"relationships": items})
	}
}

func createRelationship(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			StudentID    string `json:"student_id" binding:"required"`
			Relationship string `json:"relationship" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "student_id and relationship are required"})
			return
		}
		if err := s.CreateRelationship(c.Request.Context(), userID(c), req.StudentID, req.Relationship); errors.Is(err, ErrForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "only a guardian can request a student link"})
			return
		} else if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "could not create relationship"})
			return
		}
		c.Status(http.StatusCreated)
	}
}

func tuition(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := s.ListTuition(c.Request.Context(), c.Query("subject"), c.Query("class"), c.Query("area"))
		if err != nil {
			serverError(c, "could not load tuition listings", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"listings": items})
	}
}

// requireAdmin relies on the role RequireAuth loaded from the database for this request.
func requireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString("role") != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "administrator access required"})
			return
		}
		c.Next()
	}
}

func requireActive(service *Service, next gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		var status string
		if err := service.db.GetContext(c.Request.Context(), &status, `SELECT account_status FROM users WHERE id = ?`, userID(c)); err != nil {
			serverError(c, "could not check account status", err)
			return
		}
		if status != "active" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "account must be active before using this feature"})
			return
		}
		next(c)
	}
}

func listVerifications(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		items, err := s.ListVerifications(c.Request.Context(), c.Query("status"), c.Query("role"))
		if err != nil {
			serverError(c, "could not load verification requests", err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"applications": items})
	}
}

func interviewOutcome(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Status string `json:"status" binding:"required"`
			Notes  string `json:"notes"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status is required"})
			return
		}
		if err := s.RecordInterviewOutcome(c.Request.Context(), userID(c), c.Param("interviewID"), req.Status, req.Notes); errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "interview not found"})
			return
		} else if errors.Is(err, ErrInvalidState) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "status must be completed or cancelled"})
			return
		} else if errors.Is(err, ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": "interview cannot transition from its current state"})
			return
		} else if err != nil {
			serverError(c, "could not save interview outcome", err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func listDocuments(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		documents, err := s.ListDocuments(c.Request.Context(), c.Param("id"))
		if err != nil {
			serverError(c, "could not load document metadata", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"documents": documents})
	}
}

func reviewVerification(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Decision string `json:"decision" binding:"required"`
			Reason   string `json:"reason"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "decision is required"})
			return
		}
		if err := s.ReviewVerification(c.Request.Context(), userID(c), c.Param("id"), req.Decision, req.Reason); errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "verification request not found"})
			return
		} else if errors.Is(err, ErrInvalidState) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported decision, or a reason of at least ten characters is missing"})
			return
		} else if errors.Is(err, ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": "this application has already been decided"})
			return
		} else if err != nil {
			serverError(c, "could not save review decision", err)
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func scheduleInterview(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Mode           string    `json:"mode" binding:"required"`
			ScheduledAt    time.Time `json:"scheduled_at" binding:"required"`
			LocationOrLink string    `json:"location_or_link"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "mode and scheduled_at are required"})
			return
		}
		if !req.ScheduledAt.After(time.Now()) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "scheduled_at must be in the future"})
			return
		}
		if err := s.CreateInterview(c.Request.Context(), userID(c), c.Param("id"), req.Mode, req.ScheduledAt.UTC().Format("2006-01-02 15:04:05.000000"), req.LocationOrLink); errors.Is(err, ErrInvalidState) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid interview mode"})
			return
		} else if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "verification request not found"})
			return
		} else if errors.Is(err, ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": "interviews can only be scheduled for applications awaiting review"})
			return
		} else if err != nil {
			serverError(c, "could not schedule interview", err)
			return
		}
		c.Status(http.StatusCreated)
	}
}

func markNotificationsRead(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			ID string `json:"id"`
		}
		_ = c.ShouldBindJSON(&req)
		if err := s.MarkNotificationsRead(c.Request.Context(), userID(c), req.ID); errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		} else if err != nil {
			serverError(c, "could not update notifications", err)
		} else {
			c.Status(http.StatusNoContent)
		}
	}
}

func applicationHistory(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		entries, err := s.ApplicationHistory(c.Request.Context(), c.Param("id"))
		if errors.Is(err, ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "verification request not found"})
			return
		}
		if err != nil {
			serverError(c, "could not load application history", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"history": entries})
	}
}

func adminStats(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		stats, err := s.Stats(c.Request.Context())
		if err != nil {
			serverError(c, "could not load statistics", err)
			return
		}
		c.JSON(http.StatusOK, stats)
	}
}

func adminUsers(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.Query("limit"))
		offset, _ := strconv.Atoi(c.Query("offset"))
		users, total, err := s.ListUsers(c.Request.Context(), UserFilter{Role: c.Query("role"), Status: c.Query("status"), Query: c.Query("q"), Limit: limit, Offset: offset})
		if err != nil {
			serverError(c, "could not load users", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"users": users, "total": total})
	}
}

func setSuspended(s *Service, suspend bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Reason string `json:"reason"`
		}
		_ = c.ShouldBindJSON(&req)
		err := s.SetSuspended(c.Request.Context(), userID(c), c.Param("id"), suspend, req.Reason)
		switch {
		case errors.Is(err, ErrNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		case errors.Is(err, ErrForbidden):
			c.JSON(http.StatusForbidden, gin.H{"error": "administrators cannot be suspended here"})
		case errors.Is(err, ErrInvalidState):
			c.JSON(http.StatusBadRequest, gin.H{"error": "a reason of at least ten characters is required"})
		case errors.Is(err, ErrConflict):
			c.JSON(http.StatusConflict, gin.H{"error": "the account is already in that state"})
		case err != nil:
			serverError(c, "could not update account", err)
		default:
			c.Status(http.StatusNoContent)
		}
	}
}

func auditLogs(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		limit, _ := strconv.Atoi(c.Query("limit"))
		offset, _ := strconv.Atoi(c.Query("offset"))
		entries, err := s.AuditLog(c.Request.Context(), c.Query("action"), limit, offset)
		if err != nil {
			serverError(c, "could not load audit log", err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"entries": entries})
	}
}

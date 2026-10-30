package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
)

var validate = validator.New()

type registerRequest struct {
	Name     string  `json:"name" validate:"required,min=2,max=120"`
	Email    string  `json:"email" validate:"required,email,max=255"`
	Password string  `json:"password" validate:"required,min=8,max=72"`
	Role     string  `json:"role" validate:"omitempty,oneof=tutor student parent coaching"`
	Phone    *string `json:"phone" validate:"omitempty,max=32"`
}
type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}
type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}
type resetRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

func RegisterRoutes(r *gin.RouterGroup, service *Service) {
	a := r.Group("/auth")
	a.POST("/register", register(service))
	a.POST("/login", login(service))
	a.POST("/refresh", refresh(service))
	a.POST("/logout", logout(service))
	a.GET("/me", requireAuth(service), me(service))
	a.POST("/forgot-password", forgotPassword(service))
	a.POST("/reset-password", resetPassword(service))
	a.POST("/verify-email/request", requestEmailVerification(service))
	a.POST("/verify-email", verifyEmail(service))
}

func register(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req registerRequest
		if !bind(c, &req) {
			return
		}
		if req.Role == "" {
			req.Role = "parent"
		}
		user, tokens, err := s.Register(c.Request.Context(), req.Name, req.Email, req.Password, req.Role, req.Phone)
		if errors.Is(err, ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{"error": "an account with this email already exists"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
			return
		}
		c.JSON(http.StatusCreated, gin.H{"user": publicUser(user), "tokens": tokens})
	}
}

func login(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if !bind(c, &req) {
			return
		}
		user, tokens, err := s.Login(c.Request.Context(), req.Email, req.Password)
		if errors.Is(err, ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sign in"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": publicUser(user), "tokens": tokens})
	}
}

func refresh(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req refreshRequest
		if !bind(c, &req) {
			return
		}
		user, tokens, err := s.Refresh(c.Request.Context(), req.RefreshToken)
		if errors.Is(err, ErrInvalidToken) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not refresh session"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": publicUser(user), "tokens": tokens})
	}
}

func logout(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req refreshRequest
		if !bind(c, &req) {
			return
		}
		if err := s.RevokeRefresh(c.Request.Context(), req.RefreshToken); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not end session"})
			return
		}
		c.Status(http.StatusNoContent)
	}
}

func RequireAuth(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "authorization required"})
			return
		}

		id, err := s.ParseAccessToken(strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired access token"})
			return
		}
		c.Set("user_id", id)
		c.Next()
	}
}

func requireAuth(s *Service) gin.HandlerFunc { return RequireAuth(s) }

func me(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := s.User(c.Request.Context(), c.GetString("user_id"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"user": publicUser(user)})
	}
}

func forgotPassword(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" validate:"required,email"`
		}
		if !bind(c, &req) {
			return
		}
		token, err := s.CreatePasswordResetToken(c.Request.Context(), req.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not start password reset"})
			return
		}
		response := gin.H{"message": "If an account exists for this email, password reset instructions will be sent."}
		if token != "" && s.cfg.Environment != "production" {
			response["development_token"] = token
		}
		c.JSON(http.StatusAccepted, response)
	}
}

func resetPassword(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req resetRequest
		if !bind(c, &req) {
			return
		}
		if err := s.ResetPassword(c.Request.Context(), req.Token, req.NewPassword); errors.Is(err, ErrInvalidToken) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset token"})
			return
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not reset password"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "password reset successfully"})
	}
}

func requestEmailVerification(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Email string `json:"email" validate:"required,email"`
		}
		if !bind(c, &req) {
			return
		}
		token, err := s.CreateEmailVerificationToken(c.Request.Context(), req.Email)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not start email verification"})
			return
		}
		response := gin.H{"message": "If an account exists for this email, a verification link will be sent."}
		if token != "" && s.cfg.Environment != "production" {
			response["development_token"] = token
		}
		c.JSON(http.StatusAccepted, response)
	}
}

func verifyEmail(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			Token string `json:"token" validate:"required"`
		}
		if !bind(c, &req) {
			return
		}
		if err := s.VerifyEmail(c.Request.Context(), req.Token); errors.Is(err, ErrInvalidToken) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired verification token"})
			return
		} else if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not verify email"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "email verified successfully"})
	}
}

func bind(c *gin.Context, target interface{}) bool {
	if err := c.ShouldBindJSON(target); err != nil || validate.Struct(target) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return false
	}
	return true
}

func publicUser(user User) gin.H {
	return gin.H{"id": user.ID, "name": user.Name, "email": user.Email, "phone": user.Phone, "role": user.Role, "email_verified_at": user.EmailVerifiedAt, "created_at": user.CreatedAt}
}

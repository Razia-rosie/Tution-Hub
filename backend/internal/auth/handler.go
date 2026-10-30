package auth

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"

	"github.com/tuitionhub/backend/internal/ratelimit"
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
type resetRequest struct {
	Token       string `json:"token" validate:"required"`
	NewPassword string `json:"new_password" validate:"required,min=8,max=72"`
}

type limiters struct {
	loginAccount *ratelimit.Limiter
	loginIP      *ratelimit.Limiter
	signupIP     *ratelimit.Limiter
}

func RegisterRoutes(r *gin.RouterGroup, service *Service) {
	l := limiters{
		loginAccount: ratelimit.New(service.cfg.LoginLimitPerAccount, 15*time.Minute),
		loginIP:      ratelimit.New(service.cfg.LoginLimitPerIP, 15*time.Minute),
		signupIP:     ratelimit.New(service.cfg.SignupLimitPerIP, time.Hour),
	}
	a := r.Group("/auth")
	a.POST("/register", limitByIP(l.signupIP), register(service))
	a.POST("/login", login(service, l))
	a.POST("/refresh", refresh(service))
	a.POST("/logout", logout(service))
	a.GET("/me", requireAuth(service), me(service))
	a.POST("/forgot-password", limitByIP(l.signupIP), forgotPassword(service))
	a.POST("/reset-password", limitByIP(l.signupIP), resetPassword(service))
	a.POST("/verify-email/request", limitByIP(l.signupIP), requestEmailVerification(service))
	a.POST("/verify-email", limitByIP(l.signupIP), verifyEmail(service))
}

func tooManyRequests(c *gin.Context, wait time.Duration) {
	c.Header("Retry-After", strconv.Itoa(int(wait.Seconds())+1))
	c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "too many attempts; please wait and try again"})
}

// limitByIP counts every request (successful or not) from one client address.
func limitByIP(l *ratelimit.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()
		if ok, wait := l.Allow(key); !ok {
			tooManyRequests(c, wait)
			return
		}
		l.Hit(key)
		c.Next()
	}
}

// Browser sessions keep the refresh token in an httpOnly cookie so scripts can
// never read it. A client opts in with the X-Session-Mode: cookie header; other
// clients (API tools, tests) keep receiving the token in the JSON body.
const (
	refreshCookie     = "th_refresh"
	sessionModeHeader = "X-Session-Mode"
)

func cookieMode(c *gin.Context) bool { return c.GetHeader(sessionModeHeader) == "cookie" }

// issue writes the token response, moving the refresh token into the cookie in cookie mode.
func issue(c *gin.Context, s *Service, status int, user User, tokens Tokens) {
	if cookieMode(c) {
		c.SetSameSite(http.SameSiteStrictMode)
		c.SetCookie(refreshCookie, tokens.RefreshToken, int(s.cfg.RefreshTokenTTL.Seconds()), "/api/v1/auth", "", s.cfg.SecureCookie, true)
		tokens.RefreshToken = ""
	}
	c.JSON(status, gin.H{"user": publicUser(user), "tokens": tokens})
}

func clearRefreshCookie(c *gin.Context, s *Service) {
	c.SetSameSite(http.SameSiteStrictMode)
	c.SetCookie(refreshCookie, "", -1, "/api/v1/auth", "", s.cfg.SecureCookie, true)
}

// refreshToken reads the token from the body, or from the cookie in cookie mode.
// The custom header requirement doubles as CSRF protection: a cross-site page
// cannot send it without a CORS preflight, which this API never approves.
func refreshToken(c *gin.Context) (string, bool) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	_ = c.ShouldBindJSON(&req)
	if req.RefreshToken != "" {
		return req.RefreshToken, true
	}
	if cookieMode(c) {
		if v, err := c.Cookie(refreshCookie); err == nil && v != "" {
			return v, true
		}
	}
	return "", false
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
		if errors.Is(err, ErrRegistrationClosed) {
			c.JSON(http.StatusForbidden, gin.H{"error": "new registrations are temporarily closed"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create account"})
			return
		}
		issue(c, s, http.StatusCreated, user, tokens)
	}
}

// login limits failed attempts per account+address (password guessing against
// one user) and per address (spraying many accounts). Only failures count, and
// a success clears the account counter.
func login(s *Service, l limiters) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req loginRequest
		if !bind(c, &req) {
			return
		}
		ip := c.ClientIP()
		accountKey := strings.ToLower(strings.TrimSpace(req.Email)) + "|" + ip
		if ok, wait := l.loginAccount.Allow(accountKey); !ok {
			tooManyRequests(c, wait)
			return
		}
		if ok, wait := l.loginIP.Allow(ip); !ok {
			tooManyRequests(c, wait)
			return
		}
		user, tokens, err := s.Login(c.Request.Context(), req.Email, req.Password)
		if errors.Is(err, ErrInvalidCredentials) {
			l.loginAccount.Hit(accountKey)
			l.loginIP.Hit(ip)
			s.RecordLoginFailure(c.Request.Context(), req.Email, ip)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid email or password"})
			return
		}
		if errors.Is(err, ErrSuspended) {
			c.JSON(http.StatusForbidden, gin.H{"error": "this account is suspended; contact support"})
			return
		}
		l.loginAccount.Reset(accountKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not sign in"})
			return
		}
		issue(c, s, http.StatusOK, user, tokens)
	}
}

func refresh(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := refreshToken(c)
		if !ok {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "no session"})
			return
		}
		user, tokens, err := s.Refresh(c.Request.Context(), token)
		if errors.Is(err, ErrSuspended) {
			c.JSON(http.StatusForbidden, gin.H{"error": "this account is suspended; contact support"})
			return
		}
		if errors.Is(err, ErrInvalidToken) {
			if cookieMode(c) {
				clearRefreshCookie(c, s)
			}
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired refresh token"})
			return
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not refresh session"})
			return
		}
		issue(c, s, http.StatusOK, user, tokens)
	}
}

func logout(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := refreshToken(c)
		if cookieMode(c) {
			clearRefreshCookie(c, s)
		}
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
			return
		}
		if err := s.RevokeRefresh(c.Request.Context(), token); err != nil {
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
		// Access tokens are stateless, so a deleted or suspended account would otherwise
		// keep working until the token expires. One indexed lookup closes that gap.
		role, status, err := s.AccountState(c.Request.Context(), id)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired access token"})
			return
		}
		if status == "suspended" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "this account is suspended; contact support"})
			return
		}
		c.Set("role", role)
		c.Set("account_status", status)
		c.Set("user_id", id)
		c.Next()
	}
}

func requireAuth(s *Service) gin.HandlerFunc { return RequireAuth(s) }

// OptionalAuth identifies the caller when a valid token is sent and lets the
// request through anonymously otherwise (for public pages that personalise).
func OptionalAuth(s *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(header, "Bearer ") {
			if id, err := s.ParseAccessToken(strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))); err == nil {
				if role, status, err := s.AccountState(c.Request.Context(), id); err == nil && status != "suspended" {
					c.Set("user_id", id)
					c.Set("role", role)
					c.Set("account_status", status)
				}
			}
		}
		c.Next()
	}
}

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
	return gin.H{"id": user.ID, "name": user.Name, "email": user.Email, "phone": user.Phone, "role": user.Role, "account_status": user.AccountStatus, "email_verified_at": user.EmailVerifiedAt, "created_at": user.CreatedAt}
}

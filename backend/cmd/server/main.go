package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"

	"github.com/tuitionhub/backend/internal/auth"
	"github.com/tuitionhub/backend/internal/config"
	"github.com/tuitionhub/backend/internal/database"
	"github.com/tuitionhub/backend/internal/platform"
	"github.com/tuitionhub/backend/internal/workflow"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}

	db, err := sqlx.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		slog.Error("open database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	database.ConfigurePool(db, cfg.DBMaxOpenConns, cfg.DBMaxIdleConns, cfg.DBConnMaxLifetime)
	if err := database.WaitForConnection(db, 30*time.Second); err != nil {
		slog.Error("database unavailable", "error", err)
		os.Exit(1)
	}

	authService := auth.NewService(db, cfg)
	workflowService := workflow.NewService(db, cfg.DocumentDir)
	router := newRouter(authService, cfg)
	workflow.RegisterRoutes(router.Group("/api/v1"), authService, workflowService)
	platform.RegisterRoutes(router.Group("/api/v1"), authService, platform.NewService(db, cfg.DocumentDir))
	server := &http.Server{Addr: cfg.HTTPAddr, Handler: router, ReadHeaderTimeout: 10 * time.Second}

	go func() {
		slog.Info("api listening", "address", cfg.HTTPAddr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("server stopped", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = server.Shutdown(ctx)
}

func newRouter(service *auth.Service, cfg config.Config) *gin.Engine {
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	// Without this gin trusts X-Forwarded-For from any peer, letting clients spoof
	// their address and dodge the per-IP rate limits.
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		slog.Error("invalid TRUSTED_PROXIES", "error", err)
		os.Exit(1)
	}
	r.Use(gin.Logger(), gin.Recovery())
	r.GET("/health", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "ok"}) })

	api := r.Group("/api/v1")
	auth.RegisterRoutes(api, service)
	return r
}

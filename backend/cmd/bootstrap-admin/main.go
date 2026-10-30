package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"

	"github.com/tuitionhub/backend/internal/auth"
	"github.com/tuitionhub/backend/internal/config"
	"github.com/tuitionhub/backend/internal/database"
)

func main() {
	name := flag.String("name", "", "initial administrator display name")
	email := flag.String("email", "", "initial administrator email address")
	flag.Parse()

	password := os.Getenv("ADMIN_BOOTSTRAP_PASSWORD")
	if password == "" {
		log.Fatal("ADMIN_BOOTSTRAP_PASSWORD is required")
	}
	if *name == "" || *email == "" {
		log.Fatal("-name and -email are required")
	}

	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}
	db, err := sqlx.Open("mysql", cfg.DatabaseURL)
	if err != nil {
		log.Fatal("open database: ", err)
	}
	defer db.Close()
	if err := database.WaitForConnection(db, 30*time.Second); err != nil {
		log.Fatal("database unavailable: ", err)
	}

	ctx := context.Background()
	user, err := auth.NewService(db, cfg).BootstrapAdmin(ctx, *name, *email, password)
	if errors.Is(err, auth.ErrAdminExists) {
		log.Fatal("bootstrap refused: an administrator already exists; no password was changed")
	}
	if errors.Is(err, auth.ErrConflict) {
		log.Fatal("bootstrap refused: an account with that email already exists")
	}
	if errors.Is(err, auth.ErrInvalidInput) {
		log.Fatal("bootstrap refused: invalid name, email, or password")
	}
	if err != nil {
		log.Fatal("bootstrap failed: ", err)
	}
	fmt.Printf("administrator created: %s (%s)\n", user.Name, user.Email)
}

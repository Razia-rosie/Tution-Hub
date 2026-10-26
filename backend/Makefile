SHELL := /bin/sh

.PHONY: dev build test fmt db-up db-down up down logs

# Docker Desktop on macOS may install Compose as an app-bundled CLI plugin
# without registering it with the standalone Docker CLI.
COMPOSE := $(shell if command -v docker-compose >/dev/null 2>&1; then echo docker-compose; elif docker compose version >/dev/null 2>&1; then echo docker compose; elif [ -x /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose ]; then echo /Applications/Docker.app/Contents/Resources/cli-plugins/docker-compose; else echo docker compose; fi)

dev:
	APP_ENV=development HTTP_ADDR=:8080 DATABASE_URL='tuitionhub:tuitionhub@tcp(127.0.0.1:3306)/tuitionhub?parseTime=true&charset=utf8mb4&loc=UTC' JWT_SECRET='replace-this-with-a-long-random-secret-at-least-32-characters' ACCESS_TOKEN_TTL=15m REFRESH_TOKEN_TTL=720h COOKIE_SECURE=false go run github.com/air-verse/air@v1.61.7 -c .air.toml

build:
	go build ./...

test:
	go test ./...

fmt:
	gofmt -w $$(find . -name '*.go' -not -path './vendor/*')

db-up:
	$(COMPOSE) up -d mysql phpmyadmin

db-down:
	$(COMPOSE) down

up:
	$(COMPOSE) up -d mysql phpmyadmin

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f api

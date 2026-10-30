SHELL := /bin/sh

.PHONY: backend-dev backend-build backend-test frontend-dev db-up db-down up down status

RUNTIME_DIR := .runtime
API_PID_FILE := $(RUNTIME_DIR)/api.pid
FRONTEND_PID_FILE := $(RUNTIME_DIR)/frontend.pid
API_LOG := $(RUNTIME_DIR)/api.log
FRONTEND_LOG := $(RUNTIME_DIR)/frontend.log

backend-dev:
	$(MAKE) -C backend dev

backend-build:
	$(MAKE) -C backend build

backend-test:
	$(MAKE) -C backend test

frontend-dev:
	pnpm dev --host 0.0.0.0 --port 5173

db-up:
	$(MAKE) -C backend db-up

db-down:
	$(MAKE) -C backend db-down

up:
	@mkdir -p "$(RUNTIME_DIR)"
	@$(MAKE) -C backend db-up
	@if test -f "$(API_PID_FILE)" && kill -0 "$$(cat "$(API_PID_FILE)")" 2>/dev/null; then \
		echo "API is already running (pid $$(cat "$(API_PID_FILE)"))"; \
	else \
		nohup sh -c 'exec $(MAKE) backend-dev' >"$(API_LOG)" 2>&1 & echo $$! >"$(API_PID_FILE)"; \
	fi
	@if test -f "$(FRONTEND_PID_FILE)" && kill -0 "$$(cat "$(FRONTEND_PID_FILE)")" 2>/dev/null; then \
		echo "Frontend is already running (pid $$(cat "$(FRONTEND_PID_FILE)"))"; \
	else \
		nohup sh -c 'exec $(MAKE) frontend-dev' >"$(FRONTEND_LOG)" 2>&1 & echo $$! >"$(FRONTEND_PID_FILE)"; \
	fi
	@ready=0; \
	for attempt in 1 2 3 4 5 6 7 8 9 10; do \
		if test -f "$(API_PID_FILE)" && kill -0 "$$(cat "$(API_PID_FILE)")" 2>/dev/null && \
			test -f "$(FRONTEND_PID_FILE)" && kill -0 "$$(cat "$(FRONTEND_PID_FILE)")" 2>/dev/null && \
			curl -fsS http://localhost:5173/ >/dev/null 2>&1 && curl -fsS http://localhost:8080/health >/dev/null 2>&1; then ready=1; break; fi; \
		sleep 1; \
	done; \
	if test "$$ready" -ne 1; then \
		echo "Services did not become ready. Check $(FRONTEND_LOG) and $(API_LOG)."; \
		exit 1; \
	fi
	@echo "Tuition Hub is up:"
	@echo "  Frontend: http://localhost:5173"
	@echo "  API:      http://localhost:8080"
	@echo "  Logs:     $(FRONTEND_LOG), $(API_LOG)"

# The recorded pid is a make process; the API (air and its server binary) and
# Vite run as its descendants, so the whole process tree is stopped.
down:
	@killtree() { for child in $$(pgrep -P "$$1"); do killtree "$$child"; done; kill "$$1" 2>/dev/null || true; }; \
	for pid_file in "$(API_PID_FILE)" "$(FRONTEND_PID_FILE)"; do \
		if test -f "$$pid_file"; then \
			pid=$$(cat "$$pid_file"); \
			if kill -0 "$$pid" 2>/dev/null; then killtree "$$pid"; fi; \
			rm -f "$$pid_file"; \
		fi; \
	done
	@$(MAKE) -C backend db-down
	@echo "Tuition Hub is down."

status:
	@printf "API:      "; if test -f "$(API_PID_FILE)" && kill -0 "$$(cat "$(API_PID_FILE)")" 2>/dev/null; then echo "running (pid $$(cat "$(API_PID_FILE)"))"; else echo "stopped"; fi
	@printf "Frontend: "; if test -f "$(FRONTEND_PID_FILE)" && kill -0 "$$(cat "$(FRONTEND_PID_FILE)")" 2>/dev/null; then echo "running (pid $$(cat "$(FRONTEND_PID_FILE)"))"; else echo "stopped"; fi

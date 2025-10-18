.DEFAULT_GOAL := help

.PHONY: run-dev run-prod dev prod db-reset db-upgrade test alembic-up alembic-downgrade oas-lint ds-diff ds-apply help ds-watch

.PHONY: help

# 自動help: 「ターゲット: ## 説明」を一覧表示
help: ## Show available targets
	@awk -F':|##' '/^[a-zA-Z0-9_.-]+:.*##/ {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$3}' $(MAKEFILE_LIST)

# PostgreSQL DSN helpers (override as needed)
PG_DB ?= app_db
PG_USER ?= postgres
PG_PASSWORD ?= password
PG_HOST ?= localhost
PG_PORT ?= 5432
DATABASE_URL ?= postgresql+asyncpg://$(PG_USER):$(PG_PASSWORD)@$(PG_HOST):$(PG_PORT)/$(PG_DB)

run-dev: ## Run API server in development mode
	uvicorn app.main:app --reload --env-file .env

run-prod: ## Run API server in production mode
	ENV=production uvicorn app.main:app

dev: run-dev ## Alias for run-dev

prod: run-prod ## Alias for run-prod

db-reset: ## Drop and recreate the development database
	dropdb --if-exists $(PG_DB)
	createdb $(PG_DB)

db-upgrade: ## Apply latest database migrations
	DATABASE_URL=$(DATABASE_URL) alembic upgrade head

alembic-up: db-upgrade ## Alias for db-upgrade

alembic-downgrade: ## Roll back one migration
	alembic downgrade -1

test: ## Run pytest suite
	PYTHONPATH=$(PWD) DATABASE_URL=$(DATABASE_URL) pytest -q app/tests tests test_*.py

oas-lint: ## Validate OpenAPI (backend/app/openapi.yaml)
	python3 -c "from openapi_spec_validator import validate_spec as v; import yaml; d=yaml.safe_load(open('backend/app/openapi.yaml','r',encoding='utf-8')); v(d); print('OpenAPI: OK')"

ds-diff: ## Show DocSync drift status and plan
	python3 scripts/docsync_diff.py || true
	cat doc_sync_plan.json || true

ds-apply: ## Run docsync-apply workflow (BR=<branch>)
	@test -n '$(BR)' || { echo 'Usage: make ds-apply BR=<branch>'; exit 1; }
	gh workflow run docsync-apply.yml --ref $(BR)

.PHONY: ds-watch
ds-watch: ## Show latest docsync-apply run log (BR=<branch>)
	@test -n '$(BR)' || { echo 'Usage: make ds-watch BR=<branch>'; exit 1; }
	@RUN_ID=$$(gh run list --workflow "docsync-apply" --branch "$(BR)" --limit 1 \
	  --json databaseId -q '.[0].databaseId'); \
	  echo "Run: $$RUN_ID"; gh run view "$$RUN_ID" --log

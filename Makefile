.PHONY: run-dev run-prod dev prod db-reset db-upgrade test alembic-up alembic-downgrade oas-lint ds-diff ds-apply

# PostgreSQL DSN helpers (override as needed)
PG_DB ?= app_db
PG_USER ?= postgres
PG_PASSWORD ?= password
PG_HOST ?= localhost
PG_PORT ?= 5432
DATABASE_URL ?= postgresql+asyncpg://$(PG_USER):$(PG_PASSWORD)@$(PG_HOST):$(PG_PORT)/$(PG_DB)

run-dev:
	uvicorn app.main:app --reload --env-file .env

run-prod:
	ENV=production uvicorn app.main:app

dev: run-dev

prod: run-prod

db-reset:
	dropdb --if-exists $(PG_DB)
	createdb $(PG_DB)

db-upgrade:
	DATABASE_URL=$(DATABASE_URL) alembic upgrade head

alembic-up: db-upgrade

alembic-downgrade:
	alembic downgrade -1

test:
	PYTHONPATH=$(PWD) DATABASE_URL=$(DATABASE_URL) pytest -q app/tests tests test_*.py

oas-lint:
	python3 -c "from openapi_spec_validator import validate_spec as v; import yaml; d=yaml.safe_load(open('backend/app/openapi.yaml','r',encoding='utf-8')); v(d); print('OpenAPI: OK')"

ds-diff:
	python3 scripts/docsync_diff.py || true
	cat doc_sync_plan.json || true

ds-apply:
	@test -n '$(BR)' || { echo 'Usage: make ds-apply BR=<branch>'; exit 1; }
	gh workflow run docsync-apply.yml --ref $(BR)

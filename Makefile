.PHONY: run-dev run-prod dev prod db-reset db-upgrade test alembic-up alembic-downgrade

# PostgreSQL DSN helpers (override as needed)
PG_DB ?= app_dev
PG_USER ?= app
PG_PASSWORD ?= app
PG_HOST ?= 127.0.0.1
PG_PORT ?= 5432
DATABASE_URL ?= postgresql+asyncpg://$(PG_USER):$(PG_PASSWORD)@$(PG_HOST):$(PG_PORT)/$(PG_DB)

run-dev:
	uvicorn app.main:app --reload --env-file .env

run-prod:
	ENV=production uvicorn app.main:app

dev: run-dev

prod: run-prod

db-reset:
	dropdb -U postgres --if-exists $(PG_DB)
	createdb -U postgres -O $(PG_USER) $(PG_DB)
	psql -U postgres -d $(PG_DB) -c "ALTER SCHEMA public OWNER TO $(PG_USER); GRANT ALL ON SCHEMA public TO $(PG_USER);"

db-upgrade:
	DATABASE_URL=$(DATABASE_URL) alembic upgrade head

alembic-up: db-upgrade

alembic-downgrade:
	alembic downgrade -1

test:
	PYTHONPATH=$(PWD) DATABASE_URL=$(DATABASE_URL) pytest -q app/tests tests test_*.py

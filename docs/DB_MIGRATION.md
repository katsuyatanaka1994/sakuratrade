# Database Migration Guide

このドキュメントは gptset のスキーマ管理フローを整理したものです。PostgreSQL を前提とし、Alembic + pydantic-settings による単一 head の履歴を維持します。

## サポート対象

- データベース: **PostgreSQL 16**（SQLite は対象外）
- DSN: `postgresql+asyncpg://user:password@host:port/dbname`
  - ユーザー名にスペースが含まれる場合は URL エンコードしてください（例: `katsuya%20tanaka`）。
- 設定: `.env` は `ENV=development` のときのみ読み込みます。本番は環境変数 / Secret を利用してください。

## 主要コマンド

```bash
make db-reset          # dropdb --if-exists && createdb app_db
make db-upgrade        # alembic upgrade head
make test              # pytest -q app/tests tests test_*.py
make run-dev           # uvicorn app.main:app --reload --env-file .env
```

### Alembic を直接実行したい場合

```bash
alembic upgrade head
alembic -x dburl=postgresql://user:pass@host/db upgrade head
alembic downgrade -1
```

`-x dburl=...` 引数を指定すると、Settings 経由の DSN を上書きして任意の接続先に適用できます。非同期接続（`postgresql+asyncpg://`）が見つからない場合、Alembic の env 設定が同期 DSN を asyncpg へ自動変換します。

## UUID 移行のポイント

- 旧 `user_id` / `trade_id`（BIGINT）は段階的に UUID 主体へ移行し、最終的には `users.user_id` / `trades.trade_uuid` を主キー・参照源に利用します。
- `MIGRATION_BATCH_SIZE`（既定 1000）と `MIGRATION_LOCK_TIMEOUT`（既定 `5s`）で長時間ロックを避けながらチャンク更新します。
- `CREATE EXTENSION IF NOT EXISTS pgcrypto` を優先し、`gen_random_uuid()` を利用します。権限上作成できない場合は `uuid-ossp` の `uuid_generate_v4()` へフォールバック。それも不可の場合はマイグレーション内で `uuid_in(md5(random()::text || clock_timestamp()::text)::cstring)` を使用します。
- `users` テーブルには `sync_users_uuid` トリガーを設置し、`user_id` と `user_uuid` の値を常に同期します（片方のみ指定された場合でも整合性を保ちます）。

## ロールと権限

- 本番環境では DB 所有者 = 管理ロールを推奨。アプリケーションロールには `USAGE` / `CREATE` と必要な `GRANT` を付与し、所有者移転は行いません。
- 開発環境では利便性を優先し、接続ユーザーが所有者でも構いません。

## 検証フロー（受入基準）

```bash
make db-reset
make db-upgrade
make run-dev &   # uvicorn app.main:app --reload --env-file .env
curl -fsS http://127.0.0.1:8000/healthz
make test
alembic heads
alembic current
```

- `alembic heads` が単一 head を指し、`alembic current` が head と一致すること。
- `/healthz` で 200 が返ること（DB 停止時は 503 になること）。
- `pytest` が安定してグリーンであること。

## ログと機密値

- ログには機密情報（パスワード / Secret）を出力しないでください。
- 設定ソース（`.env` か環境変数か）の種別のみログに出力するようにします。

---

このドキュメントは UUID 中心のスキーマへ移行する際のリファレンスとして継続的に更新してください。

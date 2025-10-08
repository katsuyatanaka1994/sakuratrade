# 📘 gptset

## 🏷️ プロジェクト概要

本プロジェクトは、株式トレード分析SaaS「gptset」のバックエンドAPIを開発するものです。ユーザーのトレード記録、チャート画像アップロード、パターン検出など、トレード分析の支援機能を段階的に提供していきます。

> 本READMEでは、PBI No.3「チャート画像アップロード処理」の実装内容を記述しています。

---

## 📁 ディレクトリ構成（抜粋）

```
app/
├── main.py                  # FastAPIエントリーポイント
├── routers/
│   ├── __init__.py
│   ├── images.py           # 画像アップロードAPIルーター
│   └── static/
│       └── uploaded_images/ # 画像保存先（ローカル）
```

---

## 🛠 初期セットアップ

1. 環境変数ファイルをコピー
   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env
   ```

2. 仮想環境を作成してアクティベート
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. 依存関係をインストール
   ```bash
   pip install -r requirements.txt
   ```

4. PostgreSQL を起動（SQLite はサポートしていません）
   ```bash
   # Docker 例
   docker run --rm --name gptset-pg \
     -e POSTGRES_USER=app_user -e POSTGRES_PASSWORD=app_pass -e POSTGRES_DB=app_db \
     -p 5432:5432 -d postgres:16
   ```
   > Homebrew の場合は `brew services start postgresql@16` 後に `createdb app_db` を実行してください。

## 🚀 開発サーバーの起動

```bash
make run-dev
```

> `.env` は開発専用です。`ENV=production` の場合は読み込まれません。

---

## Backend 開発ルール

サーバサイドの Python コードを変更した場合は、必ず backend コンテナを再起動してください。

```bash
docker compose restart backend
```

- 対象コード例:
  - app/routers/*
  - app/models.py
  - app/database.py
  - app/main.py
- 理由: backend コンテナは --reload オプションを付けずに実行しているため、コード変更が自動反映されません。再起動を忘れると古いコードが動き続け、デバッグが混乱します。

## 📦 インポートルール

- プロジェクト内の参照は `from app.<module> import ...` 形式に統一しています。
- モジュールを直接実行する際は `python -m app.<module_path>` を利用するとパス設定が不要です。
- CI では `ruff` と `scripts/check_import_paths.py` が同ルールを検証します。

---

## ⚙️ 設定と環境変数

- `.env.example` を `.env` にコピーしてローカル環境を構成します。
- `ENV` は `development` のときのみ `.env` を読み込みます。`production` ではインフラ側の環境変数／Secret を使ってください。
- 主なキー: `DATABASE_URL`（`postgresql+asyncpg://` 形式）、`LOG_LEVEL`、`OPENAI_API_KEY`、`DB_POOL_*` (接続プール調整)。
- `Makefile` の `run-dev` ターゲットは `uvicorn app.main:app --reload --env-file .env` を実行します。`run-prod` ターゲットは `ENV=production` を付与した起動例です。

---

## 🗃️ データベースマイグレーション

- サポート DB は PostgreSQL のみです。`DATABASE_URL` も `postgresql+asyncpg://` 形式に統一しています。
- `.env.example` の DSN でユーザー名にスペースがある場合は URL エンコードを利用してください（例: `katsuya%20tanaka`）。
- スキーマ適用は `make db-upgrade`（内部で `alembic upgrade head`）で行います。`create_all()` は使用しません。
- 新しいモデル変更は `alembic revision --autogenerate -m "describe change"` でマイグレーションファイルを生成します。
- 別 DSN へ直接適用したい場合は `alembic -x dburl=postgresql://user:pass@host/db upgrade head` を使用します。
- マイグレーション実行時はアプリと同じ環境変数を利用し、`ENV=production` の場合でも `.env` は読まれません。

### CI / ローカル検証のランブック

```bash
make db-reset          # dropdb --if-exists && createdb
make db-upgrade        # alembic upgrade head
make test              # pytest -q app/tests tests test_*.py
make run-dev           # uvicorn app.main:app --reload --env-file .env
```

---

## 🩺 ヘルスチェック

- `GET /healthz` は起動時とリクエスト時に `SELECT 1` でDB疎通を確認します。
- DB が停止している場合は HTTP 503 を返し、旧 `/health` も後方互換のため同じレスポンスを返します。

---

## 📤 POST /upload-image/

PNG / JPEG 画像をアップロードし、保存先のファイルパスを返します。

- リクエスト形式：
  Content-Type: multipart/form-data

- フィールド名：
  - file: (ファイル本体)

- レスポンス（例）：
  {
    "filename": "abcd1234.png",
    "path": "/static/uploaded_images/abcd1234.png"
  }

- 制約：
  - 5MB以下
  - PNG / JPEGのみ

---

## 🌐 アップロード画像の確認

保存された画像は以下の形式で確認できます：

http://localhost:8000/static/uploaded_images/{filename}

---

## 🛠 今後の予定（P1対応）

- ✅ S3に保存先を変更（/staticではなくAWS S3へ）
- ✅ 保存URLはS3パスに変更
- ✅ フロント側の表示パス処理も合わせて修正

---

## ⚠️ 注意事項

- ローカル開発環境で保存された画像は、環境再構築時に削除される可能性があります
- デプロイ時は永続ストレージ or S3などに切り替えることが前提です

---

## 🧪 テスト観点（P0）

- [x] 5MB以下のPNG/JPEG画像をアップロードできる
- [x] レスポンスにファイル名と保存パスが含まれる
- [x] /static 経由で画像のプレビューが確認できる
- [x] app/routers/static/uploaded_images に保存されている

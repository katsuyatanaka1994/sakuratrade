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

## 🚀 開発サーバーの起動

```bash
uvicorn app.main:app --reload
```

## 📦 インポートルール

- プロジェクト内の参照は `from app.<module> import ...` 形式に統一しています。
- モジュールを直接実行する際は `python -m app.<module_path>` を利用するとパス設定が不要です。
- CI では `ruff` と `scripts/check_import_paths.py` が同ルールを検証します。

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

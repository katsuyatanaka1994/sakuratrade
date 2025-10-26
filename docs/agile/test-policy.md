# テスト運用ポリシー

- 作成者（Codex）:
- レビュアー（人間）:
- 最終更新日:

## Integrationを回す基準
- API/DB/認証/外部APIの変更を含むPR
- CI構成やワークフロー（.github/workflows）を変更するPR
- リリース前確認時（release/* ブランチ、タグ付け前）
- 想定外の失敗を再現・調査したい場合

## ローカル実行の例
```bash
export PYTHONPATH=backend
export MOCK_AI=true
# Unit
pytest -q -m "not integration"
# Integration（サーバ起動→実行→停止）
uvicorn app.main:app --host 127.0.0.1 --port 8000 &
pytest -q -m integration
kill %1
```

## 注意事項
- OPENAI への実アクセスは不要。`MOCK_AI=true` でダミー応答を利用する。
- `BASE_URL` を変更した場合は `pytest` 実行前に `export BASE_URL=...` を設定する。
- 実際の FastAPI サーバーへ HTTP リクエストを送るテストは `RUN_LIVE_API_TESTS=1` を設定した時のみ実行される。CI では未設定のため自動で skip される。
- CI 実行は GitHub Actions → Backend CI → Run workflow（workflow_dispatch）から任意で起動できる。

## 実サーバー統合テストの実施タイミングと手順

- いつ走らせるか
  - API/DB/外部 API の振る舞いが変わる PR をマージする前
  - release/* ブランチや本番リリース前の最終確認
  - 実サーバーでしか再現しない不具合を調査したいとき
- 手順
  1. `uvicorn app.main:app --host 127.0.0.1 --port 8000`（または docker-compose）で FastAPI サーバーを起動
  2. `export RUN_LIVE_API_TESTS=1`（必要なら `BASE_URL` も上書き）
  3. `pytest -m integration` もしくは `make test` を実行
  4. 実行後はサーバーを停止

CI で同テストを走らせたい場合は、workflow_dispatch で `RUN_LIVE_API_TESTS=1` を渡し、ジョブ内でサーバーを起動する手順を明記する。

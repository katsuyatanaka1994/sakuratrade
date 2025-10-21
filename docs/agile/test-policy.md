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
- CI 実行は GitHub Actions → Backend CI → Run workflow（workflow_dispatch）から任意で起動できる。

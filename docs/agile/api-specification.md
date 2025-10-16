# API仕様書

> HTTP契約の正典。UI仕様書からは本ファイル（および `docs/specs/openapi.yaml`）を参照し、リクエスト/レスポンスの真実はここで管理する。

- 作成者（Codex）:
- レビュアー（人間）:
- 最終更新日:
- スプリント / Issue:

## 概要
- 機能名（Feature）:
- 画面名（Screen）:
- 目的 / ユーザーストーリー（1行）:
- 関連Figma（Frameリンク）:

## API情報
- Method:
- Endpoint (Path):
- OpenAPIタグ:
- 認証 / 権限スコープ:
- 必要ヘッダー (例: `Authorization`, `Idempotency-Key`):
- Rate Limit / タイムアウト:
- OpenAPI参照: `docs/specs/openapi.yaml` / Swagger URL:

## リクエスト仕様
- フロントが送る必須データ:
  - `field`: 型 / 必須 or 任意 / 説明
- クエリパラメータ:
- リクエストボディ:

```json
{
  "price": 7890,
  "side": "long",
  "note": "寄付きでIN",
  "timestamp": "2025-07-01T09:02:00+09:00"
}
```

## レスポンス仕様
- 成功ステータスコード:
- 成功レスポンス（例）:

```json
{
  "id": "abc123",
  "created_at": "2025-07-01T09:02:01+09:00",
  "status": "ok",
  "data": {
    "price": 7890,
    "side": "long"
  }
}
```

## エラー
| HTTPコード | エラーコード | message | UI挙動 / 文言 |
| --- | --- | --- | --- |
| 400 | VALIDATION | "価格を入力してください" | フィールド下にエラー表示 |
| 401 | UNAUTHORIZED | "認証に失敗しました" | ログイン画面へ遷移 |
| 500 | SERVER_ERROR | "サーバーエラーが発生しました" | モーダルで再試行案内 |

## UI挙動
- 成功時:
- 主要エラー時:

## 受け入れ基準（Acceptance）
- [ ] valid request → 201/200 が返り UI/一覧に反映される
- [ ] price 未入力 → 400 とエラーメッセージが表示される
- [ ] 認証なし → 401 を返す

## 備考
- 非同期ジョブ / job_id:
- 冪等性 / 再送制御:
- 依存サービス / 外部API:

## 変更履歴
- YYYY-MM-DD: 初版 (PR #)
- YYYY-MM-DD:

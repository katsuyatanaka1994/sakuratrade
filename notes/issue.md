# 開発全般 issue ログ

## 目的
開発全体で残っている課題・方針をこのファイルで一元管理する。

## 課題一覧

1. スキーママッピングの整備
   - `docs/schema-usage-matrix.md` を目的 / スコープ / 列定義 / 判定基準付きのテンプレートへ更新し、`GET /api/trades` と `POST /api/trades` の 2 件を暫定で記載済み。
   - それ以外の画面 / API / バッチは棚卸し中で、確定したマッピングが不足している。

2. フロント ↔ バックエンドの契約不整合
   - Positions / Journal / Chats などの機能で、フロント側の API 呼び出しが FastAPI ルータや DB スキーマと一致していない。
   - 例：`GET /positions` や `PATCH /positions/{id}/entry` はフロントのみ実装、Journal API は UUID 必須だがフロントは `user_id: null` を送信。

3. 旧仕様／モック依存の可視化不足
   - 多くのエンドポイントがハードコードされたモックや旧 API 仕様に依存しており、`docs/schema-usage-matrix.md` の `models` や `constraints` 列を埋め切れていない。
   - 実装されていない、もしくは廃止予定の経路に印を付け、実運用と切り分ける必要がある。

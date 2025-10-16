# Trade モデル再設計 実行計画

## 目的
- FastAPI の `/trades` エンドポイントが想定する UUID 主キー + 最小必須フィールド仕様に、SQLAlchemy モデルおよび DB スキーマを揃える。
- テスト失敗原因（UUID と整数主キーの不一致、必須カラム不足）を解消し、今後の async/API 拡張に備える。

## 実行ステップ
1. **現状差分の棚卸し** — ✅ 2025-02-14 実施
   - `Trade` モデル vs Pydantic スキーマ差分

     | 項目 | SQLAlchemy `Trade` (型 / 必須) | FastAPI `TradeIn` 入力 | FastAPI `TradeOut` 出力 | 差分メモ |
     | --- | --- | --- | --- | --- |
     | `trade_id` | `BIGINT` PK / required | `tradeId`: `int | None`（任意） | `tradeId`: `Union[int, UUID]` | API は UUID 想定、モデルは int 固定 |
     | `user_id` | `UUID` FK / required | `userId`: `str`（UUID文字列） | `userId`: `UUID` | 型は一致するが DB に対応ユーザーが存在しない |
     | `stock_code` | `String` / required | 送信されない | `Optional[str]` | モデル必須 / API 任意 |
     | `ticker` | `String` / required | `ticker`: `str` | `ticker`: `str` | 一致 |
     | `side` | `String` / required | `side`: `str` | `side`: `str` | 一致 |
     | `quantity` | `Integer` / required | 送信されない | 返却されない | モデル必須 / API 管理対象外 |
     | `price_in` | `Float` / required | `priceIn`: `float` | `priceIn`: `float` | 一致（フィールド名のみ差異） |
     | `entry_price` | `Float` / required | 送信されない | 返却されない | モデル必須 / API 未使用 |
     | `price_out` | `Float` / optional | 送信されない | 返却されない | モデル optional だが API 管理外 |
     | `size` | `Float` / required | `size`: `float` | `size`: `float` | 一致 |
     | `entered_at` | `DateTime` / required | `enteredAt`: `datetime` | `enteredAt`: `datetime` | 一致（フィールド名のみ差異） |
     | `exited_at` | `DateTime` / optional | 送信されない | 返却されない | モデル optional / API 未使用 |
     | `description` | `String` / required | 送信されない | 返却されない | モデル必須 / API 未使用 |

   - 参考（旧 app.db 調査メモ）
     - 旧 SQLite ではレコード 0 件だったため、テスト投入時は `user_id` 外部キー不整合と必須カラム不足が同時発生していた。

2. **ターゲット仕様の決定** — ✅ 2025-10-08 方針確定（PostgreSQL 専用に更新）
   - 主キー・外部キー
     - `trade_id` → `trade_uuid`（UUID v4）を論理主キーに昇格。PostgreSQL では `UUID` 型、テスト・開発も同様に Postgres を用いる。
     - `users` テーブルにも `user_uuid` を追加し、`user_id`（BIGINT）→`user_uuid`（UUID）への移行を計画。旧列は Phase-A/normalize まで併存。
     - `Image` / `PatternResult` / `Alert` / `TradeJournal` / `chats` / `chat_messages` は `trade_uuid` / `user_uuid` を参照。対象は FK を持つテーブルに限定。
   - 必須カラムの見直し
     - `stock_code`, `quantity`, `entry_price`, `description` は API 未使用のため nullable 化を検討（最終仕様は FastAPI スキーマと同期させる）。
     - `size`, `price_in`, `entered_at`, `ticker`, `side` は必須維持。`price_out`, `exited_at` は optional のまま。
   - スキーマ整合
     - Pydantic `TradeIn` を `userId`, `ticker`, `side`, `priceIn`, `size`, `enteredAt`, `stockCode?`, `quantity?`, `entryPrice?`, `description?` といった最小セットに整理。
     - `TradeOut` は `tradeId`（UUID 文字列）、`userId`（UUID 文字列）、その他フィールドを API で実際に返す項目だけに縮小。
   - 日付・TZ ポリシー
     - 全て UTC ISO8601 で管理。DB カラムは `DateTime(timezone=True)` に寄せ、SQLite では `TEXT` で扱う。

3. **マイグレーション設計** — ✅ PostgreSQL 向けに再構成済み
   - `2f8dbe8b6d6c`: 初期スキーマ（BIGINT ベース）の正規 create。
   - `690ffec9e9e7`: `trades` 追加カラムを idempotent に付与。
   - `c3a1f8e7d24b`: UUID 併存 Phase-A。`users` / `trades` に UUID 列を追加し、`images` / `pattern_results` / `alerts` / `trade_journal` へバックフィル。`MIGRATION_BATCH_SIZE` / `MIGRATION_LOCK_TIMEOUT` でバッチ＆ロック制御。
   - `7e3c9d9b02f0`: 正規化（UUID 主体）。`users.user_id` を UUID 主キーに入れ替え、同期トリガーを設置。`trades.trade_uuid` を NOT NULL + UNIQUE + default `gen_random_uuid()` とし、子テーブルの FK を UUID 列へ切り替え。
   - `pgcrypto` 拡張を前提。必要に応じ `uuid-ossp` などへのフォールバック検討余地あり。
   - テーブル範囲は `users / trades / images / pattern_results / alerts / trade_journal / chats / chat_messages`。将来的に他テーブルが追加された場合は同様の Phase を踏む。

4. **コード調整** — TODO（PostgreSQL 前提で再整理）
   - モデル：`Trade.trade_uuid` を主キー化し、旧 BIGINT 列は移行完了後に削除。`User`・関連テーブルも UUID ベースに統一。
   - TypeDecorator：SQLite 向け特殊処理は不要。`UUID` 型は native 利用。
   - API & スキーマ：`TradeIn/TradeOut` を UUID / nullable フィールドの最新仕様に合わせる。
   - テスト：PostgreSQL 接続前提。フィクスチャでダミー UUID ユーザーを投入。`make db-upgrade` 前提で pytest を実行。

7. **フェーズ移行計画（現行マイグレーションに合わせて更新）**
   - **Phase A：初期スキーマ確立**（2f8dbe8b6d6c / 690ffec9e9e7）
   - **Phase B：UUID 併存 + バックフィル**（c3a1f8e7d24b）
   - **Phase C：UUID 主体へ正規化**（7e3c9d9b02f0） — 旧 BIGINT 列はこの段階で除去。
   - **Phase D：追加インデックス調整や不要列の完全撤去** — 旧列が残る場合の最終掃除（今後の課題）。

8. **実装分割の目安（小さな PR）**
   1. Alembic 履歴リライト + Settings 整備（完了）
   2. ORM / スキーマ / API を UUID 主導に揃える
   3. UUID 主体への最終切り替えに合わせた旧列削除・インデックス再調整
   4. ドキュメント・運用手順（pgcrypto、Makefile、CI）整備
   5. 後続で追加テーブルが出た場合は Phase-A/B 手順で拡張

5. **検証**
   - ローカル/CI とも PostgreSQL 16 を使用。`docker run postgres:16` で起動し `make db-reset && make db-upgrade && make test` を実行。
   - `alembic -x dburl=... upgrade head` でテスト専用 DB へ適用可能。
   - `/healthz` スモーク、`pytest -q app/tests tests test_*.py` がグリーンであることを確認。

6. **ドキュメント / リリース準備**
   - README や開発手順書に、UUID 主キーへの変更・マイグレーション実行手順を追記。
   - リリースノート草案：影響範囲・移行手順・ロールバック方法を記載。
   - マージ前レビューで API / DB / モデル整合性の再チェック。

## 未確定事項・確認ポイント
- `users` テーブルに UUID キーのデータが既に存在するか？ 存在しない場合、それまでのテストユーザー生成ロジックをどうするか。
- `trade_id` を UUID 化した際、既存の参照（例：フロント or 他テーブルの FK）があるか。
- マイグレーション中に既存整数 ID を UUID に変換する方法（新 UUID を採番し、参照も更新できるか）。
- スキーマ変更をロールバックする必要がある場合の手順。
- 今後 `Trade` 以外のテーブル（`TradeJournal` 等）でも UUID 統一を進めるか。

## メモ
- すべてのテストは PostgreSQL 前提。SQLite 互換層は不要になった。
- `pgcrypto` が利用できない環境では `uuid-ossp` もしくは Python `uuid4()` フォールバックの実装を検討する。

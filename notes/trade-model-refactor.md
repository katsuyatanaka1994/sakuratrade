# Trade モデル再設計 実行計画

## 目的
- FastAPI の `/trades` エンドポイントが想定する UUID 主キー + 最小必須フィールド仕様に、SQLAlchemy モデルおよび DB スキーマを揃える。
- テスト失敗原因（UUID と整数主キーの不一致、必須カラム不足）を解消し、今後の async/API 拡張に備える。

## 実行ステップ
1. **現状差分の棚卸し** — ✅ 2025-02-14 実施
   - `Trade` モデル vs Pydantic スキーマ差分

     | 項目 | SQLAlchemy `Trade` (型 / 必須) | FastAPI `TradeIn` 入力 | FastAPI `TradeOut` 出力 | 差分メモ |
     | --- | --- | --- | --- | --- |
     | `trade_id` | `INTEGER` PK / required | `tradeId`: `int | None`（任意） | `tradeId`: `Union[int, UUID]` | API は UUID 想定、モデルは int 固定 |
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

   - 既存 `app.db`（SQLite）調査結果
     - `users` テーブル: 定義あり（主キー `CHAR(32)`）だがレコード 0 件。
     - `trades` テーブル: 主キー `INTEGER`、上表の通り全カラム `NOT NULL` 指定多数。レコード 0 件。
     - このためテスト投入時に `user_id` 外部キー不整合（ユーザー欠如）と、必須カラム欠落が同時発生する状態。

2. **ターゲット仕様の決定** — ✅ 2025-10-08 方針確定
   - 主キー・外部キー
     - `trade_id` → `trade_uuid`（UUID v4）を論理主キーに昇格。SQLite テスト環境は 36 文字文字列、PostgreSQL など本番系は `UUID(as_uuid=True)` を使用できるよう TypeDecorator で吸収。
     - `users` テーブルにも `user_uuid` を追加し、将来的にこちらを主キーへ昇格。現行の `CHAR(32)` 列は併存させる。
     - `Image` / `PatternResult` / `Alert` / `TradeJournal` / `TradeJournalTimeline` は `trade_uuid` に外部キーを張り、既存の整数 `trade_id` は Phase A/B では併存維持。
   - 必須カラムの見直し
     - `stock_code`, `quantity`, `entry_price`, `description` は API で未使用のため nullable + default `None` へ変更。将来利用する場合はバリデーション層で補完。
     - `price_out`, `exited_at` は現状 optional のまま。`size`, `price_in`, `entered_at`, `ticker`, `side` は必須維持。
   - スキーマ整合
     - Pydantic `TradeIn` を `userId`, `ticker`, `side`, `priceIn`, `size`, `enteredAt`, `stockCode?`, `quantity?`, `entryPrice?`, `description?` といった最小セットに整理。
     - `TradeOut` は `tradeId`（UUID 文字列）、`userId`（UUID 文字列）、その他フィールドを API で実際に返す項目だけに縮小。
   - 日付・TZ ポリシー
     - 全て UTC ISO8601 で管理。DB カラムは `DateTime(timezone=True)` に寄せ、SQLite では `TEXT` で扱う。

3. **マイグレーション設計** — 進行中（草案固め）
   - Phase A 用リビジョン（新規列の追加）
     - `users` に `user_uuid CHAR(36)`、`trades` に `trade_uuid CHAR(36)` を追加（両方 nullable + unique）。
     - 参照テーブル（`images`, `pattern_results`, `alerts`, `trade_journal`, `trade_journal_timeline`）にも `*_uuid` 列を追加。
     - 追加後、Python ループで `uuid.uuid4()` を採番し `*_uuid` をバックフィル。
     - 現状スキーマ調査メモ：`images`/`pattern_results`/`alerts` は `trade_id INTEGER NOT NULL`、`trade_journal` は `trade_id VARCHAR PRIMARY KEY`（既に文字列）。`trade_journal_timeline` は未作成（今後の計画で同時に作成 or UUID カラム追加時に作成要検討）。
   - Phase B リビジョン（FK 追加＆NOT NULL 化）
     - 新 UUID 列に `NOT NULL` と `UNIQUE` を付与。`trade_uuid` を新しい PK に昇格し、既存の int 列を `nullable=True` + index のみに格下げ。
     - 各参照テーブルの FK を UUID 列に切り替え、旧 FK は残す or `SET NULL` に変更。
   - Phase C リビジョン（撤去）
     - アプリ切替後、旧 int 列＋制約・インデックスを drop。
   - シード処理
     - Phase A のマイグレーションで、テスト・開発向けに `users` へ `00000000-...` のダミーレコードを挿入（存在しない場合のみ）。
   - 検証
     - ローカル SQLite（`pytest` 用）と将来想定の PostgreSQL の両方を docker-compose 等で適用テストする。

4. **コード調整** — TODO
   - モデル
     - `app/models.py`: `Trade.trade_uuid = mapped_column(UUIDStr, primary_key=True, default=uuid4)` を追加し、旧 `trade_id` は `legacy_trade_id` として保持。
     - `Image`, `PatternResult`, `Alert`, `TradeJournal`, `TradeJournalTimeline` の FK を `trade_uuid` に差し替え。`User` にも `user_uuid` を追加し relationship を更新。
   - TypeDecorator / ユーティリティ
     - `app/db/types.py`（新規）に `UUIDStr` を実装し、SQLite/PG 両対応のシリアライズを統一。
   - Pydantic & ルータ
     - `app/schemas/trade.py`, `app/routers/trades.py` を UUID ベースにリファクタ。入力検証で不足フィールドには `None` を許容、DB への default を設定。
     - レスポンスに `tradeId`（UUID文字列）と必須フィールドのみ返すよう調整。
   - テスト
     - `tests/conftest.py` にダミーユーザー投入フィクスチャ（`user_uuid` を固定発行）を追加。
     - `tests/test_trades.py` を新スキーマに合わせて更新し、UUID を検証するアサーションを追加。

7. **フェーズ移行計画（Blue/Green タイプ）**
   - **Phase A（併存追加）**: `*_uuid` 列を trades / users / 関連テーブルへ追加し、書き込みを整数＋UUID二重化。既存参照は両対応に改修。
   - **Phase B（バックフィル）**: 全レコードへ UUID を採番して `*_uuid` 列を埋める。不整合データはダミー行や補正ルールで対応。
   - **Phase C（切替）**: アプリを UUID 列基準に切替え、制約を UUID 列へ昇格。整数列は非 PK 化。
   - **Phase D（撤去）**: 旧整数列・制約を削除。ロールバック手順をドキュメント化。

8. **実装分割の目安（小さな PR）**
   1. 併存 UUID 列の追加（バックフィルと TypeDecorator 導入）
   2. ルータ／Pydantic／テストを UUID 併存仕様へ対応
   3. UUID 列を正式な PK / FK に昇格
   4. 旧整数列撤去と最終クリーニング
   5. ドキュメント更新（移行手順・ロールバック）

5. **検証**
   - ローカルで `pip install -e '.[dev,sqlite]'` → `python -m pytest tests/test_trades.py tests/test_chat_message_delete.py` を実行し、全テストが成功することを確認。
   - sqlite + async のテスト環境でもスキーマが正しく適用されることを確認。
   - CI（GitHub Actions）でのフルテスト実行と結果確認。

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
- 既存テストは in-memory SQLite を使用しているため、UUID 型の扱いは `sqlalchemy.dialects.sqlite` の適切な型 or String カラム + バリデーションで代替できる。
- マイグレーション設計時は、SQLite 限定ではなく本番 DB（PostgreSQL など）の方針も合わせて検討する。

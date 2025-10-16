# Schema Usage Matrix (Draft)

## 目的
- 画面 / 機能ごとの API 契約（入出力）と DB スキーマ前提を 1 枚のマッピングに統合し、差異・矛盾・抜けを特定する。
- 以後の仕様統一・移行（マイグレーション / DTO 修正 / フロント改修）のソース・オブ・トゥルースとして維持する。

## スコープ
### 対象
- Backend：FastAPI ルータ、Pydantic Schema / DTO、SQLAlchemy Model、Alembic リビジョン。
- Frontend：API クライアント層（fetch / axios など）、主要コンポーネント（画面単位）。
- インフラ：`.env.example` 等に記載された DB 接続情報（参照のみ）。

### 非対象（今回はやらない）
- 外部 SaaS 連携の詳細仕様。
- BI / ETL などの非同期バッチ。
- 削除予定の旧コード（Deprecated / Dead Code）はフラグ付与のみで詳細調査は行わない。

## マッピング列定義
| Column | 説明 | 補足 |
| --- | --- | --- |
| screen_id | 画面 / 機能名。 | 例：`TradesPage`, `TradeChat`。API 専用の場合は `N/A`。 |
| component_path | フロント主要ファイルのパス。 | 複数ある場合は代表ファイルを記載。 |
| endpoint | HTTP メソッド + パス。 | 例：`GET /api/trades`。 |
| caller | フロントの呼び出し元関数 / ファイル。 | `frontend/src/lib/api/...` など。 |
| request_schema(frontend) | フロントが送信するリクエスト Shape。 | 型・必須・nullable を記す。 |
| request_schema(api) | FastAPI / Pydantic 受入口の型。 | 差異検出対象。 |
| response_schema(api) | API が返却するスキーマ。 | `TradeOut`, `List[TradeOut]` など。 |
| response_use(frontend) | フロントがバインドするフィールド。 | UI 要素との対応を記述。 |
| models | 関連する SQLAlchemy モデル。 | 複数あればカンマ区切り。 |
| tables_columns | 参照 / 更新するテーブルとカラム。 | PK / FK / NOT NULL / Default 等を含む。 |
| transaction | 処理の R/W 種別。 | `SELECT` / `INSERT` / `UPDATE` / `DELETE` と境界。 |
| constraints | 関連制約。 | `UNIQUE`, `FK`, `CHECK` 等。 |
| alembic_revisions | 影響するリビジョン ID。 | 過去の ID を列挙。 |
| assumptions | コード上の前提・期待値。 | 例：UUID 想定など。 |
| inconsistencies | 型不一致や nullable 差異などのギャップ。 | 判定ルールに従って記載。 |
| severity | 影響度。 | `High` / `Medium` / `Low`。 |
| fix_hint | 最小改修案。 | どの層を修正すると良いか。 |

## マッピング表（サンプルエントリ）
| screen_id | component_path | endpoint | caller | request_schema(frontend) | request_schema(api) | response_schema(api) | response_use(frontend) | models | tables_columns | transaction | constraints | alembic_revisions | assumptions | inconsistencies | severity | fix_hint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TradesPage | `frontend/src/pages/TradesPage.tsx` | `GET /api/trades` | `frontend/src/lib/api/trades.ts#fetchTrades` | `TradeFilter` (`from?`, `to?`, `q?`, `type?`, `side?`, `page?`, `page_size?`, `timeframe?`) | 未定義（FastAPI 側でクエリパラメータ未宣言） | `List[TradeOut]` | 期待型：`TradeListResp` `{ items: TradeListItem[], meta: { total, ... } }`。各 `TradeListItem` は `id`, `symbol`, `symbol_name`, `side`, `entry_price`, `exit_price`, `entry_at`, `exit_at`, `pnl`, `pnl_pct` 等を想定。 | `Trade` | `trades.trade_uuid`, `trades.ticker`, `trades.side`, `trades.price_in`, `trades.size`, `trades.entered_at`, `trades.price_out`, `trades.exited_at`, `trades.description` | `SELECT` | `trades.trade_uuid` PK(UUID), `ticker/side/price_in/size/entered_at` NOT NULL | `2f8dbe8b6d6c`, `7e3c9d9b02f0` | UI はソート済み一覧と `meta.total` の存在を前提。通貨表示・PnL 計算済みを期待。 | API はプレーン配列、フロントは `items/meta` ラッパーと `pnl`, `symbol_name` 等を要求。フィルタークエリも未対応。 | High | API で `TradeListResponse` を実装し `items/meta`・必要フィールドを補完、またはフロント側の期待を `TradeOut` に揃える。加えて GET パラメータを FastAPI 側へ定義。 |
| N/A (API Only) | `-` | `POST /api/trades` | `app/routers/trades.py#create_trade` | 想定：`TradeInPayload`（UUID `userId`、`ticker`, `side`, `priceIn`, `size`, `enteredAt`, 任意 `stockCode`, `quantity`, `entryPrice`, `description`） | `TradeIn` (Pydantic) | `TradeOut` | 未連携（フロントからの呼び出しなし） | `Trade` | `trades.trade_uuid`, `trades.user_id`, `trades.ticker`, `trades.side`, `trades.price_in`, `trades.size`, `trades.entered_at`, `trades.stock_code`, `trades.quantity`, `trades.entry_price`, `trades.description` | `INSERT` | `trades.trade_uuid` PK(UUID), `user_id` FK→`users.user_uuid`, 必須フィールドは NOT NULL | `2f8dbe8b6d6c`, `7e3c9d9b02f0` | API は UUID ベースを前提。`stock_code` など未指定時はデフォルト値で補完。 | フロント未接続のため要求仕様が共有されていない。既存 DB では `user_id` に対応ユーザーが無いケースあり。 | Medium | フロントで利用する場合は UUID `userId` を発行・送信する導線を整備し、任意フィールドの扱いをドキュメント化。テストフィクスチャでユーザー存在を保証。 |

> 📝 他の画面 / API / バッチ / イベントでも同様に行を追加し、必須フィールド・差異・修正案を最新化してください。

## 更新時の確認事項
1. スキーマ定義（Pydantic / JSON Schema / DB モデル）に差分があるか確認。
2. 上表に利用フィールドと必須可否を反映し、差分がプラス / マイナスどちらかをコメント。
3. Breaking な変更の場合は関連チーム（フロント / バッチ担当など）へ通知。
4. 変更内容を `docs/schema-update-checklist.md` に沿って PR テンプレートでカバーすること。
5. JSON Schema 出力（例: `docs/schema_exports/TradeIn.schema.json`）も更新されているか確認。

## レビュー依頼
- 対象チーム: フロントエンド、バックエンド API、データ基盤
- レビュー内容: 上記表の前提（スキーマ名、バージョン、必須項目、差異判定）が現状と一致しているか確認
- フィードバック方法: GitHub PR コメントまたは Slack `#schema-consistency` チャンネル

## 差異判定基準
- 型不一致：フロント送信型 ≠ API 受信型、または API 返却型 ≠ フロント受領想定。
- null / 必須の齟齬：API 側が必須だがフロントは任意、またはその逆。
- ID 種別の不一致：UUID vs INT、string vs number など。
- ソート / ページング契約の不明瞭さ：フロントが降順依存だが API が未規定等。
- DB 制約違反の可能性：NOT NULL / UNIQUE に対しフロントが値を提供しない。
- Alembic 差分の漂流：モデル定義と実データベースが不整合である可能性を示唆（リビジョン未反映）。

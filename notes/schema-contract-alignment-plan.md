
# Schema / Contract Alignment Plan

## Purpose
- 画面 / 機能単位での API 契約（入出力）と DB スキーマ前提を 1 枚のマッピングに統合し、差異・矛盾・抜けを特定する。
- 以後の仕様統一・移行（マイグレーション / DTO 修正 / フロント改修）のソース・オブ・トゥルースとして維持する。

## Scope

### 対象
- Backend：FastAPI ルータ、Pydantic Schema / DTO、SQLAlchemy Model、Alembic リビジョン。
- Frontend：API クライアント（fetch / axios 層）、呼び出し元コンポーネント（画面単位）。
- インフラ：`.env.example` 等に記載の DB 接続情報（参照のみ）。

### 非対象（今回はやらない）
- 外部 SaaS 連携の詳細仕様。
- BI / ETL などの非同期バッチ。
- 削除予定の旧コード（Deprecated / Dead Code）はフラグ付与のみで調査対象外。

## Objectives
- 一覧化された「参照側 ↔ スキーマ定義」マッピングで現行の依存関係とギャップを可視化する。
- ドキュメントと差分テスト更新を開発フローへ組み込み、変更漏れを防ぐ。
- CI でスキーマ差分を検知し、PR 上で通知できる仕組みを検討・導入する。

## Expected Deliverables
- `docs/schema-usage-matrix.md`：画面 / API / バッチ / イベントと、依存するスキーマ名・バージョン・必須フィールドのマッピング表。
- `docs/schema-update-checklist.md`：仕様変更時に実行すべき項目のチェックリスト（PR テンプレートから参照）。
- CI パイプライン変更案：スキーマ差分検知ジョブ、結果を PR コメントまたはステータスで提示する設計メモ。

## Workstreams

### 1. 現行スキーマと画面 / API の棚卸し
1. 参照範囲の洗い出し
   - 対象：主要画面、公開 / 内部 API、非同期イベント、バッチ処理。
   - 仕様ソース：FastAPI スキーマ（Pydantic）、GraphQL / REST 定義、フロントの型定義、DB モデル定義、ドキュメント。
2. マッピング表の初期作成
   - 列定義は `docs/schema-usage-matrix.md` の最新テンプレート（`screen_id` / `component_path` / `endpoint` ... `fix_hint`）。
   - 差分メモ欄（`inconsistencies` 列）で「未使用カラム」「型不一致」「バージョン違い」を明記。
3. レビューと確定
   - 各担当者（API / フロント / バッチ）に確認を依頼し、認識差異を解消。
   - 確定版を `docs/schema-usage-matrix.md` としてリポジトリに保存し、更新履歴を残す。

### 2. 変更時チェックリストと運用フロー
1. チェックリスト整備
   - 更新トリガー：スキーマ（Pydantic / JSON Schema / DB モデル）変更、画面 / API 実装変更、イベント契約変更。
   - 項目例：
     - マッピング表更新（追加 / 変更箇所の明記）。
     - 差分テスト / 契約テストの更新。
     - バージョン番号・互換性情報の反映。
     - コミュニケーション（リリースノート、Slack 通知）。
2. PR テンプレート / Definition of Done への組み込み
   - `docs/schema-update-checklist.md` を参照するチェック項目を PR テンプレートに追加。
   - DoD に「スキーマ変更時はチェックリスト完了」が含まれるよう合意形成。
3. 継続改善
   - 月次またはリリースごとにチェックリストとマッピング表の振り返りを行い、漏れが出た場合に項目を更新。

### 3. CI でのスキーマ差分検知
1. ツール調査
   - JSON Schema 用差分ツール（`ajv-diff`, `json-schema-diff` など）や型生成（`datamodel-codegen`）の比較。
   - Pydantic モデルから JSON Schema をエクスポートし、Git で管理する運用を検討。
2. プロトタイプ
   - `scripts/export_json_schema.py` を実装（`venv/bin/python scripts/export_json_schema.py`）し、`docs/schema_exports/TradeIn.schema.json` / `TradeOut.schema.json` を出力。
   - 取得した JSON Schema を Git 管理し、CI 上で前回との差分を取得。
   - 差分に重大な変更（Breaking / Non-breaking）を分類するスクリプトを作成。
3. CI 統合
   - 差分結果を GitHub Actions / CircleCI ジョブに組み込み、PR コメントまたは required status check で可視化。
   - 失敗条件や通知先を定義（例：Breaking change が検出されたら PR を fail）。
4. 運用ガイド
   - 新しい CI 結果の読み方と対応手順を `docs/schema-update-checklist.md` に追記。
   - 初期ローンチ後、数スプリントは結果をモニタリングしてしきい値や分類ロジックを調整。

## Milestones & Cadence
- Sprint N：棚卸し着手、マッピング表ドラフト、レビュー依頼。
- Sprint N+1：チェックリスト策定、PR テンプレート更新、差分ツール PoC。
- Sprint N+2：CI プロトタイプ導入、運用ガイド整備、本番パイプラインへ段階導入。
- 月次：マッピング表とチェックリストの棚卸し、CI ログの振り返り。

## Immediate Next Actions
- `docs/schema-usage-matrix.md` に残りの画面 / API / バッチを追記し、列定義を埋めるためのインタビュー / 調査を進める。
- Pydantic モデルから JSON Schema を出力する手段を確認（`scripts/export_json_schema.py` で `TradeIn` / `TradeOut` をエクスポート済み）。
- PR テンプレートにチェックリスト参照セクションを追加する案をドラフト化し、チームに提案。

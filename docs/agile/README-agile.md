> CO-EDIT: このファイルは**人とCodexが協働**で更新します。本文は人が主導、下の **ASSIST** ブロックのみ Codex が自動更新します。
> 対応表: [docs/agile/mapping.yml](./mapping.yml)（Codexはこの表に従ってAUTO側を更新します）
> 境界の原本: [docs/agile/auto-manual-boundary.md](./auto-manual-boundary.md)

# アジャイルドキュメントハブ

- メンテナ (Codex):
- レビュアー (人間):
- 最終更新日:
- スプリント / Issue:
- 適用範囲: `docs/agile/`

<!-- NOTE: メタデータセクション直後に配置する ASSIST ブロック。ステータスを最初に確認できるようにする -->
## 進捗ステータス（自動サマリ）
<!-- ASSIST-START:status -->
<!-- Codex がスプリント進捗を要約して書き換える領域 -->
- 進捗: DS-10 土台 反映（2025-10-18）
- 進捗: DS-4〜DS-7 完了（2025-10-17）
- チェック用の追記（ASSIST内）
- 運用: make oas-lint → make ds-diff → 必要なら make ds-apply BR=$(git branch --show-current)
<!-- ASSIST-END:status -->

<!-- NOTE: 進捗の下に未消化タスクを並べることで、参照順を固定 -->
## 未消化タスク（自動抽出）
<!-- ASSIST-START:tickets -->
<!-- Codex が PBI/issue から抽出した ToDo を列挙する領域 -->
<!-- ASSIST-END:tickets -->

<!-- NOTE: タスクの次に関連リンクを置き、参照の導線をまとめる -->
## 参照リンク（自動整備）
<!-- ASSIST-START:links -->
<!-- Codex が関連PR/ドキュ/テストへのリンクを挿入する領域 -->
<!-- ASSIST-END:links -->

### 自動更新のトリガー（CodexがASSISTを編集する条件）
- PRに `plan:sync` ラベルが付いたとき（設計同期）
- `docs/agile/mapping.yml` が更新されたとき（対応表変更）
- 手動実行: Actions `docsync-assist-update` の `Run workflow`
- （任意）毎日 03:00（JST）の定期実行
- PR作成時は上記トリガーに該当する場合、PR本文へ自動更新実行予定（ASSISTが空のままな理由など）を一言補足する

> Codex は **ASSIST-START/END の範囲のみ**を書き換えます。本文は人が主導します。
> 旧 `<!-- AUTO-START --> ... <!-- AUTO-END -->` が残っている場合は、対応する `<!-- ASSIST-START:* --> ... <!-- ASSIST-END:* -->` に置き換えてください。

## 更新タイミング
- スプリント開始時にバックログリンクや担当情報を最新化する。
- アジャイル系ドキュメントの追加・削除、役割変更が発生した際に索引を更新する。
- 大きな運用ルール変更やオーナー交代時にはメタデータと関連リンクを見直す。

## 理由・目的
スプリント計画・実装・検証で使用するドキュメントの入口を提供し、Codex と人間が共同で更新する際のルールと依存関係を明確化する。

## ドキュメント索引
<!-- ASSIST-START:index -->
| ドキュメント | 役割 / 内容 | 主担当 | 更新タイミング | 備考 |
| --- | --- | --- | --- | --- |
| `document-operations.md` | ドキュメント運用方針まとめ | Codex + PO | ルール変更時 | 更新手順・責務一覧 |
| `plan.md` | プロジェクト計画テンプレ | Codex + PO | スプリント計画開始時 | AUTO: plan.meta（DocSync管理） |
| `workorder.md` | 作業指示テンプレ | Codex + Devリード | 着手時 / 作業指示更新時 | AUTO: workorder.meta（DocSync管理） |
| `review.md` | 振り返り・レビュー記録テンプレ | Codex + QA | Sprintレビュー / 事後振り返り時 | AUTO: review.meta（DocSync管理） |
| `ui-specification.md` | UI仕様テンプレ | Codex + デザイナー | デザイナー/POが指示したタイミング | MANUAL起動: 人→Codex指示でセクション追加 |
| `api-specification.md` | API仕様テンプレ | Codex | API設計時 | `docs/specs/openapi.yaml` と同期 |
| `security-considerations.md` | セキュリティ要件 | セキュリティチーム | 四半期レビュー | 非機能要件と連携 |
| `non-functional-requirements.md` | 性能・可用性要件 | SRE | 半期 / 大規模変更 | SLOとRunbook参照 |
| `unit-test-specification.md` | ユニットテスト仕様 | Codex + Dev | テスト追加時 | テストケース毎に追記 |
| `integration-test-specification.md` | 統合テスト仕様 | Codex + QA | フロー実装時 | seed/cleanup明記 |
| `smoke-e2e-specification.md` | スモークE2E仕様 | Codex + QA | リリース前 / 回帰発生時 | Playwright等と同期 |
| `ci-specification.md` | CI / パイプライン定義 | Codex + SRE | CI変更時 | `.github/workflows` とリンク |
| `test-policy.md` | テスト運用ポリシー | Codex + QA | CI/テスト運用変更時 | run:integration 任意実行の基準 |
| `release-checklist.md` | リリースチェックリスト | Codex + QA | リリース準備時 | Run URL 記録欄つきチェック表 |
| `release-notes.md` | Docs差分のリリースノート履歴 | Docsチーム | mainマージ時（Docs差分あり） | relnotes workflowでAUTO追記 |
| [DS-21 セキュリティ／権限運用ガイド](./security-actions-guidelines.md) | GitHub Actions権限運用ガイドライン | セキュリティチーム | 監査ポリシー変更時 | pull_request_target/permissions 基準 |
| [DS-21 セキュリティ監査チェックリスト](./checklists/security-actions-audit.md) | Actions権限監査チェックリスト | セキュリティチーム | 週次 / リリース前 | lintスクリプト連携 |
| `implementation-details.md` | 実装詳細・Runbook | Codex + Dev | 実装完了時 | 変更時はテスト/CIと連携更新 |
| [DocSync レポート（週次）](docs/agile/report.md) | DocSync自動実行の週次結果ログ | Codex | 毎週 / DocSync完了時 | Actions Summaryを転記 |
| [ブランチ戦略](docs/agile/branching.md) | 1タスク=1ブランチ運用ルール | Codex + Dev | 運用ルール変更時 | 命名規約・Draft運用を定義 |
| [AUTO/MANUAL 境界ルール](docs/agile/auto-manual-boundary.md) | AUTO/MANUAL/CO-EDIT 境界の原本 | Codex + PO | ルール変更時 | README-agile.md と連携 |
| [DocSync 日常運転（v3）](docs/agile/runbooks/docsync-daily-v3.md) | DocSync日常運転スナップショット | Codex + Ops | DocSync運用変更時 | DS-17/18/18.1/14/20基準 |
| [Runbook: UI Spec Manual](docs/agile/runbooks/ui-spec-manual.md) | UI仕様ASSIST同期のRunbook | Codex + QA | UI仕様更新後 | Actions `ui-spec-manual` 手順 |
<!-- ASSIST-END:index -->

## スプリント内ワークフロー
1. **バックログ確認** — Issue Tracker / プロダクトバックログで対象ストーリーを確定し、影響範囲を把握。  
2. **設計フェーズ** — デザイナー/POがCodexへ指示し、`ui-specification.md` にUI要件を反映。API設計が必要なら `api-specification.md` と OpenAPI を同期。  
3. **非機能 / セキュリティ確認** — `non-functional-requirements.md` / `security-considerations.md` を参照し、変更があれば同時更新。  
4. **実装・テスト計画** — Codex がユニット/統合/E2E仕様テンプレを更新し、CIフロー (`ci-specification.md`) の必要ジョブを確認。  
5. **実装完了レビュー** — `implementation-details.md` に結果を反映し、`CHANGELOG.md` にリリース内容を記録。

## 更新ルール
- `docs/agile/` 内の変更は原則 Codex がPR下書きを用意し、人間レビュアーが承認する。
- 各ファイルのメタデータ欄（作成者/レビュアー/最終更新日）は必ず更新する。
- API契約変更時は `docs/specs/openapi.yaml` の差分と `api-specification.md` を同一PRに含める。
- セキュリティ・非機能要件改定は `ci-specification.md` やテスト仕様への影響をレビューで確認する。
- 旧AUTOマーカーを見つけた場合はASSISTマーカーへ置換した上で運用を揃える。

## 自動化のヒント
- テンプレに従って記入することでCodexが差分検知・自動レビューしやすくなる。UI仕様のみ MANUAL 起動でCodexがテンプレを複製する。
- 表形式のセクションはMarkdownテーブルとして維持し、列構成を変更する場合はCodexに指示する。
- `scripts/validate-agile-docs` をCIに組み込み、必須欄やリンクの欠落をPRでブロックする。将来的な自動生成スクリプトとも連携しやすくするため、定型部分はプレーンテキストで記載。

## 関連ドキュメント
- 上位README: `docs/README.md`
- API契約: `docs/specs/openapi.yaml`
- CI Runbook: `docs/agile/ci-specification.md` → 関連リンク参照
- セキュリティポリシー(全体): (リンクを記載)

## 変更履歴
- YYYY-MM-DD: 初版作成 (PR # / 担当者)
- YYYY-MM-DD:

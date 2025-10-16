# アジャイルドキュメントハブ

- メンテナ (Codex):
- レビュアー (人間):
- 最終更新日:
- スプリント / Issue:
- 適用範囲: `docs/agile/`

## 更新タイミング
- スプリント開始時にバックログリンクや担当情報を最新化する。
- アジャイル系ドキュメントの追加・削除、役割変更が発生した際に索引を更新する。
- 大きな運用ルール変更やオーナー交代時にはメタデータと関連リンクを見直す。

## 理由・目的
スプリント計画・実装・検証で使用するドキュメントの入口を提供し、Codex と人間が共同で更新する際のルールと依存関係を明確化する。

## ドキュメント索引
| ドキュメント | 役割 / 内容 | 主担当 | 更新タイミング | 備考 |
| --- | --- | --- | --- | --- |
| `document-operations.md` | ドキュメント運用方針まとめ | Codex + PO | ルール変更時 | 更新手順・責務一覧 |
| `ui-specification.md` | UI仕様テンプレ | Codex + デザイナー | デザイナー/POが指示したタイミング | MANUAL起動: 人→Codex指示でセクション追加 |
| `api-specification.md` | API仕様テンプレ | Codex | API設計時 | `docs/specs/openapi.yaml` と同期 |
| `security-considerations.md` | セキュリティ要件 | セキュリティチーム | 四半期レビュー | 非機能要件と連携 |
| `non-functional-requirements.md` | 性能・可用性要件 | SRE | 半期 / 大規模変更 | SLOとRunbook参照 |
| `unit-test-specification.md` | ユニットテスト仕様 | Codex + Dev | テスト追加時 | テストケース毎に追記 |
| `integration-test-specification.md` | 統合テスト仕様 | Codex + QA | フロー実装時 | seed/cleanup明記 |
| `smoke-e2e-specification.md` | スモークE2E仕様 | Codex + QA | リリース前 / 回帰発生時 | Playwright等と同期 |
| `ci-specification.md` | CI / パイプライン定義 | Codex + SRE | CI変更時 | `.github/workflows` とリンク |
| `implementation-details.md` | 実装詳細・Runbook | Codex + Dev | 実装完了時 | 変更時はテスト/CIと連携更新 |

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

# ドキュメント運用方針

- 作成者（Codex）:
- レビュアー（人間）:
- 最終更新日:
- スプリント / Issue:

## 目的
`docs/agile/` 配下のドキュメントをCodexと人間が協調して維持するため、責務・更新トリガ・レビュー観点を明文化する。

## 運用サマリ
| ドキュメント | 主な目的 | Codexの役割 | 人間の役割 | 更新トリガ |
| --- | --- | --- | --- | --- |
| `README-agile.md` | アジャイル文書ハブ | 索引更新、メタデータ整形 | バックログ/リンク更新 | スプリント開始時、ドキュメント増減時 |
| `ui-specification.md` | 画面仕様テンプレ & セクション追記 | 人からの指示を受けてテンプレ複製、API参照欄整形、ready_for_sync 状態更新 | Figmaリンクや文言入力、UI意図補足、指示の発行 | MANUAL: デザイナー/POがCodexへ指示したとき |
| `api-specification.md` | API仕様テンプレ | OpenAPI差分反映、例フォーマット整形 | 例外処理・実装メモ追記 | API設計/変更PR |
| `security-considerations.md` | セキュリティ要件一覧 | テンプレ維持、表整形、レビュー期限リマインド | 要件値更新、連絡先管理 | 四半期レビュー、インシデント後 |
| `non-functional-requirements.md` | 非機能要件 | SLOテーブル更新、欠測アラート | 数値更新、性能レポート反映 | 半期レビュー、性能試験結果反映時 |
| `unit-test-specification.md` | ユニットテスト仕様 | ケース追加テンプレ、整形 | テスト観点/データ記入 | テスト追加/修正PR |
| `integration-test-specification.md` | 統合テスト仕様 | シナリオ表整形、Cleanup確認 | 手順詳細・データ補足 | 統合テスト追加/修正PR |
| `smoke-e2e-specification.md` | スモークE2E仕様 | 検証ポイント表更新、自動化リンク追跡 | Gherkin/期待結果補足 | E2Eシナリオ追加/修正時 |
| `ci-specification.md` | CIパイプライン定義 | CI diff解析、doc-validate ジョブ表更新 | Runbookリンク、説明補完 | CI構成変更PR |
| `implementation-details.md` | 実装詳細まとめ | 初稿生成、リンク整合チェック | トレードオフ、Runbook追記 | 機能完了PR、重大変更 |
| `docs/specs/openapi.yaml` | API機械可読契約 | 整合検証、パス差分通知 | レビュアーが承認 | API変更PR |
| `CHANGELOG.md` | スプリント変更履歴 | 草案生成、リンク集約 | 最終レビュー、社内共有 | スプリント終了時 |
| `CONTRIBUTING.md` | 更新ルール共有 | 運用手順反映 | チーム合意形成 | ルール変更時 |

## ワークフロー
1. **変更検知 / 指示受領**: CodexがPR差分やOpenAPI変更、CI設定変更を自動監視し、UI仕様のみはデザイナー/POからの指示（workflow_dispatch 想定）で起動。  
2. **初期ドラフト**: Codexがテンプレ項目を埋め、必要な表/チェックリストを整形。UI仕様は `起動トリガ` が MANUAL のまま、指示内容に沿ってセクションを生成。  
3. **人間レビュー**: 各ドキュメント担当が内容（意図・背景・定性的情報）を補完し承認。  
4. **メタデータ更新**: 作成者/レビュアー/最終更新日を必ず更新。  
5. **CIバリデーション**: `scripts/validate-agile-docs` をPRブロッカーとして実行し、表構造崩れ・必須欄空欄・リンク不整合・OpenAPI契約差分を検知した場合は Fail にする。  
6. **通知/ログ**: `CHANGELOG.md` へ必要なリンクを追加し、Slackで共有。

## レビュー観点
- 必須欄が空欄のままになっていないか。  
- 他ドキュメントとの参照リンクが最新になっているか。  
- セキュリティ/非機能要件に変更がある場合、CI/テスト仕様へ反映されているか。  
- 既存テンプレ構造（テーブル列構成など）を維持し、UI仕様で `ready_for_sync` 状態の意味が正しくセットされているか。

## 自動化 / ツール
- `scripts/format-docs` でMarkdown整形、`scripts/validate-agile-docs` で以下をブロック: テーブル列不足、必須欄空欄、MANUAL/AUTOフラグ破壊、リンク切れ、OpenAPIとの不整合。  
- PR BotとしてCodexが、validate失敗の詳細や未記入メタデータをコメントし、Draft PRを自動作成。  
- OpenAPIとの差分は `scripts/check-openapi-sync` を `contract-check` から呼び出し、API仕様と同期。

## エスカレーション
- 緊急度の高いセキュリティ/非機能要件変更は、SRE + セキュリティチーム + プロダクトオーナーを即時召集。  
- ドキュメントの未更新が原因で障害が発生した場合、ポストモーテムに本運用方針を見直すタスクを追加。

## 変更履歴
- YYYY-MM-DD: 初版作成 (PR # / 担当者)
- YYYY-MM-DD:

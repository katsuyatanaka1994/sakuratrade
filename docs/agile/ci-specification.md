# CI仕様書

- 作成者（Codex）:
- レビュアー（人間）:
- 最終更新日:
- スプリント / Issue:
- バージョン:
- 適用リポジトリ / サービス:
- 適用ブランチ: main / develop / feature-*
- 連絡先 (Slack / GitHub):

## 目的・スコープ
- 目的: このCIはプロダクトの品質とリリースフローを維持する。
- スコープ: 対象ワークフロー、含まれない領域、依存プロジェクトを明記。
- 除外: CI対象外のテストや手動手順。

## パイプライン概要
| パイプライン | 実行タイミング | カバー範囲 | 目標完了時間 |
| --- | --- | --- | --- |
| PRパイプライン | PR作成/更新時 | lint, unit, contract, smoke | <= 15分 |
| Nightly / Scheduled | cron (例: 02:00 JST) | integration-full, perf, security | <= 45分 |
| Release | リリースブランチに対して | e2e-full, migration-check | <= 60分 |
|  |  |  |  |

## トリガ & 条件実行ルール
| トリガ種別 | 条件 / ブランチ | 実行パイプライン / ジョブ |
| --- | --- | --- |
| PR (push) | target: main, develop | PRパイプライン |
| cron | `0 17 * * *` (UTC) | Nightly |
| changed-files | `db/migrations/**` を含む | integration-light 追加実行 |
| changed-files | `docs/agile/**` を含む | doc-validate / Draft PR 自動生成 |
| ラベル | `run-full-integration` | Nightlyジョブを手動キック |
|  |  |  |

## 主要ジョブ一覧
| ジョブ名 | カテゴリ | 必須 / 任意 | 概要 |
| --- | --- | --- | --- |
| lint-typecheck | lint | 必須 (PR) | ruff / mypy / eslint |
| unit-tests | test | 必須 (PR) | pytest / vitest |
| contract-check | contract | 必須 (PR) | OpenAPI diff, schema check |
| doc-validate | docs | 必須 (PR) | Markdown整形/必須欄チェック |
| integration-light | test | 条件付 (PR) | pytest -m integration_light |
| e2e-smoke | e2e | 必須 (PR) | Playwright smoke |
| integration-full | test | 任意 (Nightly) | pytest integration full |
| e2e-full | e2e | 任意 (Release/Nightly) | Playwright full suite |
| security-scan | security | 必須 (PR/Nightly) | SAST, Dependency scan |
| perf-test | performance | 任意 (Nightly) | k6 smoke perf |
|  |  |  |  |

## 各ジョブ定義
| 項目 | 内容 |
| --- | --- |
| ジョブ名 | 例: `unit-tests` |
| 目的 | モジュールレベルの回帰検知 |
| 実行コマンド | `pytest tests/unit -m "not slow"` |
| 所要時間目安 | <= 3分 |
| タイムアウト | 10分 |
| 再試行ポリシー | 失敗時1回自動リトライ / 無し |
| 並列化 | Yes (pytest -n auto) / No |
| アーティファクト | `tests/unit/junit.xml`, `.coverage` |
| 備考 | キャッシュ利用、依存パッケージバージョンなど |

> ジョブごとに上表のフォーマットで記入する。`doc-validate` は `scripts/format-docs && scripts/validate-agile-docs` を実行し、整形差分は Draft PR コメントで通知する。

## 環境設計
- 実行環境: GitHub Actions runner / self-hosted / docker-compose
- テスト用サービス: PostgreSQL 13, Redis 6 (docker-compose or Testcontainers)
- 必要な環境変数 / シークレット: `.env.ci` で管理
- fork PR 制約: シークレット非公開、限定ジョブのみ実行

## シークレット管理
- 保管先: GitHub Secrets / Hashicorp Vault
- 利用方針: OIDC +短期トークン, dotenv-linter
- ローテーション: 半期で更新 / イベントベース
- fork PR: read-only シークレット、危険ジョブスキップ

## アーティファクト / ログ
| 種別 | 保存内容 | 保存期間 | 保管場所 | 失敗時必須 |
| --- | --- | --- | --- | --- |
| テストレポート | junit.xml, coverage.xml | 14日 | GitHub Actions Artifacts | Yes |
| E2E | スクリーンショット, 動画 | 30日 | S3 / Artifact | Yes |
| ログ | docker logs, ci logs | 7日 | Log storage | Yes |
|  |  |  |  |  |

## 失敗時の扱い & 通知
- ブロッキング: lint, unit, contract, doc-validate, e2e-smoke, security-scan
- 通知: Slack `#ci-alert`, PagerDuty (Nightly/Release重大)
- 自動再試行: flakyタグ付きジョブのみ1回
- エスカレーション: On-call → SREリード → EM

## コスト制御
- PR向け最大目安時間: <= 15分
- 並列数上限: 4 (runner concurrency)
- Heavyジョブ: integration-full, perf-test は Nightly/Release に限定
- キャッシュ: node_modules, pip cache を活用

## メトリクス & モニタリング
- 取得指標: 平均実行時間、失敗率、flaky率、カバレッジ
- ダッシュボード: DataDog / Grafana (週次レポート)
- アラート閾値: 失敗率 > 5% で通知

## セキュリティ / コンプライアンス
- SAST/DAST/Dependency: security-scan ジョブで実施
- 重大脆弱性: 自動で `security-blocker` ラベル付与、CI失敗、即時対応
- 規制対応: GDPR / 個人情報保護法対象なら記載

## 変更管理
- CI定義変更は Pull Request 経由で実施
- レビュー要件: SRE / QA の承認必須
- ロールアウト: `ci-dev` ブランチで検証 → main に適用

## Runbook（インシデント対応）
| 事象 | 兆候 | 対処手順 | 連絡先 |
| --- | --- | --- | --- |
| 依存インストール失敗 | pip install error | キャッシュクリア → リトライ | @oncall |
| secret missing | Env not found | Secrets設定を確認、Vault抽出 | @sre |
|  |  |  |  |

## フレーク管理
- flaky 定義: 3回中1回以上失敗するテスト
- タグ付けルール: `@pytest.mark.flaky` / `test.flaky` label
- 自動再試行: 2回まで、再発時はチケット化 (JIRA PROJECT-123)

## 関連ファイル / リンク
- ワークフロー定義: `.github/workflows/*.yml`
- テスト仕様書: `docs/agile/unit-test-specification.md`, `docs/agile/integration-test-specification.md`, `docs/agile/smoke-e2e-specification.md`
- ダッシュボード: (URL)
- Runbook: `docs/runbooks/ci.md`

## 変更履歴
- YYYY-MM-DD: 初版作成 (PR # / 担当者)
- YYYY-MM-DD:

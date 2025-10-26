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

### DS-22: Node Playwright PoC
- トリガ: GitHub Actions `workflow_dispatch`（Branch: main）のみで手動実行し、URL入力は `https://example.com` をデフォルトとする。
- ランナー: `ubuntu-22.04` を固定（24.04 は Playwright 依存の整合が取れないため）。
- セキュリティ: URL は `env: URL_INPUT` 経由で Python ブリッジに渡し、`scripts/node_bridge.py` が http/https をバリデートする。
- 成功/失敗: `https://example.com` は成功し `screenshot.png` / `dom.html` を成果物として保存、`http://example.invalid` は非0終了で失敗とする。
- 併設ステップ: Env snapshot は実行環境ログ、Sanity launch は Playwright 起動確認、debug-list は成果物確認用リスト。
- アーティファクト: `ui-poc-artifacts` を Actions Artifacts に7日間保持する。

### DS-23: code-quality ワークフロー暫定運用
- GitHub Actions `.github/workflows/code-quality.yml` を PR トリガで常時実行し、Python (`ruff`/`mypy`/`pytest`) と Frontend (`tsc`/`eslint`/`npm test`) を別ジョブで走らせる。
- 既存負債と共存するため、ESLint は Flat Config の `globalIgnores` で `coverage/` や `tests/e2e/` 等を除外し、`no-explicit-any` など高頻度違反ルールは当面 `warn` に変更。段階的強化の TODO を別チケットで管理する。
- mypy は `requirements-dev.txt` に追加した `types-PyYAML` / `pandas-stubs` 等をインストールし、`mypy.ini` で `jaconv` の型不足を無視する設定を追加した。
- `docs-index-validate` 他の Required check は変更なし。docs-sync ブランチと `[skip docsync]` タイトルは `noop` ガードでスキップする。

### テスト構成と実行条件
- Unit（常時）: `python -m pytest -q -m "not integration"`
- Integration（任意・手動）: `python -m pytest -q -m "integration"`
  - 実行方法: GitHub Actions → Backend CI → Run workflow（`workflow_dispatch`）
- Required checks: Backend CI (unit), docsync-check, docs-index-validate, security-permissions-lint, nfr-xref

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

## DS-26: 無料プランにおける CI ソフトガード方針

### 目的
- **PR は軽く緑（No-Op）**、**本処理は push(main)**（＋必要時の **workflow_dispatch(main)**）でのみ実行。
- Private Free で Branch protection を強制できない制約下でも、**止まらない CI と可視化**を担保する。

### 設計（要点）
- Workflow: `.github/workflows/security-permissions-lint.yml`
  - **イベント分離**: `noop-pr`（`pull_request`）＝No-Op Success、`run-on-main`＝本処理。
  - **実行条件**: `run-on-main` は  
    `if: (event == push && ref == main) || (event == workflow_dispatch && ref == main)`  
    ※将来 `release/**` を守る場合は `branches` と `if` の両方を拡張。
  - **paths**: `on.push.paths = .github/workflows/**, scripts/**`（WF/スクリプト変更で本処理を再実行）
  - **permissions**: ルート `contents: read`、本処理ジョブのみ `contents: write`, `pull-requests: write`
  - **concurrency**: `group = ${{ github.workflow }}-${{ github.ref_name }}`, `cancel-in-progress: true`
  - **timeout**: `timeout-minutes: 15`
  - **出力**: `docs/agile/report.md` に追記。`docs/agile/.sec-review-row` が無い場合はフォールバック生成  
    **注意**: `report.md` は `on.push.paths` に含めない（**マージで再トリガーしない**）
  - **Create PR**: `peter-evans/create-pull-request` で `docs-sync/sec-review` を作成（`base: ${{ github.ref_name }}`, `labels: docsync:needs-apply`）

### 運用ルール
- マージ方式は **Squash** を基本
- PR テンプレ冒頭: **「CI確認：docs-index / nfr-xref / security-permissions-lint の3チェックが緑」**
- **DS-27 補強**  
  - docs 変更が無い場合はラベルを外した状態を維持し、自動で `docs:invalid` が付かないようにする。  
  - docs 変更かつ **いずれかの必須チェックが failure/timed_out/cancelled** または **workflow_run 自体が非 success** のときだけ `docs:invalid` を自動付与し Draft 化。  
  - docs 変更で全チェックが PASS（success/neutral/skipped/stale）になったら `docs:invalid` / `triage:urgent` を除去。pending/missing のみの間はラベルを外したまま待機し、「ステータスが緑なのに invalid」が起きないようにする。  
  - 取得エラーなどで docs 変更有無が判定できない場合はラベルを動かさず、安全側に現状維持。  
  - **即時フォールバック**: `docs:invalid` のまま merged なら Issue＋Slack/Webhook 通知  
  - （任意）週次監査で取りこぼし検出

### 受け入れ基準（Acceptance）
- PR作成: `noop-pr` が Success（サマリに「本処理は main push/dispatch」）
- `workflow_dispatch(main)`: `run-on-main` が **lint → report追記 → docs-sync PR作成** まで完走
- main への push でも同様に本処理が走る
- 連続実行で古い Run が **Cancelled**／新しい Run が **Success**
- `report.md` の運用（重複抑止はRun URLで判断 or レビューで確認）

### 将来の切替（Team/Pro へ移行時）
- `noop-pr` を廃止し、PR側で本処理を実行  
- Branch protection（Required checks）を有効化  
- 必要に応じて `branches` / `if` を `release/**` に拡張

### DS-27（github無料ソフトガード）最終仕様
- 合成判定（`validate` / `xref` / `noop-pr`）で `docs:invalid` と Draft を制御。docs 変更あり＋Failure 系結論（failure/timed_out/cancelled/action_required）や workflow_run 非 success のときだけ付与し、PASS 結論（success/neutral/skipped/stale）になったら除去する。pending/missing の間はラベルを外したまま待機して「エラーが無いのに invalid」が付く状況を無くす。
- 違反検知は **merged-only**。`docs:invalid` が付いたままマージされたPRを **soft-guard-alert** が検出し、Issue（＋Slack任意）を即時作成。
- 同名Issueは重複発行しない（idempotent）、同一PRの同時発火は concurrency で最新1件に抑制。
- 例外や取得失敗時は安全側で処理。docs 変更判定ができない場合はラベルを動かさず、チェック取得が失敗した場合は `docs:invalid` を維持する。

### DS-16: 失敗→可視化 / 成功→自動回復
- 対象: `docs-index-validate.yml`, `nfr-xref.yml`, `code-quality.yml`, `security-permissions-lint.yml`。
- 失敗時: 共通アクション `.github/actions/on-failure` が PR へコメント＆カテゴリ別ラベルを付与。既に同ラベルが付いている再失敗は `triage:urgent` で格上げする。
- 成功時: 上記ラベル（`docs:invalid` / `ci:fail` / `triage:urgent`）を自動除去し、`security-permissions-lint` は発行済みの `triage:urgent` Issue をクローズする。
- 権限: 追加ジョブは必要最小の `pull-requests: write` / `issues: write`（Issue 起票ジョブは `issues: write` のみ）。既存の No-Op や concurrency ガードは変更しない。
- Slack 通知は任意: `on-failure` の `slack-webhook` 入力を指定した WF から流用可能。
- docs:invalid の除去は pr-label-guard が総合判定で実施。一次WFは成功時に `triage:urgent` のみ除去して競合を回避。

# CI Impact Scan — WO-7 workorder failure escalation

## Updated assets
- `.github/workflows/workorder-ready.yml` に連続失敗カウンタと自動停止ロジックを追加。専用コメントで失敗履歴を保持し、閾値到達時に `workorder:suspended` ラベル付与・エスカレーションコメント・再実行停止を実施。
- `docs/agile/workorder.md` の MANUAL 節へ新ラベル運用の補足ログを追記。

## Triggers, contexts, permissions
- ワークフローのトリガー（`workflow_run` / `workflow_dispatch` / `push`）と権限設定は従来どおり。
- 新たに `WORKORDER_FAIL_THRESHOLD`（既定値2）、`WORKORDER_ESCALATION_LABEL`、`WORKORDER_ESCALATION_MENTION` のリポジトリ変数で連続失敗閾値と通知先を調整可能。

## Impact & guardrails
- 失敗時に PR 上へ専用コメント（`<!-- workorder-ready:failure-counter -->`）を更新し履歴を可視化。
- 閾値到達で `workorder:suspended` ラベルが自動付与され、`Resolve run context` で以降の自動実行を停止。復旧後はラベル解除で再開。
- エスカレーションコメントには連絡先（変数指定時）と直近失敗理由を記載し、人による介入を促す。

## Validation log
- `python3 -m scripts.workorder_cli validate`

---

# CI Impact Scan — WO-4 workorder guard & limits

## Updated assets
- `scripts/workorder_cli.py` で `workorder.limits` / `workorder.allowed_paths` / `workorder.blocked_paths` / `workorder.plan_links` の自動同期と JSON 出力 (`workorder_sync_plan.json`) を拡張。
- 新規 `scripts/workorder_guard.py` を追加し、Diff の許可パス／禁止パス／行数・ファイル数上限を評価してレポート (`tmp/workorder_limits_report.json`) を生成。
- `.github/workflows/workorder-ready.yml` にガード実行ステップ、レポート取込、Automation PR 上限制御、ランレポートのアーティファクト化、および各種既定値の env 配線を追加。
- テスト `tests/test_workorder_cli.py` / `tests/test_workorder_guard.py` を更新・新設し、CLI 同期とガード評価のユニットテストを整備。

## Triggers, contexts, permissions
- ワークフローのトリガー（`workflow_run` / `workflow_dispatch` / `push`）と権限は現行のまま。追加のスコープ要求なし。
- ガード失敗時は `workorder_ready` ジョブが即停止し、元 PR（`plan:sync` 発端）へコメントを返す。

## Impact & guardrails
- workorder CLI が plan 由来のタスクから許可パス／リミット／plan リンクを自動算出し、AUTO 節と JSON を常に整合させる。
- ガードは `workorder_sync_plan.json` の設定を読み込み、許可外パス・禁止パス・行数/ファイル数上限超過を検出すると PR コメント付きで停止する。
- `WORKORDER_MAX_AUTO_PRS` を越える `docs-sync/workorder` Open PR がある場合は自動同期を止め、元 PR へ抑止理由を通知する。
- ガード結果は `workorder-limits-report` アーティファクトに保存され、運用レビュー時にヒット理由を再確認できる。

## Validation log
- `venv/bin/python -m pytest tests/test_workorder_cli.py tests/test_workorder_guard.py`
- `python3 -m scripts.workorder_cli ready`

---

# CI Impact Scan — WO-3 workorder actions wiring

## Updated assets
- `.github/workflows/workorder-ready.yml` に plan-sync 実行元の判定を追加し、`plan:sync` ラベルなし run や `docs-sync/workorder` 自己発火をスキップするよう調整。
- `.github/workflows/workorder-validate.yml` に concurrency キュー、ラベル欠如時の reason 出力、ジョブサマリ整形・ログ存在チェックを追加。

## Triggers, contexts, permissions
- 既存のトリガー（pull_request / workflow_run / workflow_dispatch）と Required Check 名称は維持。追加の権限要求なし。

## Impact & guardrails
- plan-sync の自動発火（`pull_request_target`）で `plan:sync` ラベルが無い場合に ready ワークフローを実行せず、意図しない Draft PR 生成を抑止。
- `docs-sync/workorder` ブランチ起因の自己ループを検知して停止。
- `wo:ready/Validate` を PR 単位で直列化し、ドラフト／ラベル欠如の理由を Actions サマリに残す。
- ログ未生成時にアーティファクト/サマリで失敗しないよう存在チェックを挟み、ガードメトリクスを欠損させない。

## Validation log
- `python3 -m scripts.workorder_cli validate`

---

# CI Impact Scan — WO-1 workorder template scaffolding

## Updated assets
- `docs/agile/workorder.md` を MANUAL / AUTO に整理し、`workorder.limits` / `workorder.allowed_paths` / `workorder.blocked_paths` / `workorder.plan_links` の新規 AUTO 区画を追加。
- `docs/agile/README-agile.md` に workorder の AUTO 管理対象セクション一覧を追記。
- `docs/agile/auto-manual-boundary.md` に HYBRID （MANUAL＋AUTO）対象として plan/workorder/review を明示し、AUTO セクション名を列挙。

## Triggers, contexts, permissions
- CI ワークフローや Required Check の設定変更は無し。ドキュメント構造を整備したのみ。

## Impact & guardrails
- 今後 CLI / Actions から参照できる安全枠（リミット・パス制御・plan 連携）を文書化し、doc-validate で AUTO 節が保護される前提を用意。
- MANUAL 節と AUTO 節の境界を明示したことで、人の追記と Codex の自動同期が混ざらないように運用できる。
- 境界ルール（auto-manual-boundary）も同期したため、doc guard の監視対象から漏れない。

## Validation log
- `python3 -m scripts.workorder_cli validate`
- `python3 scripts/docs_index_validate.py`

---

# CI Impact Scan — PL-11 branch protection runbook cleanup

## Updated assets
- `docs/agile/runbooks/plan-branch-protection.md` の競合マーカーを解消し、CODEOWNERS 通知の扱いや Required Check の運用手順を現行設定に合わせて整備。

## Triggers, contexts, permissions
- ワークフローや Branch Protection 設定の変更は無し。ドキュメント更新のみ。

## Impact & guardrails
- オペレーション手順の齟齬を解消し、`plan-sync/Validate` 単独 Required / `wo:ready/Validate` 警告成功という前提を明文化。
- CODEOWNERS の通知運用とレビュー必須解除の意図を一本化し、運用者が UI 側設定とドキュメントを突き合わせやすくなる。

---

# CI Impact Scan — PL-10 runbook onboarding

## Updated assets
- `docs/runbooks/plan-sync.md` 新設。1分/3分ランブック、FAQ、運用チェックリストを収録。
- `docs/assets/plan-sync-run-ui.svg` / `plan-sync-guard.svg` / `plan-sync-checks.svg` を追加し、手順セクションにスクショを添付。
- `docs/agile/runbooks/README.md` にランブックへのリンクを追記。

## Triggers, contexts, permissions
- ワークフローや Required Check の設定に変更無し。ドキュメントのみの追加。

## Impact & guardrails
- オンボーディング時の参照先が一本化され、plan-sync 運用の手順漏れを防止。
- ガード失敗ケースの対処を FAQ 化し、`plan-limits-report.json` の確認や `manual-accept` 手順が明文化される。
- スクショ資産を `docs/assets/` に置いたため、差し替え時は README から辿れる。

---

# CI Impact Scan — PL-9 UI auto trigger

## Updated assets
- `.github/workflows/plan-sync.yml` (name: `plan-sync/Validate`)
  - Added pull_request_target triggers for `opened/reopened/synchronize/ready_for_review` to watch `docs/agile/ui-specification.md` changes.
  - Guarded by repo variable `PLAN_AUTO` (default `0`); automation only runs when the flag is `1`.
  - `Resolve run context` now inspects the PR diff for the UI spec path, honours `[skip plan]` / plan-branch self triggers, and emits `trigger_mode=auto` when auto-launching.
  - Introduced throttle ledger: comment marker `<!-- plan-sync:auto -->` keeps ISO timestamps, enforcing `PLAN_SYNC_AUTO_MAX_RUNS_PER_HOUR` (default `1`) within a 60-minute window (`PLAN_SYNC_AUTO_WINDOW_MINUTES`, default `60`).
  - New job env wiring exposes `PLAN_AUTO`, max-runs, and window length so operations can tune without editing the workflow.
- `docs/agile/runbooks/plan-sync-smoke.md`
  - Added subsection describing the auto-trigger flag, throttle behaviour, and the diagnostic comment to check when automation is skipped.

## Triggers, contexts, permissions
- Required status list unchanged (`plan-sync/Validate`, `wo:ready/Validate`). `PLAN_AUTO` governs whether extra pull_request_target events execute.
- Auto trigger shares the existing concurrency group (`docs-sync-plan-<PR>`), so manual `/plan sync` and label runs continue to queue serially per PR.
- Workflow permissions unchanged (`contents/pull-requests/issues: write`). Throttle ledger updates use the existing `github-actions[bot]` comment.

## Impact & guardrails
- Automation ignores PRs with `[skip plan]` in the title/body and the plan branch itself to avoid recursion loops.
- If the throttle window is saturated, the workflow exits early with `plan-sync skipped: auto trigger throttled`, keeping noise out of operations.
- The ledger comment surfaces the most recent ISO timestamps so operators can audit when the last auto launch occurred.
- Manual triggers (`plan:sync` label, `/plan sync`, `workflow_dispatch`) still function without touching the throttle ledger.
- 実機検証: Run #18988988218 → 自動起動＆コメント更新、Run #18989002413 → 連続更新で JSON 正常、Run #18989025833 → スロットリング抑止ログを確認。
- セキュリティ: fork 由来PRでは `auto trigger disallowed for forks` として自動起動を拒否（pull_request_target でのシークレット露出回避）。

---

# CI Impact Scan — PL-8 telemetry & weekly reporting

## Newly introduced assets
- `.github/workflows/plan-weekly-report.yml` (name: `plan-sync/Weekly Report`)
  - `on.schedule` every Monday 00:00 UTC (`cron: "0 0 * * MON"`), plus manual `workflow_dispatch` for reruns.
  - Permissions: `actions: read` (list workflow runs/artifacts), `contents: write` (commit report), `pull-requests: write` (open PR/comment), `issues: write` (digest comment fallback).
  - Runs `python3 scripts/plan_weekly_report.py` (7-day window) to collect telemetry, producing Markdown and a short digest file.
  - Ensures label `ops:report` exists (creates it if missing) and pushes updates via `peter-evans/create-pull-request@v6` on branch `reports/plan-weekly-${run_id}`.
  - Posts a digest comment (actions/github-script@v7) with key metrics when a PR is created; if the report is unchanged, workflow exits after logging "no PR required".
- `scripts/plan_weekly_report.py`
  - CLI that queries the GitHub REST API for `plan-sync.yml` runs within the lookback window (default 7 days) using `GITHUB_TOKEN`.
  - For each run, fetches run metadata (`run_started_at`, `updated_at`, `conclusion`, trigger, branch) and associated job steps to classify failure reasons.
  - Downloads the `plan-limits-report` artifact (expects `plan_limits_report.json`) to extract `preflight.no_op`, guard hits, and diff stats.
  - Emits Markdown (`reports/plan-sync-report.md`) with a one-page weekly summary plus a short digest text file consumed by the workflow comment step.
- `reports/plan-sync-report.md`
  - Living weekly report regenerated by the script; anchored under `reports/` to keep automation artefacts out of `docs/agile/**`.
  - Maintains a rolling section per week (latest block replaces/updates the top of the file).
- `tests/test_plan_weekly_report.py`
  - Unit-test coverage for the summariser: No-Op rate, failure aggregation, lead-time maths, Markdown rendering fallbacks.

## Triggers, contexts, permissions
- Weekly workflow depends on `plan-sync/Validate` still uploading `plan-limits-report` artifacts; missing/expired artifacts mark the run as `data_missing` and exclude it from metrics (but still logged).
- Requires `GITHUB_TOKEN` with `actions:read` scope; current implementation uses the default `GITHUB_TOKEN` for PR creation (no GitHub App).
- No new Required Status contexts; Branch Protection remains unchanged (`plan-sync/Validate`, `wo:ready/Validate`).

## Impact & guardrails
- Script enforces a hard lookback window—runs older than 7 days are ignored to keep the report bounded.
- Failure reasons bucketised from job step names (`Handle guard outcome`, `Enforce automation PR ceiling`, `Validate plan diff`, etc.) so the operations team can see top offenders quickly.
- Lead time computed via `run_started_at` → `updated_at` delta; runs missing either timestamp are flagged and excluded from the average.
- Digest comment shares the headline metrics (run counts, No-Op rate, top failure) to reduce reviewer toil when triaging the PR.
- If zero eligible runs are found, the Markdown still reports "no eligible runs"; subsequent workflow invocations that produce identical output result in no-op (no PR).

---

# CI Impact Scan — PL-7 guard rails

## Updated assets
- `.github/workflows/plan-sync.yml` (name: `plan-sync/Validate`)
  - Job-level env defaults for new guard variables:
    - `PLAN_SYNC_ALLOWED_PATHS` (default `docs/agile/**,docs/specs/**,docs/tests/**,.github/workflows/**,backend/app/openapi.yaml`).
    - `PLAN_SYNC_BLOCKED_PATHS` (default `docs/secrets/**`).
    - `PLAN_SYNC_MAX_CHANGED_LINES` (default `300`).
    - `PLAN_SYNC_MAX_CHANGED_FILES` (default `4`).
    - `PLAN_SYNC_MAX_OPEN_AUTOMATION_PRS` (default `2`).
    - `PLAN_SYNC_RUN_REPORT` (`tmp/plan_limits_report.json`).
  - `Run plan preflight & apply` step runs with `continue-on-error` and writes the report.
  - New guard step **Handle guard outcome** (actions/github-script@v7) posts a PR comment + fails the job when
    - blocked paths were detected in preflight, or
    - line/file ceiling was exceeded in apply.
  - New guard step **Enforce automation PR ceiling** (actions/github-script@v7) stops execution when open automation PRs (`head: docs-sync/plan`) reach the configured ceiling; posts message back to source PR.
  - Subsequent PR creation step is gated on the ceiling guard succeeding.
- `scripts/plan_cli.py`
  - Preflight now honors allow/block lists and records status in the run report. Blocked paths raise immediately; disallowed paths mark the run as No-Op.
  - Apply writes plan updates, then enforces diff ceilings (lines/files) using `_collect_diff_stats()`.
  - Guard metadata is written to `${PLAN_SYNC_RUN_REPORT}` for workflow hooks.
- `tests/test_plan_limits.py` new unit tests for pattern matching & diff stats helper.

## Triggers, contexts, permissions
- Trigger matrix for `plan-sync/Validate` unchanged (`workflow_dispatch` / `pull_request_target` labeled `plan:sync` / PR comments `/plan sync`).
- Required status contexts remain `plan-sync/Validate` (main) and `wo:ready/Validate` (warning only).
- Workflow permissions untouched (`contents: write`, `pull-requests: write`, `issues: write`).

## Guardrail summary
- **Allowlist / block list**: enforced via `PLAN_SYNC_ALLOWED_PATHS` and `PLAN_SYNC_BLOCKED_PATHS`; disallowed paths convert the run into a No-Op, blocked paths halt with failure.
- **Line & file ceilings**: defaults 300 lines / 4 files; overridable via repo variables.
- **Automation PR ceiling**: default max 2 concurrent `docs-sync/plan` PRs (`PLAN_SYNC_MAX_OPEN_AUTOMATION_PRS`).
- **Run report**: `tmp/plan_limits_report.json` captures preflight/apply status for job-level handlers and future telemetry (No-Op flag, limit hits).

## Follow-up signals
- If report JSON is missing or malformed, `Handle guard outcome` fails the job with a diagnostic.
- When ceilings are hit, PR comments begin with `🛑 plan-sync stopped…` so they can be searched for operations review.

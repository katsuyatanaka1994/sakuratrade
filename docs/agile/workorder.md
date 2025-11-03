# 作業指示（Work Order）

> plan.md のタスクを実装タスクへ橋渡しするための中継ドキュメント。MANUAL 節は人が判断を追記し、AUTO 節は Codex が同期する。

## MANUALレイヤー（人の判断・意図）

### 概要
- 対象タスク：
- 完了条件（DoD）：

### 手順
1.
2.

### 補足ログ
- relnotes test B @2025-10-24_11:59:15
- workorder-ready 自動停止: 連続失敗が既定閾値（リポジトリ変数で調整可、初期値2回）に達すると `workorder:suspended` ラベルとエスカレーションコメントを付与し、ラベル解除まで自動実行を停止。

## AUTOレイヤー（Codex管理セクション）
> Codex は以下の `<!-- AUTO:BEGIN --> ... <!-- AUTO:END -->` 範囲のみを書き換える。MANUAL 節は人が保守する。

### メタデータ（DocSync管理）
<!-- AUTO:BEGIN name=workorder.meta -->
- plan_snapshot_id: aae60b595a15600d7573d9beda34dae8b5529479f695648a450fc94994b6d2fb
- Doc ID: workorder
- Updated at: 2025-11-03T14:38:37+09:00
- Tasks: []
<!-- AUTO:END -->

### LIMITS — 自動実装のガード設定
<!-- AUTO:BEGIN name=workorder.limits -->
max_changed_lines:
  per_task: 80
  per_pr: 120
  per_file: 80
max_changed_lines_per_iter: 60
max_total_changed_lines: 180
max_changed_files: 6
max_open_automation_prs: 2
retry_guard:
  max_iterations: 3
  stop_reasons:
    - checks_green
    - no_patch
    - limit_exceeded
<!-- AUTO:END -->

### ALLOWED PATHS — 自動実装が触れてよい領域
<!-- AUTO:BEGIN name=workorder.allowed_paths -->
- docs/agile/workorder.md
- workorder_sync_plan.json
<!-- AUTO:END -->

### BLOCKED PATHS — 禁止領域
<!-- AUTO:BEGIN name=workorder.blocked_paths -->
- alembic/**
- infra/**
- migrations/**
<!-- AUTO:END -->

### PLAN LINKS — plan.md との整合ポイント
<!-- AUTO:BEGIN name=workorder.plan_links -->
plan_snapshot_id: aae60b595a15600d7573d9beda34dae8b5529479f695648a450fc94994b6d2fb
sources:
  -
    doc: docs/agile/plan.md
    sections:
      - plan.meta
      - plan.tasks
tasks: []
<!-- AUTO:END -->

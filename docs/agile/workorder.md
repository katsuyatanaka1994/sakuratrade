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

## AUTOレイヤー（Codex管理セクション）
> Codex は以下の `<!-- AUTO:BEGIN --> ... <!-- AUTO:END -->` 範囲のみを書き換える。MANUAL 節は人が保守する。

### メタデータ（DocSync管理）
<!-- AUTO:BEGIN name=workorder.meta -->
- plan_snapshot_id: a2d0544958f8cb06a172c4a2bdfb609c1d75149ef0b8f93aea16bfc0a5e5d382
- Doc ID: workorder
- Updated at: 2025-11-01T11:21:26+09:00
- Tasks:
    -
      id: U-positions-page-update
      refs:
        - ui-spec:positions-page
      outputs:
        - frontend/src
      acceptance:
        max_changed_lines: 80
        checks:
          - name: frontend-tsc
            command: npx --prefix frontend tsc --noEmit
          - name: frontend-eslint
            command: npx --prefix frontend eslint src --max-warnings=500 --quiet
          - name: frontend-vitest
            command: npm --prefix frontend run test:run -- --passWithNoTests
      gate:
        []
      deps:
        []
      risk: 低
      rollback: 前バージョンのUIを再適用
<!-- AUTO:END -->

### LIMITS — 自動実装のガード設定
<!-- AUTO:BEGIN name=workorder.limits -->
max_changed_lines:
  per_task: 80
  per_pr: 120
  per_file: 80
max_changed_lines_per_iter: 60
max_total_changed_lines: 180
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
- frontend/src/**
<!-- AUTO:END -->

### BLOCKED PATHS — 禁止領域
<!-- AUTO:BEGIN name=workorder.blocked_paths -->
- alembic/**
- infra/**
- migrations/**
<!-- AUTO:END -->

### PLAN LINKS — plan.md との整合ポイント
<!-- AUTO:BEGIN name=workorder.plan_links -->
plan_snapshot_id: a2d0544958f8cb06a172c4a2bdfb609c1d75149ef0b8f93aea16bfc0a5e5d382
sources:
  - doc: docs/agile/plan.md
    sections:
      - plan.meta
      - plan.tasks
tasks:
  - id: U-positions-page-update
    refs:
      - ui-spec:positions-page
    outputs:
      - frontend/src
<!-- AUTO:END -->

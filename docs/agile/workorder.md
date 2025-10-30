# 作業指示（Work Order）

## 概要（MANUAL）
- 対象タスク：
- 完了条件（DoD）：

<!-- AUTO:BEGIN name=workorder.meta -->
- plan_snapshot_id: a2d0544958f8cb06a172c4a2bdfb609c1d75149ef0b8f93aea16bfc0a5e5d382
- Doc ID: workorder
- Updated at: 2025-10-30T07:24:25+09:00
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

## 手順（MANUAL）
1.
2.

- relnotes test B @2025-10-24_11:59:15

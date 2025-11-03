# プロジェクト計画（Plan）

> 仕様（UI/API/テスト/CI）の変更を実行タスクへ変換し、スプリント計画を一元管理する 単一の信頼できる情報源（Single Source of Truth）。

## MANUALレイヤー（人の判断・意図）

### スプリントサマリ
- 目的／背景：
- スコープ：
- 非スコープ：
- マイルストーン：

### Notes（MANUAL）
- 仕様上の判断・補足・TODO を記録する。

### DoD（完了条件）
- [ ] Unit / Integration / Smoke テストが合格している。
- [ ] 観測性（`metric` / `log`）が整備されている。
- [ ] a11y / 性能予算の基準を満たしている。

### 補足ログ
- relnotes test A @2025-10-24_11:57:42
- relnotes auto-merge smoke @2025-10-24_12:35:43

## AUTOレイヤー（Codex管理セクション）
> Codex は以下の `<!-- AUTO:BEGIN --> ... <!-- AUTO:END -->` 範囲のみを書き換える。

### メタデータ（DocSync管理）
<!-- AUTO:BEGIN name=plan.meta -->
- plan_snapshot_id: aae60b595a15600d7573d9beda34dae8b5529479f695648a450fc94994b6d2fb
- Doc ID: plan
- Updated at: 2025-11-03T05:40:27+00:00
- Related PRs: []
<!-- AUTO:END -->

### INPUTS — 参照した仕様と SPEC ハッシュ
<!-- AUTO:BEGIN name=plan.inputs -->
- name: ui-specification
  path: docs/agile/ui-specification.md
  checksum: 9d61ea43038986a2a80a0dd99af08a12e64ab68b146f7feba6b70c79382f3608
- name: openapi
  path: backend/app/openapi.yaml
  checksum: 0ede478c5df2710dbd42251288ce56a550ee7291740c39f36819a363cf09fac0
- name: test-specs
  path: docs/tests
  checksum: d7644ad725cd025cde47705f2e11eff5ddeb9683e57edf7be3c16bcc49493343
<!-- AUTO:END -->

### OUTPUTS — 対象ファイルと plan_snapshot_id
<!-- AUTO:BEGIN name=plan.outputs -->
plan_snapshot_id: aae60b595a15600d7573d9beda34dae8b5529479f695648a450fc94994b6d2fb
targets:
  modify:
    - docs/agile/plan.md
    - docs/agile/ui-specification.md
    - docs/agile/workorder.md
<!-- AUTO:END -->

### TASKS — 下流が参照する唯一の実行タスク集合
<!-- AUTO:BEGIN name=plan.tasks -->
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

## 運用ガイド（MANUAL）

### 標準フロー（人 ↔ Codexの役割分担）
1. **仕様更新 & 自己レビュー（preflight）** — Codex が `docs/agile/**` / `docs/specs/openapi.yaml` / `docs/tests/**` を更新し、構文・整合性・横断変更を点検する。
2. **Draft PR 自動作成 / 更新** — preflight 合格で Codex がブランチ作成し、Draft PR を起票・更新（概要/影響/次アクションを本文に追記）。
3. **PRレビュー（修正ラリー）** — 人が妥当性レビューを行い、Codex が指摘を反映して仕様を再生成。
4. **人ゲート** — 承認後に人が `plan:sync` ラベルを付与（Draft解除も人が判断）。
5. **plan.md 自動同期（AUTO更新）** — Actions がガード通過後に `INPUTS / OUTPUTS / TASKS` を再生成（MANUAL保護・冪等・分割提案・横断検知）。
6. **最終確認 → マージ** — 生成タスク・分割提案・DoD を確認し、ステータス Green で Squash & Merge。

### 自動同期ガード
- Draftではない／Approve（≥1）あり／Changes requestedなし。
- `plan:sync` ラベルが付与されている。
- 対象パス（`docs/agile/**`, `docs/specs/openapi.yaml`, `docs/tests/**`, `.github/workflows/**`）に差分がある。

### タスク設計ルール
- 垂直スライス最小（目安：0.5〜1日）。`>80行 or >2ファイル` の変更は分割提案が必須。
- 1PR=1task 原則（実装PRは基本1タスク単位で起票）。
- `id` 命名: `<カテゴリ>-<機能キー>-<アクション>[@vX]` 例：`U-positions.table-core`, `A-positions.POST`。
- 由来固定：UI→`ui-spec#section`／API→`openapi:METHOD:PATH`／Tests→`integration|smoke:flow`。AUTO `TASKS` の `id` は下流にそのまま継承される。
- 必須フィールド：`refs / outputs / acceptance / gate / deps / risk / rollback`（`owner` は任意記入）。
- 受入制約モデル：`acceptance.max_changed_lines`（タスク上限）と `acceptance.checks`（必須テスト／lint）の定義を含め、workorder/review がそのまま参照できる構造で出力する。
- 横断検知（DB・認可/認証・Feature Flag・外部連携・NFR）は強制分割/再分類。
- 仕様から消えた `id` は `deprecated: true` とし、1スプリント後に削除する。

### acceptance.checks（最低ライン）

| タスク軸 / 代表outputs | 必須コマンド例 | 備考 |
| --- | --- | --- |
| Backend / API (`A-*`, `app/**`, `scripts/**`, `backend/app/**`) | `ruff check {{python_targets}}`<br>`mypy {{python_targets}}`<br>`pytest -q {{pytest_target}} -m "not integration"`<br>`make oas-lint`（OpenAPI変更時） | 仮想環境上で実行。pytestはDB不要のスライスに限定し、integration系は scope 外扱い。 |
| Frontend / UI (`U-*`, `frontend/**`) | `npx --prefix frontend tsc --noEmit`<br>`npx --prefix frontend eslint {{eslint_targets}} --max-warnings=500 --quiet`<br>`npm --prefix frontend run test:run -- {{vitest_target}} --passWithNoTests` | ESLintは警告過多のため `--quiet`＋`--max-warnings` で許容幅を確保。Vitestは対象specに絞り、ログ抑制には `--reporter=default` 等を併用。 |
| Tests QA (`T-*`, `tests/**`, `app/tests/**`) | `pytest -q {{pytest_target}} -m "not integration"`<br>`npm --prefix frontend run test:run -- {{vitest_target}} --passWithNoTests` | 新規・修正テストのみを直接叩く。フロントエンド分はVitest、バックエンド分はpytestで実行。 |
| Docs / Specs (`D-*`, `docs/**`, `docs/specs/openapi.yaml`) | `python scripts/docsync_diff.py`<br>`make oas-lint`（OpenAPI差分がある場合） | DocSync整合を確認。スペック差分はOpenAPIバリデーションまでを最低ラインとする。 |

> `{{python_targets}}` や `{{vitest_target}}` には `outputs` / `refs` から導いた最小スコープ（例：`app/services/foo.py`、`src/components/__tests__/foo.test.tsx`）を埋める。追加のhealthチェックが必要な場合はここに追記し、workorder/review 側は同フィールドをそのまま実行する想定。

### DoR / DoD 定義
- **DoR（着手条件）**：`T-unit`（仕様化テスト）が定義され、`gate` が空でない。
- **DoD（完了条件）**：Unit / Integration / Smoke の合格、観測性（`metric` / `log`）、a11y / 性能予算の達成。

### 冪等性・MANUAL保護
- 実質差分ゼロならコミットしない（履歴を汚さない）。
- MANUAL差分が発生した場合は警告＋復旧導線で通知し、`manual-accept` 運用で合意形成する。

### ステータスチェック
- `plan-sync/Validate`：AUTO存在・SPEC指紋一致（`plan_snapshot_id` の一致検査を含む）。
- PRテンプレートの確認欄でも同項目をチェックして二重化する。

### 権限・前提
- 直プッシュ禁止。ブランチ保護で PR 必須とし、Required checks に `plan-sync/Validate` を設定。
- Actions 権限は Settings → Actions → Workflow permissions を **Read and write** に設定。
- `plan.md` 更新で自己再起動しないよう `paths-ignore` を設定する。

### Notion チェックリスト
- [ ] Codex が仕様更新＆preflightに合格。
- [ ] Codex が Draft PR を自動起票 / 更新。
- [ ] 人が Approve → `plan:sync` を付与。
- [ ] AUTO（`INPUTS / OUTPUTS / TASKS`）再生成／分割提案・横断検知を確認（`plan_snapshot_id` 付与を含む）。
- [ ] `plan-sync/Validate` Green → Squash & Merge。

### 一言まとめ
`plan.md` は「仕様 → 実行タスク」の自動変換点。Codex が Draft PR 作成〜AUTO同期を担い、人は意図・判断・承認に集中する。

# DS-14 plan-sync スモーク手順（PL-4）

## 目的
- UI仕様の軽微な更新から `docs/agile/plan.md` の AUTO 範囲を再生成し、`plan_snapshot_id` が更新されることを確認する。
- `codex-docsync plan` CLI（preflight/apply/validate）の実行フローを整備し、Draft PR へ安全に引き渡す準備を整える。

## トリガー
- UI仕様に 1 行程度の微修正を入れ、`plan:sync` ラベル運用をスモークしたいとき。
- 初回導入時や CLI 更新直後に、plan 同期の一連フローを点検したいとき。

## 手順（ローカル検証）
1. 対象ブランチを checkout（例: `feature/pl-4-smoke-e2e`）。
2. `docs/agile/ui-specification.md` の MANUAL 節に 1 行の変更を入れる（例: `## 受け入れ基準` の箇条書きを更新）。
3. `python3 scripts/plan_cli.py preflight` を実行し、`doc_sync_plan.json` が生成されて `ui_spec_manual` トリガーが検出されることを確認。
4. `python3 scripts/plan_cli.py apply` を実行し、`plan_snapshot_id`・`targets.modify`・`TASKS` が更新されたことを `git diff docs/agile/plan.md` で確認。
5. `python3 scripts/plan_cli.py validate` を実行し、`docs/agile/plan.md: OK` が表示されることを確認。
6. `git diff docs/agile/ui-specification.md docs/agile/plan.md` を確認し、問題なければ Draft PR 用にコミットする。

### Workorder 連携のサニティチェック（PL-5 以降）
1. plan 側の差分が確定したら `python3 -m scripts.workorder_cli ready` を実行し、`docs/agile/workorder.md` と `workorder_sync_plan.json` が更新されることを確認する。
2. `python3 -m scripts.workorder_cli validate` を実行し、`docs/agile/workorder.md: OK` が表示されれば plan と workorder の指紋が一致している。
3. `python3 -m scripts.workorder_cli pr` で Draft PR 作成の推奨手順とタスク要約を確認し、plan_snapshot_id を控える。
4. `git diff docs/agile/workorder.md workorder_sync_plan.json` を確認し、タスク ID と `plan_snapshot_id` が期待通りに反映されているかチェックする。
5. No-Op だった場合は CLI の標準出力にその旨が表示される。必要に応じて `plan_cli.py preflight` の再実行やトリガ差分の確認を行う。

## 手順（GitHub Actions 連携）
1. Draft PR に `plan:sync` ラベルを付与する（または Actions → `plan-sync` → **Run workflow** を実行）。
2. Workflow が `plan preflight → apply → validate → pr` の順で完走し、固定ブランチ上に Draft PR が生成されることを確認。
3. `plan-sync/Validate` チェックが Green であることを PR の Required Check で確認。
4. 必要に応じて `doc_sync_plan.json` や CLI 出力を PR コメントへ貼り、レビューに共有する。
5. 元PRに `plan-sync: #<番号>` コメントが追加され、`[plan-sync] docs: update plan auto sections` Draft PR が生成されていることを確認。
6. Draft PR 本文に Trigger / Source ref / Source PR が表示され、`doc_sync_plan.json` に `ui_spec_manual` トリガーが含まれていることを確認。

## 自動トリガ（PL-9）
- リポジトリ変数 `PLAN_AUTO=1` で有効化すると、`docs/agile/ui-specification.md` を含む PR が `opened / synchronize / ready_for_review / reopened` されたタイミングで `plan-sync/Validate` が自動起動する。
- デフォルトは `PLAN_AUTO=0`（自動発火OFF）。本番展開時に明示的に 1 へ切り替える。
- 自動起動対象は **同一リポジトリの PR** のみ（fork からの PR は `auto trigger disallowed for forks` としてスキップされる）。
- 直近 60 分間（`PLAN_SYNC_AUTO_WINDOW_MINUTES` で調整可）に `PLAN_SYNC_AUTO_MAX_RUNS_PER_HOUR`（既定値 1）を超えて起動した場合はスロットリングされ、Actions ログに `auto trigger throttled` と表示される。
- 自動起動時は PR に `<!-- plan-sync:auto --> …` コメントが更新され、直近の実行タイムスタンプとウィンドウ内の回数を確認できる。
- PR タイトル/本文に `[skip plan]` を含める、または plan 固定ブランチ（`docs-sync/plan`）の場合は自動起動を抑止する。

## 合格ライン
- `docs/agile/plan.md` の `plan_snapshot_id` が更新され、`targets.modify` に今回変更したファイルが含まれている。
- `plan.tasks` に対象 UI セクション（例: `ui-spec:positions-page`）へリンクしたタスクが出力されている。
- `scripts/validate-agile-docs` がエラーなく終了している。
- Draft PR に `INPUTS / OUTPUTS / TASKS` の差分が含まれており、レビュー観点をカバーしている。
- `[plan-sync] docs: update plan auto sections` Draft PR の本文に Trigger / Source ref / Source PR が記載されている。
- `doc_sync_plan.json` に `ui_spec_manual` / `docs_ci_changed` などのトリガーが記録されている。

## トラブルシュート
- `preflight` が No-Op → git diff に `docs/agile/ui-specification.md` が含まれているか確認。空白のみの変更は無視される。
- `validate` が失敗 → `scripts/validate-agile-docs --allow-manual-diff --manual-diff-report tmp/manual.diff` で MANUAL 節の差分を確認。
- Workflow が止まる → Actions の権限が **Read and write** になっているか、固定ブランチに push 権限があるか確認。

## 運用クローズ（現行設定メモ）
- Required Check は `plan-sync/Validate` のみ（`wo:ready/Validate` は未ラベル時に警告で成功）。
- DocSync 自動PRには `plan:sync` ラベルが自動付与される。
- `plan-sync` ワークフローは PR 単位の concurrency（queue）と `--force-with-lease` push を徹底。
- Merge 後は `main/post-merge-smoke` が 60 秒監視で衝突痕 / `.py` 差分 / 生成物サイズをチェックする。
- Guard デフォルト: LINES=300 / FILES=4 / AUTO_PRS=2 / ALLOW=docs/agile/**, docs/specs/**, docs/tests/**, .github/workflows/**, backend/app/openapi.yaml。

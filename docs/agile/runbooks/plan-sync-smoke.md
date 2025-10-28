# plan-sync スモーク手順（PL-4）

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

## 手順（GitHub Actions 連携）
1. Draft PR に `plan:sync` ラベルを付与する（または Actions → `plan-sync` → **Run workflow** を実行）。
2. Workflow が `plan preflight → apply → validate → pr` の順で完走し、固定ブランチ上に Draft PR が生成されることを確認。
3. `plan-sync/Validate` チェックが Green であることを PR の Required Check で確認。
4. 必要に応じて `doc_sync_plan.json` や CLI 出力を PR コメントへ貼り、レビューに共有する。

## 合格ライン
- `docs/agile/plan.md` の `plan_snapshot_id` が更新され、`targets.modify` に今回変更したファイルが含まれている。
- `plan.tasks` に対象 UI セクション（例: `ui-spec:positions-page`）へリンクしたタスクが出力されている。
- `scripts/validate-agile-docs` がエラーなく終了している。
- Draft PR に `INPUTS / OUTPUTS / TASKS` の差分が含まれており、レビュー観点をカバーしている。

## トラブルシュート
- `preflight` が No-Op → git diff に `docs/agile/ui-specification.md` が含まれているか確認。空白のみの変更は無視される。
- `validate` が失敗 → `scripts/validate-agile-docs --allow-manual-diff --manual-diff-report tmp/manual.diff` で MANUAL 節の差分を確認。
- Workflow が止まる → Actions の権限が **Read and write** になっているか、固定ブランチに push 権限があるか確認。

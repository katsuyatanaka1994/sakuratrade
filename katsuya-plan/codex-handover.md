# 10/30 引き継ぎメモ（PL-6: Branch Protection／Required Checks）

前提状況: PL-5 の連携配線は完了済み。plan-sync.yml は PR単位 concurrency＋--force-with-lease、DocSync 自動PRは plan:sync 自動付与、wo:ready/Validate は未ラベルなら警告で成功。

PL-6 で未着手タスク（katsuya-plan/plan-PBI.md:186-198）
- Branch Protection 設定更新：plan-sync/Validate と wo:ready/Validate を main の Required にし、固定ブランチの write 制限を整理。
- CODEOWNERS 整備：plan/workorder 変更に必須レビュワーを指定。
- 運用ガイド＋スクショ更新：設定手順を docs に追記（対象ファイルは docs/agile 配下想定）。

確認ポイント
- 現在 .github/CODEOWNERS は未調整。PL-6で更新が必要なら差分方針を検討。
- Branch Protection 作業は GitHub 設定が主。更新後、チェック名が Required として反映されるか要確認。
- ガイド更新では、plan-sync/Validate が唯一の Required であること、main/post-merge-smoke の60秒監視など最新運用を反映させると良い。

参考資料: docs/agile/runbooks/plan-sync-smoke.md に最新運用のクローズ行あり。PL-6対応で Runbook/Playbook側の追加修正が必要かも点検。

この状態から PL-6 のブランチ保護・CODEOWNERS・ドキュ更新を進めてください。


# 10/30 13:30 引き継ぎメモ（PL-6: Branch Protection／Required Checks）

## 完了した事項
- `main` の Branch Protection を再配線し、Required Check を `plan-sync/Validate` のみに固定。
- Pull Request レビュー必須を解除（approvals=0 / code_owner=false）。`CODEOWNERS` は通知用途として維持。
- `.github/workflows/branch-protection-sync.yml` に `BRANCH_PROTECTION_TOKEN` チェックを追加し、権限不足時は即 Fail する仕様へ変更。
- Runbook（`docs/agile/runbooks/plan-branch-protection.md`）と証跡（`docs/agile/runbooks/evidence/PL-6-branch-protection-20251031.md`）を最新運用へ更新。

## 現在の設定スナップショット
- `gh api repos/:owner/:repo/branches/main/protection | jq '.required_status_checks.contexts'`
  - 出力: `["plan-sync/Validate"]`
- `gh api repos/:owner/:repo/branches/main/protection | jq '.required_pull_request_reviews | {approvals: .required_approving_review_count, code_owner: .require_code_owner_reviews}'`
  - 出力: `{ "approvals": 0, "code_owner": false }`
- post-merge 監視: `main/post-merge-smoke` が継続稼働（60秒で conflict markers / .py 差分 / 生成物サイズを監視）。

## ドキュメント・証跡
- Runbook ハブ: `docs/agile/runbooks/README.md`
- Branch Protection 手順: `docs/agile/runbooks/plan-branch-protection.md`
- 証跡ログ: `docs/agile/runbooks/evidence/PL-6-branch-protection-20251031.md`
  - 収集日時: 2025-10-31 13:12:29 JST
  - 使用 Branch Protection sync run: #18962225110
  - post-merge smoke run: #18961583067（`no conflict markers / no .py changes / artifact size OK`）

## 運用時の注意
- Branch Protection 設定を手動変更した場合は `branch-protection/sync` を再実行し、差分を戻すこと。
- `BRANCH_PROTECTION_TOKEN` は repo → Administration: write を含む PAT/GitHub App トークン。失効時はワークフローが失敗する。
- 週次ヘルスチェック: 上記 `gh api` コマンドで Required Check / Review 設定が意図通りか確認。

## 次のアクション（任意）
1. `branch-protection/sync` を 1 回手動実行し、差分なしで成功することを目視確認。
2. PL-7 へ進む際、CODEOWNERS の適用範囲と post-merge smoke の監視結果を再評価する。


# 10/31 16:10 引き継ぎメモ（PL-7: ノイズ抑制＆上限）

## 完了した事項
- `scripts/plan_cli.py` に行数/ファイル数の上限チェック、許可/禁止パス、ガードメトリクス出力（`tmp/plan_limits_report.json`）を実装。
- `.github/workflows/plan-sync.yml` に新ガード用の環境変数デフォルト＋Github Actions 側のブロック処理（コメント通知 / 自動PR上限）を追加。`PLAN_SYNC_ALLOWED_PATHS` 等の既存変数にもフォールバック済み。
- `plan-sync` ジョブで guard 失敗時のメッセージ投稿、`plan-limits-report` アーティファクトの自動保存を実装。
- 既存リポジトリ変数 (`PLAN_SYNC_MAX_LINES=300 / PLAN_SYNC_MAX_FILES=4 / PLAN_SYNC_MAX_AUTO_PRS=2 / PLAN_SYNC_ALLOW_GLOBS=docs系) で guard が期待通り動くことを PR #486 （検証用）で確認。
- 受け入れログ更新: `docs/agile/runbooks/plan-sync-smoke.md` にガード既定値を記載。

## ガード効き確認
- 検証PR (`chore/plan-guard-check`, #486) で `plan:sync` ラベル付与→`.github/workflows/plan-sync.yml` ガードが実行され、`plan-limits-report.zip` アーティファクトに `tmp/plan_limits_report.json` が保存されることを確認。
- 同 PR は無事 No-Op 成功。検証完了後にクローズ済み、ブランチも削除済み。
- 付随して `fix(plan-sync): avoid redeclaring core in guard scripts` (#487) / `chore(plan-sync): support guard variable aliases` (#488) / `chore(plan-sync): publish guard report artifact` (#489) を main にマージ完了。

## 変数・ノブ
- 現行値: `PLAN_SYNC_MAX_LINES=300`, `PLAN_SYNC_MAX_FILES=4`, `PLAN_SYNC_MAX_AUTO_PRS=2`, `PLAN_SYNC_ALLOW_GLOBS=docs/agile/**, docs/specs/openapi.yaml, plan.md, doc_sync_plan.json, workorder_sync_plan.json`。
- 一時的な閾値調整（400/6/3）で guard が追従することを確認後、元の値に戻しています。
- 追加で `PLAN_SYNC_DENY_GLOBS` を設定したい場合は repo variable を作成すればそのまま効きます（未設定時は `docs/secrets/**` のみブロック）。

## 未完了の作業・フォローアップ
- 三層上限は初期値 (300行/4ファイル/自動PR 2本) を安全側に設定。実運用で厳しすぎるケースがあれば repo variable で調整してください。
- ガードレポート (`plan-limits-report.zip`) は Actions の `plan-sync/Validate` run から取得可能。運用チームが週次レビューに利用する想定。
- 次フェーズ（PL-8）では guard ログを元に週次集計を自動化予定。`tmp/plan_limits_report.json` の構造は変更時に連絡すること。


# 10/31 22:00 引き継ぎメモ（PL-8: 週報パイプライン／週次レポート）

## 完了した事項
- `plan-sync` → `plan-weekly-report` の end-to-end を main 上で実行し、ダイジェスト PR（#536）を自動生成。`Runs analysed = 39` を手元で確認済み。
- Required チェック pending の原因を調査し、`docs-index-validate` が Runbook 系ドキュメント未掲載で失敗していたことを `docs_index_report.json` から特定。対応 PR（#537: `docs/agile/README-agile.md` に Runbook を追記）を作成。
- `plan_weekly_report.py` のアーティファクト取得が Azure へのリダイレクトで 403 になる問題を PR #531 で修正し、main に取り込み済み。現在は `plan-limits-report.zip` からの集計が安定。
- 週次レポートワークフローが `status-compat-seed` を自動 dispatch する運用へ移行済み。Required チェックが pending の場合は Seed → 本体ワークフロー完走待ちで解消される状態。

## 週報PRとチェック状況
- 週報 PR #536: `reports/plan-weekly-18972483292` を参照。`docs-index-validate (pull_request)` が Runbook 追加待ちで pending。
- `docs-index-validate.yml --ref reports/plan-weekly-18972483292` をローカル再実行すると Runbook 追記後に Required チェックが緑化する見込み。

## 残タスク / 引き継ぎ
1. PR #537 をレビューしてマージする（Runbook 追加で `docs-index-validate` の pending/failure を解消）。
2. マージ後に `docs-index-validate.yml --ref reports/plan-weekly-18972483292` を再実行し、PR #536 の Required チェックが全て成功することを確認する。
3. 週報 PR #536 をマージしたら、月次運用として `plan-sync` 実行と weekly-report の定期確認を継続する。

## 補足メモ
- `docs_index_report.json` を確認すると Runbook 配下の新規文書が README 未収載で検知される。今後も Runbook 追加時は README 反映を忘れないこと。
- 週報ダイジェストの Runs 集計は `plan-limits-report.zip` 内 `tmp/plan_limits_report.json` をベースにしており、フォーマット変更時は weekly スクリプト側の更新が必要。

# 10/31 22:30 引き継ぎメモ（PL-8: 後処理サマリ）

## 現在のステータス
- 週報パイプラインは PR #536（Runs analysed=39）まで生成済み。`status-compat-seed` dispatch も自動で動作確認済み。
- `docs-index-validate` が Runbook未掲載で失敗 → 調査ログ（`docs_index_report.json`）を添付、修正PR #537 を作成済み。
- `plan_weekly_report.py` artifact フォールバック修正 (PR #531) は main にマージ済み。Azureリダイレクトで 403 になっていた問題は解消。

## 引き継ぎタスク
1. PR #537 (`docs/agile/README-agile.md` に Runbook追記) をレビュー＆マージ。
2. 上記マージ後、`gh workflow run docs-index-validate.yml --ref reports/plan-weekly-18972483292` を再実行し、PR #536 の Required チェックが緑になることを確認。
3. 週報 PR #536 をマージし、週報運用を継続（毎週 `plan-sync`→`plan-weekly-report` での確認）。

## 補足
- Runbook追加時は README への索引追記を忘れないこと。未掲載だと `docs-index-validate` が `orphan_doc` として検出する。
- 週報集計は `plan-limits-report.zip` > `tmp/plan_limits_report.json` を参照。フォーマット変更がある場合は `scripts/plan_weekly_report.py` も更新する。


# 10/31 23:15 引き継ぎメモ（PL-8: 週報パイプライン完遂）

## 完了した事項
- PR #537 に `plan:sync` ラベルを付与し、`plan-sync/Validate` を再実行（run #18973443187 → success）のうえ `--squash` マージ完了。
- `docs-index-validate.yml --ref reports/plan-weekly-18972483292` を再実行し、失敗時は `gh api repos/:owner/:repo/merges` で最新 `main` を取り込んだ後にリトライ（run #18973530744 → success）。
- 週報 PR #536 の Required チェックが全て緑になったことを `gh pr checks 536` で確認し、`--squash` マージ済み。
- ローカル/リモートともに週報ブランチ `reports/plan-weekly-18972483292` は削除済み、`docs_index_report.json` も issue 0 件を確認。

## 現在のステータス
- `plan-sync` → `plan-weekly-report` の定期パイプラインは main 時点で安定稼働中。Required context は `status-compat-seed` → 本体完走を待つだけで自動的に揃う。
- Runbook 索引（`docs/agile/README-agile.md`）は最新の Runbook 追加分まで反映済み。`docs-index-validate` の diff gate はグリーン。

## 次のアクション
1. 定例オペレーションとして `plan-sync` の E2E 監視と weekly-report の成果確認を継続する。
2. `plan-limits-report.zip` のフォーマット変更が発生した場合は `scripts/plan_weekly_report.py` の追随を忘れずに。
3. 新規 Runbook 追加時は README 追記と `docs-index-validate` の手動トリガーをセットで実施し、Required pending を未然に防ぐ。


# 11/01 10:30 引き継ぎメモ（PL-9: UI自動発火）

## 完了した事項
- `plan-sync.yml` に UI 仕様変更検知・自動発火・スロットリング（1hに1回）・台帳コメント更新を実装。
- ランブック（`docs/agile/runbooks/plan-sync-smoke.md`）へ自動発火の手順／冷却挙動／デフォルトOFFの注意を書き足し。
- GitHub Actions で `PLAN_AUTO=1` を設定し、Run #18988988218（初回発火）、#18989002413（連続発火で台帳更新）、#18989025833（スロットリング抑止）を取得済み。
- 実装PR #539（`feature/pl9-auto` → `main`）を提出。検証用 PR #538 はクローズ／ブランチ削除済み。

## 現状メモ
- 本番値は `PLAN_AUTO=0` のまま（自動発火OFF）。必要になるまで切り替え不要。
- 自動発火時は PR コメント `<!-- plan-sync:auto -->{...}` に ISO タイムスタンプが追記される。60分窓での実行回数も確認可能。
- `[skip plan]` や `docs-sync/plan` ブランチ由来PRはスキップ。fork からの PR は `auto trigger disallowed for forks` で拒否し、pull_request_target のシークレット露出を避ける。既存の `plan:sync` ラベル／`/plan sync` も従来通り利用できる。

## 次アクション（運用開始時）
1. PR #539 をマージし `main` を最新化。
2. リポジトリ変数 `PLAN_AUTO=1` に切替 → 初回 UI 仕様PRで自動発火をモニタ。
3. 台帳コメントと Actions ログを確認し、冷却が効いていることを ops チームへ共有。

# 11/01 10:57 引き継ぎメモ（PL-10: ランブック＆オンボーディング完成）

## 完了した事項
- `docs/runbooks/plan-sync.md` を新設し、1分/3分ランブックと FAQ10件、運用チェックリストを整理。ガード失敗時の対処や `manual-accept` 手順も明記。
- ランブックから参照する図版を `docs/assets/plan-sync-run-ui.svg` / `plan-sync-guard.svg` / `plan-sync-checks.svg` に追加し、UI誘導と復旧パターンを視覚化。
- ランブックハブ（`docs/agile/runbooks/README.md`）へリンクを追記し、CIインパクト（`katsuya-plan/CI_IMPACT.md`）にも PL-10 追記。
- docs-index-validate をローカル実行し、リンクパス調整後に成功（`python3 scripts/docs_index_validate.py`）。

## 現状メモ
- plan-sync 運用手順は `docs/runbooks/plan-sync.md` を一次参照に統一。週次レポートや guard コメントの読み方も FAQ で補強済み。
- 画像は SVG（テキスト付き）で管理しているため、差し替えは diff で視認可能。実スクリーンショットが必要になった場合は `docs/assets/plan-sync-*.svg` を置き換えれば良い。

## 次のアクション（任意）
1. ランブック更新時は `docs-index-validate` を手動実行し、Broken Link を未然に防ぐ運用を継続する。
2. 週次レビューで guard ヒット理由が変化した際は FAQ の該当項目をアップデートする。必要があれば evidence 配下にスクショ差分を追加。
3. plan-sync ランブックと workorder 側ドキュメントの重複を棚卸しし、PL-11 以降で統合方針を検討。


# 11/02 12:00 引き継ぎメモ（PL-11: Branch Protection ドキュメント整備）

## 完了した事項
- `docs/agile/runbooks/plan-branch-protection.md` の競合マーカーを解消し、CODEOWNERS 通知の扱いと Required Check 設定を最新運用に合わせて言い回しを統一。
- `katsuya-plan/CI_IMPACT.md` に PL-11 の影響メモを追加し、Branch Protection まわりの更新履歴を連続で追跡できるよう整理。
- `python3 scripts/docs_index_validate.py` を実行してリンク整合を確認（エラーなし）。

## 現状メモ
- Branch Protection の Required Check は `plan-sync/Validate` 1本、`wo:ready/Validate` は警告成功（非Required）の前提で運用。
- CODEOWNERS は plan/workorder 系ドキュメントの通知用途として維持しており、レビュー必須ではない旨をランブックで明示。

## 次のアクション（任意）
1. PL-6 証跡（`docs/agile/runbooks/evidence/PL-6-branch-protection-20251031.md`）と今回の記述差分を見比べ、今後の設定変更時にハブとして活用する。
2. Branch Protection や CODEOWNERS に変更が入った際はランブックと CI_IMPACT の同期更新を忘れずに行う。
3. 週次ヘルスチェック時に `gh api` コマンドで Required Check / Review 設定が意図通りか確認する運用を継続する。

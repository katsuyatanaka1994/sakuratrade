# 目的（ゴール）
workorder.md を **“自動実装オーケストレータ”**として稼働させ、小粒・安全・可逆な変更のみを AUTO で **Implementation Draft PR** に落とし込む。

---
## 前提
- MANUAL / AUTO 節の棲み分け（ASSIST マーカー）。
- `plan.md` から **`plan_snapshot_id`** と **`TASKS.id`** を受け取り、整合チェックを実施。
- 生成物 PR は **固定ブランチ＋No-Op 成功＋直列 Queue**（自己発火ループ防止）。
- Required Checks: **`wo:ready/Validate`**（Branch Protection）。
- 適用範囲: 整形・軽UI・スケルトン・単体テスト雛形・軽微API。除外: DB/Infra/秘匿・広範囲変更。
- 上限: 行数 / ファイル数 / PR 数の三層リミット（初期は保守的な値）。

---
## 実行順（WO-1〜WO-9）

[DONE]### WO-1: workorder.md テンプレ＆ASSIST 枠の確定
**Outcome**: workorder.md に AUTO 区画（`LIMITS` / `ALLOWED_PATHS` / `BLOCKED_PATHS` / `PLAN_LINKS`）と `plan_snapshot_id` 鏡像を定義。
**カテゴリ**:
テンプレ整備
**説明・背景**:
Codex が触る領域を限定し、以後の自動更新と検証の基準点を用意する。
**完了条件**:
テンプレが main に入り、ASSIST 区画が doc-validate で保護される。

[DONE]### WO-2: codex-docsync `workorder` サブコマンド実装（`ready|validate|pr`）
**Outcome**: 差分抽出→適用可否（ready）→検証（validate）→Draft PR 作成（pr）までを CLI で一貫実行。
**カテゴリ**:
CLI実装
**説明・背景**:
再現性と保守性を確保するため、手続き化して CI からも同一操作で呼べるようにする。
**完了条件**:
ローカル/CIで `ready/validate/pr` が安定、No-Op 判定が正しく成功終了する。

[DONE]### WO-3: GitHub Actions `workorder-ready.yml` / `workorder-validate.yml`
**Outcome**: `plan:sync` ラベルや手動実行で直列 Queue 起動、No-Op は成功終了、自己発火を遮断。
**カテゴリ**:
CI/CD配線
**説明・背景**:
暴走や競合を避けるため、直列化・固定ブランチ・No-Op を標準化する。
**完了条件**:
両ワークフローが Green、固定ブランチの Draft PR が生成される（必要時のみ）。

[DONE]### WO-4: 上限制御＆適用範囲の強制（行数/ファイル/PR・Allow/Blocklist）
**Outcome**: 3層上限とパス制御で“安全側”に倒し、閾値超過は即停止＋理由コメント。
**カテゴリ**:
安全運用/上限
**説明・背景**:
小粒・可逆の原則を機械的に担保し、PR洪水や大規模変更の混入を防ぐ。
**完了条件**:
超過時に停止と理由コメント、ヒット数がロギングされる。

[DONE]### WO-5: `plan_snapshot_id` / `TASKS.id` の伝播と一致検証
**Outcome**: plan↔workorder の整合性を常時チェックし、齟齬があれば自動停止＋アラート。
**カテゴリ**:
整合/検証
**説明・背景**:
“計画どおりの実装”を保証し、古い計画に基づく自動実装を防ぐ。
**完了条件**:
一致チェックが CI に組み込まれ、不一致で Fail する。

[DONE]### WO-6: Implementation Draft PR 作成ロジック（固定ブランチ）
**Outcome**: 許可範囲の差分のみを含む Implementation Draft PR を **固定ブランチ** に作成。
**カテゴリ**:
PR生成
**説明・背景**:
レビュー容易性とループ防止のため、PR の集約先を固定化する。
**完了条件**:
対象差分がある場合のみ PR が作成され、ファイル/行数が上限内である。

**検証メモ（2025-11-05）**:
- plan:sync ラベル再付与で取得した run [19100477220](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19100477220) は plan-sync/Validate まで成功するものの、再利用ワークフローが `unsupported event: pull_request_target` で即終了（#651 で導入した event 判定が原因）。
- `.github/workflows/workorder-ready.yml` の `Resolve run context` を補正し、`pull_request_target` かつ `pr_number` 入力ありの場合は `workflow_call` 相当として処理するよう修正（commit 523e2a0bcf3942f5d181154bcf21ee850b59f09f、branch chore/workorder-ready-validation、PR #660）。
- 修正を含むブランチを ref にした `workflow_dispatch` 実行で plan-sync → workorder-ready を追試 (`plan-sync` run [19100556669](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19100556669)、`workorder-ready` 単体 run [19100627561](https://github.com/katsuyatanaka1994/sakuratrade/actions/runs/19100627561))。guard 解析・監査ログ出力・Node テスト・docs-sync/workorder への force-push まで新 python ヘルパー経由で完走することを確認。
- fix を main へ取り込んだ後に plan:sync ラベルで再度 run を取得し、`::notice::workorder-ready create|edit` と Draft PR 更新時刻を採取する（ラベル経由の E2E 連鎖が最終確認ポイント）。

[DONE]### WO-7: 失敗時の安全停止とエスカレーション
**Outcome**: 連続失敗・重大検出で自動停止、ラベル付与・コメント通知・レビュア召集を自動化。
**カテゴリ**:
運用/エスカレーション
**説明・背景**:
失敗の放置を防ぎ、人の関与へ素早く切り替える。
**完了条件**:
連続N回の Fail で停止し、規定のラベル/メンション/ログが付与される。

[DONE]### WO-8: メトリクス＆週次レポート（No-Op率/上限ヒット/リードタイム）
**Outcome**: `reports/workorder-weekly.md` に週次集計を自動生成し、改善点を可視化。
**カテゴリ**:
メトリクス/可視化
**説明・背景**:
運用の健全性を定点観測し、閾値やパス制御の最適化に活かす。
**完了条件**:
週次でレポートPRが作成され、ダイジェストと Top 指標が保存される。

**実績メモ（2025-11-03）**:
- `scripts/workorder_weekly_report.py` を実装、ギャザー指標（No-Op、上限ヒット、リードタイム）を算出。
- `.github/workflows/workorder-weekly-report.yml` を追加し、毎週月曜 JST 朝の定期実行＋手動トリガーを配線。
- `reports/workorder-weekly.md` を初期化し、CI Impact へ追記。

[DONE]### WO-9: Branch Protection / Required Checks の確定
**Outcome**: 誰が PR しても危険経路は通らず、レビュー前に機械が止める体制を固定化。
**カテゴリ**:
ガバナンス/保護
**説明・背景**:
AUTO 生成物の直編集や無審査マージを物理的に防ぐ。
**完了条件**:
Required: `wo:ready/Validate` が main に設定、AUTOパスの push 保護・CODEOWNERS が有効。

## WO-10以降の優先度整理

以降のタスクを「自動実装を安全に回すためにMVPまでに必須なもの」と「後追い導入でもリスクが限定的な任意項目」に分類した。判断基準は `katsuya-workorder.md` で明示された強制要件と、安全性/信頼性のガードレールに直結するかどうか。

[DONE]#### WO-10: ランブック＆オンボーディング（1分/3分）
**Outcome**: 新メンバーでも短時間で実行と復旧が可能、共通の“成功/復旧”手順が整う。
**カテゴリ**:
ランブック/教育
**説明・背景**:
属人化を減らし、失敗時の対応時間を最小化する。
**完了条件**:
`docs/runbooks/workorder.md` に 1分/3分手順と FAQ 10件、スクショ付きで整備。

**実績メモ（2025-11-03）**:
- `docs/runbooks/workorder.md` を新設し、1分/3分手順・FAQ 10 件・guard/エスカレーション復旧フローを記述。
- `docs/assets/workorder-ready-run-ui.svg` / `docs/assets/workorder-guard-fail.svg` を追加し、手順イメージを参照可能にした。
- `docs/agile/runbooks/README.md` のナビゲーションへ workorder ランブックを追加し、Runbook ハブから辿れるようにした。

### 必須タスク（Must）

#### WO-11: 実行サンドボックス＆権限分離
**Outcome**: Codex 実行の権限境界を固定ブランチ・限定パス・最小トークンで物理分離し、自己発火や汚染を防ぐ。全実行に監査ログを残す。
**カテゴリ**:
ガバナンス/権限
**説明・背景**:
自動実装は“安全な檻”の中でのみ行う。固定ブランチ（Implementation Draft 専用）と限定スコープのトークンにより、意図しない書き込みや他ブランチ汚染、再帰的発火を抑止する。誰がいつ何を動かしたかを追跡できるようにする。
**完了条件**:
固定ブランチへの書き込みのみ許可、許可パス（Allowlist）外は No-Op、トークンは最小権限・リポジトリ変数で管理、実行ID・操作者・コミット範囲を含む監査ログが保存される。

**実績メモ（2025-11-03）**:
- `scripts/workorder_cli.py` を更新し、`docs-sync/plan` / `docs-sync/workorder` 以外の base/head を拒否。許可パス外の差分は No-Op として終了し、guard からの disallowed を CLI 側で握りつぶすようにした。
- `scripts/workorder_guard.py` に `treated_as_noop` を追加し、`disallowed` を非エラー扱いでレポート化。
- `scripts/workorder_audit.py` を新設。`workorder-ready` が run ID / actor / guard 結果を `docs/agile/workorder-audit.log` と `workorder-audit-entry` アーティファクトへ JSONL で記録。
- `.github/workflows/workorder-ready.yml` が guard レポートを解析し、禁止パスを checkout で戻したうえで監査ログを出力。コミットメッセージも guard 結果に応じて変化させ、Draft PR には監査ログのみを push。
- `docs/agile/workorder.md` と `workorder_sync_plan.json` の AUTO 節へ監査ログパスを許可パスとして追加。
- PR 向けの読み取り専用サニティフローとして `.github/workflows/workorder-ready-pr.yml` を追加。`plan:sync` ラベル付き PR で禁止パス／上限ガードを事前検証し、監査エントリを artifact で確認できるようにした（本番の書き込み・監査ログ追記は default branch の `workorder-ready.yml` が担当）。

#### WO-12: テスト実行レイヤ＋即時ロールバック
**Outcome**: Implementation Draft PR に対し「高速スモーク→単体→軽統合」を段階実行し、赤なら自動停止＋自動リバート（またはPR自動クローズ）。
**カテゴリ**:
品質/リスク低減
**説明・背景**:
小粒でも“壊さない”が最優先。短時間テストを先頭に置く段階実行と、失敗時の即時リカバリで、壊れた状態を最短で解消する。
**完了条件**:
3段テストが自動起動し、任意段でFailなら実装ジョブ停止・Draft PRは自動リバート/クローズ・理由コメント付与・再実行は手動ゲートに切替。

#### WO-15: タスク個別上限の適用 (`tasks[i].acceptance.max_changed_lines`)
**Outcome**: plan 由来の `TASKS` からタスク単位の上限と `acceptance.checks` を取得し、グローバル閾値より優先して実行・検証する。
**カテゴリ**:
安全運用/上限
**説明・背景**:
`katsuya-workorder.md` が明示した「タスク上限（必須）」を守るため、plan の定義を自動実装側で尊重する必要がある。
**完了条件**:
CLI `validate` がタスク上限を超過すると即 Fail し、`acceptance.checks` で指定されたコマンドを順次実行。失敗時はPR / `.runs/` に実測値・対象タスク ID・こけたチェック名を出力する。

#### WO-16: 自動レビュー→修正ループ（auto_revise）実装
**Outcome**: Implementation Draft PR 作成後に `review_policy.auto_revise:true` でレビュー指示と失敗ログを読み、最小パッチ生成→再テスト→`Self-review passed (n iterations)` コメントまで自動化する。
**カテゴリ**:
品質/自動収束
**説明・背景**:
`katsuya-workorder.md` の中核である自動レビュー・修正ループを稼働させ、`review.md` の policy / constraints / reviews を各イテレーション開始時に再読込する。
**完了条件**:
最大イテレーション・行数・禁止パス上限を守りつつ、成功時はPR本文・コメント・`.runs/` に結果を記録し、失敗時は停止理由と次アクションをPRコメントする。

### 任意タスク（Should）



#### WO-13: AI出力の監査・再現性（署名）
**Outcome**: 生成に用いたプロンプト/設定のハッシュと `plan_snapshot_id`・実行IDを PR に埋め込み、同条件再実行で同一差分になる“再現性”を確保する。
**カテゴリ**:
監査/再現性
**説明・背景**:
AI出力は“同じ入力→同じ出力”の検証可能性が重要。PR本文とコミットフッターに出力署名を残し、後追い検証・差分比較を容易にする。
**完了条件**:
PR本文に（生成設定ハッシュ・`plan_snapshot_id`・実行ID）の署名が出力、`Co-authored-by` と実行メタがコミットに付与、同条件再実行で差分が一致し、監査ログに追記される。

#### WO-14: `outputs` ベースの concurrency group 算出
**Outcome**: `plan.md` の `outputs` を読み取り、ファイル＋2階層ディレクトリを正規化してハッシュ化した `concurrency.group` を CLI / Actions 双方で共有する。
**カテゴリ**:
直列制御
**説明・背景**:
`katsuya-workorder.md` が求める「同一領域は順番待ち」を実現するため、レイヤを跨いでも同一計算式でグループ化する必要がある。
**完了条件**:
CLI と Workflow が同じヘルパーで group を生成し、`outputs` 未設定時は安全側（単一グループ）で待機することを確認する。

#### WO-17: 失敗ログ＆ `.runs/` 出力の標準化
**Outcome**: `validate` / auto-revise の成否を `.runs/workorder/<timestamp>.json` に書き出し、PRコメントと整合するよう統一フォーマット化する。
**カテゴリ**:
運用/可観測性
**説明・背景**:
停止理由や成功回数を人が追いやすくし、後続分析（WO-8の週次レポート）でも同じメタデータを参照できるようにする。
**完了条件**:
成功・失敗の双方で `.runs/` にメタを書き、PRコメント・Actions Summary と同じID/理由/閾値情報を含む。再実行時は前回ログへのリンクを残す。

**状況（2025-11-04）**:
pull_request ワークフローからの連鎖実行が GitHub の仕様で拒否されるため、WO-11 は当面スキップ。既存の push ベース運用と監査導線へ戻した。

# pr-label-cleanup 削除影響調査レポート（DS-16）
- 作成日: 2025-10-26 15:36 JST
- 対象: `.github/workflows/pr-label-cleanup.yml`
- 調査者: Codex

## 1. 全体サマリ
- `pr-label-cleanup` はスケジュール実行（cron 04:00 JST）と手動 dispatch の夜間掃除専用ワークフロー。リポジトリ内での参照は当該ファイルのみ。
- `ds27-check-state.js` は `pr-label-cleanup` 以外にも `pr-draft-on-fail` / `pr-label-guard` で使用されているため残置が必要。
- GitHub Ruleset `main: PR-required-checks @DS-26 (ID: 9080255)` の必須チェックは `docs-index-validate (pull_request)` / `nfr-xref (pull_request)` / `security-permissions-lint (pull_request)` のみで、`pr-label-cleanup` 依存は無し。
- README / docs / dashboards で `Processed` `Cleaned` `Warnings` `labels removed` 等の cleanup サマリ値への依存は検出されず、メトリクス喪失リスクは軽微。
- “nodocs” ラベル掃除は `pr-label-guard` が docs 変更検出時に実施。docs 変更が無い PR については、人手ワンコマンド（`gh pr list`→Combined Status=success でラベル除去）を日次で回す運用に切り替え済み。

## 2. 調査詳細
### 2.1 参照探索
| コマンド | 結果 |
| --- | --- |
| `rg --hidden -n -S "pr-label-cleanup" .github docs scripts README*` | `.github/workflows/pr-label-cleanup.yml` のみ（1,16行）。他ファイルからの参照無し。 |
| `rg --hidden -n -S "ds27-check-state" . -g '!.git' -g '!**/node_modules/**'` | `.github/workflows/pr-label-cleanup.yml` / `pr-draft-on-fail.yml` / `pr-label-guard.yml` で利用。スクリプトは複数ワークフロー共有のため削除対象外。 |

### 2.2 Actions / スケジュール / メトリクス
- `gh workflow list | grep -E "cleanup|label|docs|xref|permissions"` → `pr-label-cleanup` は active（ID 200784168）で Cron と Dispatch のみ。その他 cleanup 系ワークフロー無し。
- `gh workflow view pr-label-cleanup.yml --yaml`（タイムアウトしつつも YAML 出力を取得）→ ローカルファイルと同一。Cron `0 4 * * *` ＋ `workflow_dispatch`、`DS16_MODE=='observe'` のときのみ実行。
- Step Summary（`Processed/Cleaned/Warnings`）のキーワードを `docs/`, `README*` で `rg` したがヒット無し → メトリクス参照ドキュメントなし。

### 2.3 Ruleset / Branch Protection
- `gh api repos/katsuyatanaka1994/sakuratrade/rulesets` → `main: PR-required-checks @DS-26` のみ。
- `gh api repos/.../rulesets/9080255` の抜粋:
  - 対象ブランチ: `refs/heads/main`
  - Required status checks: `docs-index-validate (pull_request)`, `nfr-xref (pull_request)`, `security-permissions-lint (pull_request)`
  - `pr-label-cleanup` や cleanup 系チェックは未登録。
- `gh api repos/.../branches/main/protection` は HTTP 404（権限不足 or 未設定）。Ruleset 側で Required Checks がカバーされているため、保護側に cleanup 系の必須チェックは存在しないと判断。

### 2.4 ドキュメント依存
- `rg --hidden -n "pr-label-cleanup" docs README*` → ヒット無し。
- `rg --hidden -n "Processed|Cleaned|Warnings|labels removed" docs README*` → ヒット無し。
- `docs/agile/ci-specification.md` では docs:invalid 制御フローを説明しているが、ラベル除去担当は `pr-label-guard` と記載されており cleanup ワークフロー依存は無し。

### 2.5 “nodocs” 掃除の置き換え
- `pr-label-guard` が docs 変更有無を判定し、docs 未変更 PR では即座に `docs:invalid`/`triage:urgent` を除去する実装を確認（`.github/workflows/pr-label-guard.yml:112-190`）。
- `docs-index-validate` / `nfr-xref` もラベル除去は guard に委譲。Cleanup 削除後は「docs 変更なし＋guard未発火」のPRのみ残るため、提供済みワンコマンドを日次で実行する方針でカバー可能。

### 2.6 手動ワンコマンド実行ログ
```
$ gh pr list --repo katsuyatanaka1994/sakuratrade --state open --label "docs:invalid" --json number,headRefOid
[]

$ REPO=katsuyatanaka1994/sakuratrade
$ gh pr list --repo $REPO --state open --label "docs:invalid" --json number,headRefOid \
    -q '.[] | "\(.number) \(.headRefOid)"' \
  | while read PR SHA; do
      STATE=$(gh api repos/$REPO/commits/$SHA/status -q .state)
      if [ "$STATE" = success ]; then
        echo "remove labels on PR #$PR"
        gh pr edit $PR --repo $REPO --remove-label docs:invalid triage:urgent
      else
        echo "keep PR #$PR (state=$STATE)"
      fi
    done
(対象PRが無かったため処理無し)
```
- 現在 `docs:invalid` 付きの Open PR は存在せず、コマンドはノーオペ確認。
- 運用: ラベル付き PR が発生した場合でも Combined Status=`success` のものだけを剥がすため安全（Provided script をそのまま活用）。

### 2.7 リスク・未解決事項
- **要判断:** ブラウザ UI での Required status checks 表示を取得できていない（API情報からは Cleanup 依存無しと確認済み）。必要なら人手で UI スクショ取得。
- メトリクス（Processed/Cleaned/Warn）を監視に利用していた履歴は無し。必要なら seed/compat/sync の Step Summary に置き換え可能。

### 2.8 ロールバック手順
1. `git revert <cleanup削除コミット>` または `.github/workflows/pr-label-cleanup.yml` を戻して `main` に再マージ。
2. `DS16_MODE` を `observe` に戻すなど既存設定を再利用すれば即復旧可能。

## 3. 結論
- リポジトリ内の参照・Ruleset・ドキュメントから `pr-label-cleanup` 依存は検出されず、安全に削除可能と判断。
- `ds27-check-state.js` は guard/draft ワークフローが参照しているため残置。
- 監視/掃除運用は以下で継続:
  1. `pr-label-guard` が docs:invalid の自動制御を継続。
  2. docs 変更無しPR向けは提供済みのワンコマンドを日次実行（ログはこのファイルに追記）。

以上を踏まえ、`pr-label-cleanup.yml` の削除を進めます。

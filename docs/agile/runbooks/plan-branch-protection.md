# PL-6 Branch Protection 運用ガイド

## 目的
- `main` ブランチへの直pushを禁止し、必ず Pull Request + Required Checks 経由でマージさせる。
- Required Check は `plan-sync/Validate` のみを強制し、`wo:ready/Validate` は警告成功（非ブロック）で維持する。
- plan / workorder 系の変更については `CODEOWNERS` でレビュー推奨者を通知しつつ、必須レビューとせずチェックのみでガードする。
- Merge 後は `main/post-merge-smoke` が 60 秒監視を実施する前提を明文化し、ガードの抜け漏れを防ぐ。

## 事前条件
- `.github/CODEOWNERS` が `docs/agile/plan.md` / `docs/agile/workorder.md` / `doc_sync_plan.json` / `workorder_sync_plan.json` / `docs/agile/runbooks/plan-*.md` / `docs/agile/runbooks/workorder-*.md` を `@katsuyatanaka1994` に割り当て済み。
- GitHub Actions → General → Workflow permissions が **Read and write** に設定されている。
- リポジトリシークレット `BRANCH_PROTECTION_TOKEN` が repo administration:write を含む PAT または GitHub App トークンで登録されている。
- リポジトリ管理者が Branch protection と CODEOWNERS を編集できる権限を保有している。

## 設定・更新手順
1. GitHub → Settings → Branches → **Branch protection rules** で `main` を編集。
2. 以下を有効化：
   - **Require a pull request before merging**（Approvals 必須なし、Code Owner レビューは OFF）。
   - **Require status checks to pass before merging** → `plan-sync/Validate` を選択し **Require branches to be up to date** をON。
   - **Do not allow bypassing the above settings**（Enforce for administrators）。
   - **Require linear history** / **Require conversation resolution before merging**。
   - **Do not allow force pushes / Do not allow deletions**。
3. 「Who can push to matching branches」は空のまま（＝全員PR経由）。必要に応じて GitHub App のみ許可する場合は `branch-protection/sync` ワークフローの `restrictions` を編集する。
4. 保存後、対象PRで Required Check が `plan-sync/Validate` のみとなり、レビュー未承認でもマージ可であることを確認。`wo:ready/Validate` は警告表示で成功することを想定する。

## CLI での確認（`gh`）
```bash
# Required Checks の確認（plan-sync/Validate のみが Required）
gh api repos/:owner/:repo/branches/main/protection | jq '.required_status_checks.contexts'

# Pull Request レビュー設定の確認
gh api repos/:owner/:repo/branches/main/protection \
  | jq '.required_pull_request_reviews | {approvals: .required_approving_review_count, code_owner: .require_code_owner_reviews}'

# post-merge smoke の有効化確認
gh workflow view main-post-merge-smoke --json name,state | jq '{name, state}'
```
- 期待結果：`["plan-sync/Validate"]` が返り、`code_owner: false` / `approvals: 0`。`main/post-merge-smoke` は `active`。

## ワークフローでの同期
- `.github/workflows/branch-protection-sync.yml` を手動実行（Actions → branch-protection/sync → **Run workflow**）。最初のステップで `BRANCH_PROTECTION_TOKEN` 未設定が検知されると即時エラーになる。
- 成功すると Actions ログに `Updated branch protection for <repo>@main` と Required Checks が出力される。
- GitHub UI の設定と CLI の出力が一致するかをダブルチェック。
- Settings → Branches → Code owners review は OFF（通知のみ）であることを確認し、必要に応じて CODEOWNERS へ追加通知先を設定する。

## スクリーンショット
- 運用ハンドブック共有用：

![Branch protection checklist](../../assets/plan-branch-protection.svg)

## トラブルシュート
- `403 Resource not accessible by integration` → `BRANCH_PROTECTION_TOKEN` のスコープ不足。repo → Administration: write を付与した PAT / GitHub App トークンを再発行し、シークレットを更新する。
- Required Check がリストに表示されない → `plan-sync/Validate` ワークフローを main で一度成功させ、チェック名を確定させる。`wo:ready/Validate` は Required ではないためリストに現れなくてよい。
- Code owner レビューで該当ユーザーに通知されない → `CODEOWNERS` のパス表記が `/` から始まっているか、GitHub側で Code Owners 機能が有効か確認する。

## 実測証跡（PL-6）
- [PL-6 Branch Protection Evidence — 2025-10-31](evidence/PL-6-branch-protection-20251031.md)

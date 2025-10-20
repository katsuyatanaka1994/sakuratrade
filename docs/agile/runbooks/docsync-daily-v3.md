# DocSync 日常運転（v3）スナップショット

## 不変条件（Invariants）
- Source: `backend/app/openapi.yaml` → Target(AUTO): `docs/specs/openapi.yaml`
- 生成物PRは `docs-sync/**` & タイトル先頭 `[skip docsync]`（= DS-17で checks を除外）
- DS-18: `docsync-check` が Summary と Artifacts（`doc_sync_plan.json`）を必ず出す
- DS-18.1: `workflow_run(docsync-check)` で `docs/agile/report.md` に1行追記PRを生成
- DS-14: 索引/リンク整合（`docs-index-validate`）は0件で緑

## 赤→緑の最短動線
1. PR → **Checks**：`docsync-check` / `openapi-validate` / `guard-readme-assist`
2. equal:false → **Actions → docsync-apply → Run workflow**（ブランチ指定）
3. 追記系は `docsync-report-append` の自動PRをマージ（このPRでは checks は出ないのが正）

## 運用メモ
- Artifacts取得：`permissions.actions: read`、`download-artifact` は `path: docsync-artifacts/`
- plan パス：`docsync-artifacts/doc_sync_plan.json`
- 差分ゼロで再実行時の赤対策：`create-pull-request` に `continue-on-error: true`
- READMEの索引は `ASSIST:index` 内のみ編集（guard で保護）

## 参照リンク（更新推奨）
- main の docsync-check Run: <URL>
- docsync-report-append Run: <URL>
- 直近の “report 行” PR: <URL>

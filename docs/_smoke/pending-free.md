# Smoke: Pending-Free Docs Checks (DS-26)

## ゴール
- PR 上で `docs-index-validate / nfr-xref / security-permissions-lint` の Required context が Pending のまま残らないことを確認する。
- DocSync 生成 PR や `[skip docsync]` タイトルでは diff gate が即座に Success を返すことを確認する。

## 手順
1. docs 配下に 1 行だけ変更した PR を作成。
2. 各 Workflow Run を開き、Step Summary に `diff gate` の項目が表示されているか確認。
3. `status-compat` Run の Summary で `state=success (diff gate on PR, full run on main)` が書き込まれていることを確認し、PR の **Checks** で Pending が消えているかを見る。
4. `docs-sync/**` ブランチ or `[skip docsync]` タイトルの PR を作成し、全ジョブが Summary メッセージのみで終了する（DocSync guard）ことを確認。
5. main に merge し、`push` Run がフル実行され `docs/agile/report.md` に Run URL が追記されることを確認。

## フォールバック
- いずれかの Workflow が `neutral/skipped` 結論で止まった場合でも `status-compat` が Success へ上書きされるか確認。されない場合は Run ID を控えて `status-compat` Workflow を調査。
- Pending が解消しない場合は `Actions → <workflow> → Run workflow → branch: main` を実行し手動で full run。Run 完了後は再度 Checks を確認。
- 詳細手順やエスカレーションは `docs/agile/runbooks/docs-ci-diff-gate.md` を参照。

## 成功条件
- diff 変更無し PR で 3 つの Required context がすべて Success (緑) になっている。
- diff あり PR で lint/validator が実行され、失敗時は `on-failure` アクションがコメント＋ラベルを付与する。
- DocSync PR が Pending のままにならない。

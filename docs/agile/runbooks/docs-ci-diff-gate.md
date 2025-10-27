# Docs CI Diff Gate 運用ノート (DS-26)

## 目的
- PR では `scripts/detect_changed_files.py` の diff gate で対象ファイルだけを確認し、Pending を残さず Required context を緑化する。
- main (push or workflow_dispatch) ではフル検証を実行し、DocSync 連携やレポート生成を継続する。

## 監視ポイント
1. **status-compat** の Summary で `ctx=... state=success` まで到達しているか。
2. PR Run の Step Summary に `diff gate: no matching ...` または `lint executed` が表示されているか。
3. main push が止まった場合は `docs/agile/report.md` に最新 Run URL が追記されていないので差分で検知する。

## フォールバック（workflow_dispatch）
1. GitHub Actions → 対象 Workflow (`docs-index-validate`, `nfr-xref`, `security-permissions-lint`) を開く。
2. **Run workflow** で `branch: main` を指定し実行。strict モードなど入力がある場合は必要に応じて上書き。
3. Run の完了を待ち、`status-compat` が Success へ上書きされたことを PR で確認。
4. DocSync PR が必要な Workflow では `docs-sync/**` PR が作成されたかをチェックし、必要なら `docsync-apply` へ引き渡す。

## よくある詰まりと対処
| 事象 | 暫定対応 |
| --- | --- |
| diff gate が誤判定 (本当は対象あり) | `Run workflow` → main を手動実行してフル検証。その後 `scripts/detect_changed_files.py` にパターンを追加して再テスト。 |
| DocSync 生成 PR で pending | `status-compat` が `skipped` を success として再発行するので待機。必要に応じて `docs-sync/**` PR は人力で merge。 |
| main push で失敗 | `report-failure` ジョブが triage issue を開く。Issue をアサインし、Run URL から調査。 |
| manual rerun が必要 | Runbook この節の手順で `workflow_dispatch`。完了後に `docs/_smoke/pending-free.md` で Pending が無いことを確認。 |

## 参考
- CI仕様書: `docs/agile/ci-specification.md`
- Smoke ノート: `docs/_smoke/pending-free.md`
- シェル/スクリプト: `scripts/detect_changed_files.py`

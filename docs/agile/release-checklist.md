# リリースチェックリスト

| チェック項目 | タイミング | 担当 | 記録欄 |
| --- | --- | --- | --- |
| Backend unit CI | PR merge 前 | Dev | ✅/❌ |
| Integration CI (Run URL) | リリース前 | QA | https://github.com/<org>/<repo>/actions/runs/... |
| DocSync sec-review | リリース前日 | Sec | ✅/❌ |
| 手動スモーク (Playwright) | 本番リリース当日 | QA | ✅/❌ |

- Integration CI の Run URL は必要に応じて `docs/agile/report.md` にも追記する。

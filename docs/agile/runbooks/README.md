# Agile Runbooks Index

このディレクトリは plan / workorder 運用の手順と証跡を集約するためのハブです。守るべき設定やスモーク手順、実測証跡をここから辿れます。

## ナビゲーション
- [plan-sync.md](../../runbooks/plan-sync.md): 1分/3分ランブックと FAQ、スクショ付き復旧手順。
- [workorder.md](../../runbooks/workorder.md): workorder-ready の 1分/3分ランブックと FAQ、ガード復旧フロー。
- [plan-branch-protection.md](plan-branch-protection.md): `main` ブランチ保護ルールと Required Check 運用。
- [plan-sync-smoke.md](plan-sync-smoke.md): plan-sync / workorder-ready のスモーク検証手順。
- [evidence/](evidence/): 最新の運用証跡（例: [PL-6 Branch Protection Evidence — 2025-10-31](evidence/PL-6-branch-protection-20251031.md)）。
- 週次レポート（plan-sync/Weekly Report）は **JST 09:00（月曜）= UTC 00:00** に自動実行（cron `0 0 * * 1`）。

Runbook を更新したら、関連する証跡ファイルへのリンクを README と各ドキュメントに追加し、再現性を確保してください。

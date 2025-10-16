# Documentation Overview

## Purpose
リポジトリ内のドキュメント構造と更新フローをまとめ、変更時にどこを参照・修正すべきかを即座に判断できるようにする。

## Document Map
| パス | 役割 | 主担当 | 更新トリガ |
| --- | --- | --- | --- |
| `README.md` | プロジェクト全体の概要とセットアップ | プロダクトオーナー | 大幅な方向転換 / 初期セット更新 |
| `docs/README.md` | ドキュメント全体の目次（本ファイル） | Codex + PO | ドキュメント構成変更時 |
| `docs/agile/README-agile.md` | アジャイル系ドキュメントのハブ | Codex + デリバリーチーム | スプリント開始時 / ドキュメント増減時 |
| `docs/agile/document-operations.md` | 各ドキュメントの運用ルール | Codex + PO | ルール改定時 |
| `docs/agile/*.md` | UI/API/テスト/CI/非機能などスプリントで扱う仕様書 | 担当ドメインチーム | 設計・実装・レビュー時 |
| `docs/specs/openapi.yaml` | API契約の単一ソース | Backend + Codex | API変更PR |
| `docs/schema-usage-matrix.md` など既存資料 | スキーマ利用状況や分析資料 | データチーム等 | スキーマ変更 / 調査更新時 |
| `CHANGELOG.md` | スプリントごとの変更履歴 | Codex + PO | スプリント終了時 |
| `CONTRIBUTING.md` | リポジトリ全体の更新手順 | 全員 | プロセス変更時 |

## Update Flow (目安)
1. **対象を確認** — Backlog/Issue で着手範囲を決め、該当ドキュメントを特定する。
2. **テンプレ適用** — `docs/agile/` 配下のテンプレは Codex が整え、人間はドメイン知識（テスト観点、文言等）を追記する。
3. **関連リンク更新** — `docs/agile/README-agile.md` と `document-operations.md` の索引/責務が変わる場合は合わせて更新する。
4. **レビュー** — メタデータ（作成者/レビュアー/最終更新日）を埋め、担当者が内容を確認。必要に応じ `CONTRIBUTING.md` のチェックリストを参照する。
5. **履歴反映** — スプリントやリリースに反映される変更は `CHANGELOG.md` に記載し、共有チャネルへ通知する。

## Tooling / Conventions
- Markdown テーブルやチェックリストのフォーマットは崩さず、Codex が自動整形できるようにする。
- 将来的に `scripts/format-docs` / `scripts/validate-agile-docs` を導入する想定。CI でエラーが出た場合は該当スクリプトを先に実行する。
- OpenAPI やCI設定を更新するPRでは、`docs/agile/api-specification.md` や `ci-specification.md` の同期を忘れずに行う。
- ドキュメント運用ルールの詳細は `docs/agile/document-operations.md` を参照。


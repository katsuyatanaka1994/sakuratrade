# 統合テスト仕様書

- 作成者（Codex）:
- レビュアー（人間）:
- 最終更新日:
- スプリント / Issue:

## テスト概要
- テストID:
- タイトル:
- 目的:
- 対象API / サービス:
- 関連仕様: `docs/agile/api-specification.md`

## 前提条件
| 項目 | 内容 |
| --- | --- |
| 実行環境 | docker-compose / staging / CI pipeline |
| 依存サービス | PostgreSQL 13, Redis 6 など |
| 初期データ | `seed/users.sql` など |
| 認証情報 | Authorization Bearer token for user100 |
| 設定ファイル | `.env.integ` / `ci-integ.yml` |

## シナリオ
| ステップ | 操作 / 入力 | 期待結果 |
| --- | --- | --- |
| 1 | POST `/api/entries` (body `{ "price": 100, "side": "long" }`) | HTTP 201 |
| 2 | DB確認 `SELECT * FROM entries WHERE user_id=100` | レコードが存在 |
|  |  |  |

## バリデーション
- HTTPステータス: 201
- レスポンスボディ検証: `id`, `status`, `data.price`
- DB検証: `entries` テーブルに該当行が存在
- ログ / メッセージキュー検証: (必要なら記載)

## 実行方法
- コマンド: `pytest tests/integration/test_entries.py::test_create_entry -k <ID>`
- docker 起動: `docker-compose -f ci-integ.yml up -d`
- テストデータ投入: `psql -f seed/users.sql`

## 合格基準
- [ ] HTTP 201 を返す
- [ ] レスポンスの `data` が入力値と一致
- [ ] DB に期待レコードが生成
- [ ] 副作用なし (重複レコード / エラーなし)

## 後処理
- クリーンアップ: `DELETE FROM entries WHERE user_id=100 AND price=100`
- サービス停止: `docker-compose -f ci-integ.yml down`

## 所要時間 / 自動化
- 実行時間目安:
- CI 実行有無: Yes / No
- 日次ジョブ: 有 / 無

## 変更履歴
- YYYY-MM-DD: 初版作成 (PR # / 担当者)
- YYYY-MM-DD:


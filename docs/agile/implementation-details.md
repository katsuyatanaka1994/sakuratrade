# 実装ドキュメント

- 作成者（Codex）:
- レビュアー（人間）:
- 最終更新日:
- スプリント / Issue:
- 関連チケット / PR:

## 概要
- 1行サマリ:
- 背景 / 目的:

## スコープ
| 含む | 除外 |
| --- | --- |
|  |  |

## 前提・依存
| 項目 | 内容 |
| --- | --- |
| ランタイム / 言語 | Python 3.x / Node.js 18 等 |
| 外部サービス |  |
| ライブラリ / バージョン |  |
| Feature Flags / Config |  |

## アーキテクチャ
- 図リンク: (Miro / Figma / Excalidraw など)
- 要点:  
  - レイヤ構成:  
  - データフロー:  
  - エラーハンドリング戦略: 

## 実装詳細
### 主要コンポーネントとファイル
| コンポーネント | ファイル / ディレクトリ | 役割 | 備考 |
| --- | --- | --- | --- |
|  |  |  |  |

### 重要アルゴリズム / ロジック
- 記述:
- トレードオフ / 代替案:
- パフォーマンス考慮:

## API
| エンドポイント | メソッド | 概要 | 仕様リンク |
| --- | --- | --- | --- |
|  |  |  | `docs/agile/api-specification.md` |

- サンプルリクエスト / レスポンス:
```json
{

}
```
- OpenAPI: `docs/specs/openapi.yaml`

## DB 変更 / マイグレーション
| 項目 | 内容 |
| --- | --- |
| スキーマ差分 |  |
| マイグレーションファイル |  |
| ロールバック手順 |  |
| テストデータ更新 |  |

## 設定 / 環境変数
| 変数 | 用途 | 必須/任意 | デフォルト | 備考 |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## ビルド & ローカル実行
- ビルドコマンド:
- ローカル起動手順:
- 動作確認コマンド / ヘルスチェック:

## デプロイ
| 項目 | 内容 |
| --- | --- |
| CIジョブ / ワークフロー | 例: `.github/workflows/deploy.yml` |
| リリース手順 |  |
| ロールバック |  |
| 承認フロー |  |

## テスト
| 種別 | コマンド | 合格基準 | 参照仕様 |
| --- | --- | --- | --- |
| unit | `pytest tests/unit` | 失敗ゼロ | `docs/agile/unit-test-specification.md` |
| integration | `pytest tests/integration` | 失敗ゼロ | `docs/agile/integration-test-specification.md` |
| e2e | `npx playwright test tests/e2e/smoke` | 失敗ゼロ | `docs/agile/smoke-e2e-specification.md` |
|  |  |  |  |

## 監視 / アラート
| 指標 | 目標 / 閾値 | ダッシュボード | 通知先 |
| --- | --- | --- | --- |
|  |  |  |  |

## セキュリティ
- 承認・権限要件:
- シークレット取り扱い:
- 既知リスク / 注意点:
- 参照: `docs/agile/security-considerations.md`

## 運用 / Runbook
| 事象 | 症状 | 対処手順 | 連絡先 |
| --- | --- | --- | --- |
|  |  |  |  |

## 既知の問題 / TODO
- [ ] 課題1:
- [ ] 課題2:

## 参照
- 設計書: (リンク)
- テスト仕様: `docs/agile/unit-test-specification.md`, `docs/agile/integration-test-specification.md`
- CI仕様: `docs/agile/ci-specification.md`
- 非機能要件: `docs/agile/non-functional-requirements.md`

## 変更履歴
- YYYY-MM-DD: 初版作成 (PR # / 担当者)
- YYYY-MM-DD:


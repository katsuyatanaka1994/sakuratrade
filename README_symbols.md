# 銘柄データ管理システム

## 概要

チャットトレード画面の建値入力モーダルにて、以下の機能を実装：

1. **チャット文脈からの銘柄自動入力**
   - チャットメッセージから銘柄を自動検出
   - 複数検出時は最新メッセージ優先で自動入力

2. **推論サジェスト機能**
   - 入力中にコード/名称いずれからでもリアルタイム推論サジェスト
   - Fuse.jsによるファジーマッチング
   - ひらがな→カタカナ正規化対応

3. **symbols.jsonの自動生成・更新**
   - JPXのExcelから自動生成
   - GitHub Actionで毎月自動更新

## ファイル構成

### フロントエンド
- `frontend/src/components/AutocompleteSymbol.tsx` - サジェスト入力コンポーネント
- `frontend/src/hooks/useSymbolSuggest.ts` - サジェスト機能のフック
- `frontend/src/utils/symbols.ts` - 銘柄検索・抽出ユーティリティ
- `frontend/public/data/symbols.json` - 銘柄データ（約4000銘柄）

### バックエンド・スクリプト
- `scripts/generate_symbols.py` - JPX Excel → JSON変換スクリプト
- `scripts/requirements.txt` - Python依存関係
- `.github/workflows/update-symbols.yml` - 自動更新GitHub Action

## 使用方法

### 手動でsymbols.jsonを更新

1. **JPXからExcelファイルをダウンロード**
   ```bash
   # JPXの「データ活用」→「基本情報」→「上場銘柄一覧」からExcelファイルを取得
   # https://www.jpx.co.jp/markets/statistics-equities/misc/01.html
   ```

2. **Python環境セットアップ**
   ```bash
   pip install -r scripts/requirements.txt
   ```

3. **symbols.jsonを生成**
   ```bash
   python scripts/generate_symbols.py path/to/jpx_data.xlsx
   ```

### 自動更新（GitHub Action）

- 毎月1日の午前3時（JST）に自動実行
- 手動実行も可能（GitHub Actions画面から）
- 変更があった場合のみコミット・プッシュ

## データフォーマット

```json
[
  {
    "code": "5803",
    "name": "フジクラ", 
    "market": "プライム",
    "kana": "フジクラ",
    "romaji": "fujikura",
    "sector33": "電気機器",
    "sector17": "電機・精密",
    "product": "株式",
    "ticker": "5803.T"
  }
]
```

## 機能詳細

### 1. チャット文脈からの自動入力

**実装場所**: `Trade.tsx:339-365`

建値入力モーダルが開かれた際、以下の処理を実行：
1. チャットメッセージから銘柄コード・名称を抽出
2. 最新メッセージを優先して検索
3. 該当銘柄が見つかった場合、自動入力＋「自動入力」バッジ表示

### 2. 推論サジェスト機能

**実装場所**: `AutocompleteSymbol.tsx` + `useSymbolSuggest.ts`

- **Fuse.js**による高性能ファジーマッチング
- **多段階検索**:
  1. コード正規化での厳密一致（優先）
  2. Fuse.jsでの元クエリ検索
  3. 正規化コードでの補完検索
  4. ひらがな→カタカナ正規化での検索

- **対応入力形式**:
  - 証券コード: `5803`, `5803.T`
  - 企業名（カタカナ）: `フジクラ`, `ソフトバンク`
  - 企業名（ひらがな）: `ふじくら` → `フジクラ`
  - ローマ字: `fujikura` → `フジクラ`

### 3. JPX Excelからの自動生成

**実装場所**: `scripts/generate_symbols.py`

- **フィルタリング**: 商品区分が「内国株式」のみを対象
- **データ正規化**: 市場名、業種名の統一
- **カタカナ・ローマ字生成**: 検索性向上のため自動生成
- **エラーハンドリング**: 不正データの除外、重複排除

## トラブルシューティング

### よくある問題

1. **symbols.jsonが読み込まれない**
   - ファイルパス確認: `frontend/public/data/symbols.json`
   - ファイル形式確認: 有効なJSON形式か

2. **サジェストが表示されない**
   - 2文字以上入力されているか
   - `useSymbolSuggest`の`ready`状態を確認

3. **自動更新が失敗する**
   - JPXのExcel URLが変更されていないか
   - GitHub Actionのログを確認

### デバッグ方法

```javascript
// ブラウザのコンソールで実行
fetch('/data/symbols.json')
  .then(r => r.json())
  .then(data => console.log(`Loaded ${data.length} symbols`));
```

## 今後の改善予定

- [ ] 業種別フィルタリング
- [ ] 時価総額、出来高データの追加
- [ ] リアルタイム株価データ連携
- [ ] カスタム銘柄リスト機能
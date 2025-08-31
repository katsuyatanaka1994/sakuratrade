# トレードジャーナル フィルター機能実装

## 概要

ダッシュボードのトレードジャーナルセクション用のフィルター機能を実装しました。画像で提供されたUIデザインに基づいて、以下の機能を提供します：

- フィルターボタン（アクティブ状態表示付き）
- フィルターダイアログ（結果・銘柄検索・日付範囲）
- 大型カレンダーオーバーレイ（範囲選択・本日へナビ）

## 実装ファイル

### コンポーネント
- `src/components/FilterButton.tsx` - フィルターボタン
- `src/components/FilterDialog.tsx` - フィルターダイアログ
- `src/components/DateRangeOverlay.tsx` - 日付範囲選択オーバーレイ
- `src/pages/TradesPage.tsx` - メインページ

### API・型定義
- `src/lib/api/trades.ts` - API層
- `src/types/trades.ts` - TypeScript型定義
- `src/lib/api/__mocks__/trades.ts` - モックAPI（開発用）

### テスト
- `src/components/__tests__/FilterDialog.test.tsx` - フィルターダイアログのテスト

## 主要機能

### 1. フィルターボタン
- **位置**: 一覧ヘッダーの右上
- **アクティブ表示**: 条件適用中は青い小丸ドット表示
- **アイコン**: フィルターアイコン + 「フィルター」ラベル

### 2. フィルターダイアログ
- **結果フィルター**: ラジオボタン（すべて・利確・損切り）
- **銘柄検索**: テキスト入力（コードまたは銘柄名）
- **日付範囲**: ボタン型入力（クリックでカレンダー表示）
- **操作**: 閉じる・検索するボタン
- **キーボード**: ESCキーで閉じる

### 3. 日付範囲オーバーレイ
- **サイズ**: 固定中央配置（46rem × 34rem）
- **背景**: 半透明の黒オーバーレイ
- **ナビゲーション**: 前月/翌月ボタン + 「本日へ」ボタン
- **範囲選択**: 1クリック目でfrom、2クリック目でto設定
- **自動入替**: 逆順選択時の自動補正
- **今日表示**: 当日は薄い枠線で強調

### 4. API統合
- **エンドポイント**: `GET /api/trades`
- **パラメータ**: from, to, q, type, page, page_size
- **レスポンス**: items配列とメタ情報
- **エラーハンドリング**: ネットワークエラー・APIエラーの処理

### 5. URL同期
- **クエリパラメータ**: ?from=...&to=...&q=...&type=...
- **自動更新**: フィルター変更時のURL更新
- **初期化**: ページロード時のURL読み込み

## 使用方法

### 基本的な統合

```tsx
import { TradesPage } from './pages/TradesPage';

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <TradesPage />
    </div>
  );
}
```

### 個別コンポーネントの使用

```tsx
import { FilterButton } from './components/FilterButton';
import { FilterDialog } from './components/FilterDialog';
import { DateRangeOverlay } from './components/DateRangeOverlay';

// フィルターボタン
<FilterButton 
  hasActive={hasActiveFilters} 
  onOpen={() => setShowDialog(true)} 
/>

// フィルターダイアログ
<FilterDialog
  open={showDialog}
  onOpenChange={setShowDialog}
  value={filters}
  onSubmit={handleFilterSubmit}
/>

// 日付範囲オーバーレイ
<DateRangeOverlay
  open={showDatePicker}
  onOpenChange={setShowDatePicker}
  value={{ from: startDate, to: endDate }}
  onChange={handleDateRangeChange}
/>
```

## API仕様

### リクエスト例
```
GET /api/trades?from=2025-01-01&to=2025-01-31&q=7203&type=profit&page=1&page_size=20
```

### レスポンス例
```json
{
  "items": [
    {
      "id": "tr_abc123",
      "symbol": "7203",
      "symbol_name": "トヨタ自動車",
      "side": "long",
      "entry_at": "2025-01-15T09:23:00+09:00",
      "entry_price": 3085.0,
      "exit_at": "2025-01-15T10:12:00+09:00",
      "exit_price": 3162.0,
      "qty": 100,
      "pnl": 7700.0,
      "pnl_pct": 2.5,
      "tag": "profit"
    }
  ],
  "meta": {
    "total": 218,
    "page": 1,
    "page_size": 20,
    "has_next": true,
    "applied_filters": {
      "from": "2025-01-01",
      "to": "2025-01-31", 
      "q": "7203",
      "type": "profit"
    }
  }
}
```

## 型定義

### 主要な型
```typescript
export type TradeType = 'all' | 'profit' | 'loss';

export interface TradeFilterRuntime {
  from?: Date | null;
  to?: Date | null;
  q?: string;
  type?: TradeType;
}

export interface TradeListItem {
  id: string;
  symbol: string;
  symbol_name: string;
  side: 'long' | 'short';
  entry_at: string;
  entry_price: number;
  exit_at: string | null;
  exit_price: number | null;
  qty: number;
  pnl: number | null;
  pnl_pct: number | null;
  tag: 'profit' | 'loss' | 'flat';
}
```

## テスト

### テスト実行
```bash
npm test FilterDialog
```

### テストカバレッジ
- フィルターダイアログの表示
- トレードタイプ選択
- 銘柄検索入力
- 日付選択
- フォーム送信
- キーボード操作（ESC）

## スタイリング

### Tailwind CSS使用
- レスポンシブ対応
- ダークモード非対応（必要に応じて拡張可能）
- アクセシビリティ対応（aria-label, role など）

### カスタマイズポイント
- カラーテーマの変更
- フォントサイズの調整
- アニメーション効果の追加
- モバイル対応の強化

## 注意事項

### 依存関係
- React 18+
- TypeScript 4.5+
- Tailwind CSS 3.0+
- shadcn/ui（Button, Input, Dialog）

### ブラウザサポート
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### パフォーマンス
- 大量データ（1000件以上）でのページング対応
- 検索API呼び出しのデバウンス（将来拡張）
- 仮想スクロール（必要に応じて）

## 今後の拡張

### 機能拡張
- [ ] 詳細フィルター（timeframe, side）
- [ ] フィルター履歴・お気に入り
- [ ] エクスポート機能
- [ ] ソート機能

### UI/UX改善
- [ ] ダークモード対応
- [ ] モバイル最適化
- [ ] アニメーション強化
- [ ] キーボードショートカット

### パフォーマンス
- [ ] 検索デバウンス
- [ ] 無限スクロール
- [ ] キャッシュ機能
- [ ] オフライン対応
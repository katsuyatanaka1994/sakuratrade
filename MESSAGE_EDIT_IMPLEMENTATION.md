# メッセージ編集機能実装ガイド

## 概要

トレードチャット画面に「メッセージ編集」機能を追加しました。ユーザー自身が送信したメッセージに編集アイコン（✏️）を表示し、メッセージの内容を編集できるようになります。

## 実装内容

### 🆕 新規作成ファイル

#### フロントエンド
- `frontend/src/types/chat.ts` - 新しいチャットメッセージの型定義
- `frontend/src/components/MessageItem.tsx` - 編集アイコン付きメッセージカード
- `frontend/src/components/EditEntryModal.tsx` - ENTRY編集用モーダル
- `frontend/src/components/EditExitModal.tsx` - EXIT編集用モーダル  
- `frontend/src/components/ChatInputCard.tsx` - 編集モード対応チャット入力
- `frontend/src/components/MessageEditIntegration.tsx` - 統合コンポーネント
- `frontend/src/components/__tests__/MessageEdit.test.tsx` - E2Eテスト

#### バックエンド
- `app/schemas/chat_message.py` - メッセージAPIスキーマ
- `alembic/versions/create_chat_messages_table.py` - データベースマイグレーション

#### 🔧 更新ファイル
- `frontend/src/services/api.ts` - チャットメッセージAPI関数を追加
- `app/models.py` - ChatMessageモデルを追加
- `app/routers/chats.py` - メッセージ操作APIエンドポイントを追加

## 機能仕様

### UI/UX要件
✅ **編集アイコン表示**
- 自分のメッセージのみ、カード右下に✏️編集アイコンを表示
- PC: hover でフェードイン、キーボード: focus-within で表示
- モバイル対応: タップでアクセス可能

✅ **編集アクション**
- **TEXT**: ✏️クリック → 画面下の入力カードに本文転送 → 「更新」で PATCH
- **ENTRY/EXIT**: ✏️クリック → モーダル編集 → 保存で PATCH

✅ **状態・UX**
- 保存中はスピナー/ボタン無効化、二重送信防止
- 成功時は該当メッセージの表示を即時更新
- 権限違反では編集アイコン非表示

### データ型

```typescript
// メッセージタイプ
export type ChatMessageType = 'TEXT' | 'ENTRY' | 'EXIT';

// エントリーペイロード
export type EntryPayload = {
  symbolCode: string;    // 銘柄コード（必須）
  symbolName: string;    // 銘柄名（必須）
  side: 'LONG' | 'SHORT'; // サイド（必須）
  price: number;         // 価格（必須、>0）
  qty: number;          // 数量（必須、>0）
  note?: string;        // メモ（任意）
  executedAt?: string;  // 実行日時（任意）
  tradeId: string;      // トレードID（必須）
};

// エグジットペイロード  
export type ExitPayload = {
  tradeId: string;      // トレードID（必須）
  exitPrice: number;    // 決済価格（必須、>0）
  exitQty: number;      // 決済数量（必須、>0）
  note?: string;        // メモ（任意）
  executedAt?: string;  // 決済日時（任意）
};
```

### API仕様

#### PATCH `/chats/messages/{messageId}`

**TEXT更新例:**
```json
{
  "type": "TEXT", 
  "text": "新しい本文"
}
```

**ENTRY更新例:**
```json
{
  "type": "ENTRY",
  "payload": {
    "symbolCode": "6501",
    "symbolName": "日立製作所", 
    "side": "SHORT",
    "price": 4050,
    "qty": 100,
    "note": "追加メモ",
    "tradeId": "t_123"
  }
}
```

**EXIT更新例:**
```json
{
  "type": "EXIT",
  "payload": {
    "tradeId": "t_123",
    "exitPrice": 3980, 
    "exitQty": 100,
    "note": "利確"
  }
}
```

## セットアップ手順

### 1. データベースマイグレーション実行

```bash
cd /path/to/project
alembic upgrade head
```

### 2. 依存関係のインストール（必要に応じて）

```bash
# フロントエンド
cd frontend
npm install

# バックエンド  
cd ..
pip install -r app/requirements.txt
```

### 3. 既存コンポーネントへの統合

既存の`Trade.tsx`コンポーネントで`MessageEditIntegration`を使用:

```tsx
import MessageEditIntegration from './components/MessageEditIntegration';

// Trade.tsx内で
<MessageEditIntegration
  messages={messages}
  currentUserId="user"
  chatInput={chatInput}
  onChatInputChange={setChatInput}
  onMessageSubmit={handleChatSubmit}
  onFileUpload={handleFileUpload}
  onImageClick={setSelectedImageUrl}
  onMessagesUpdate={setMessages}
/>
```

## テスト実行

```bash
# フロントエンドテスト
cd frontend
npm run test -- MessageEdit.test.tsx

# バックエンドテスト（APIエンドポイント）
cd ..
pytest app/tests/ -k "test_chat_message"
```

## 受け入れ基準チェックリスト

- [ ] 自分のメッセージのみ ✏️ が表示される
- [ ] 他人のメッセージには編集アイコンが表示されない  
- [ ] **ENTRY**: ✏️→モーダルがプレフィルされる → 値変更→保存→表示更新
- [ ] **EXIT**: 同上、損益の派生表示も更新される
- [ ] **TEXT**: ✏️→入力カードに本文転送 → 「更新」ボタンでPATCH → メッセージ差し替え
- [ ] 保存中は多重クリック不可、失敗時はエラーメッセージ表示
- [ ] モバイルでも編集に到達できる導線がある
- [ ] スクリーンリーダーで「メッセージを編集」と読み上げられる

## アクセシビリティ対応

✅ **実装済み**
- `aria-label="メッセージを編集"` 
- キーボードナビゲーション（Enter/Space で編集起動）
- フォーカス管理とスクリーンリーダー対応
- エラーメッセージとフィールドの関連付け

## 今後の拡張ポイント

1. **競合・監査機能**
   - 楽観ロック実装（`If-Unmodified-Since`）
   - 編集履歴ログ（`chat_edits` テーブル）

2. **UI改善**
   - リアルタイム編集表示（WebSocket）
   - より詳細なバリデーションメッセージ
   - 編集差分の可視化

3. **権限管理**
   - 正式な認証システム統合
   - ロールベース編集権限

## トラブルシューティング

### よくある問題

**Q: 編集アイコンが表示されない**
A: `currentUserId` と `message.authorId` が一致しているか確認

**Q: API エラーが発生する**
A: データベースマイグレーションが実行されているか、CORS設定を確認

**Q: モーダルが開かない** 
A: UI コンポーネントライブラリの依存関係を確認

---

## 開発者向け情報

**実装アーキテクチャ:**
- フロントエンド: React + TypeScript + Tailwind CSS
- バックエンド: FastAPI + SQLAlchemy + Alembic
- 状態管理: 楽観更新 with 手動同期
- テスト: Vitest + React Testing Library

**コード品質:**
- TypeScript 型安全性
- コンポーネント分離設計  
- エラーハンドリング
- 包括的テストカバレッジ
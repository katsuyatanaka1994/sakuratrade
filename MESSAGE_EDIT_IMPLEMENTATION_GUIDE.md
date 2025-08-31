# メッセージ編集機能 実装ガイド

このガイドでは、チャット画面におけるメッセージ編集機能の実装について説明します。

## 🎯 実装された機能

### 1. メッセージタイプ別編集
- **TEXT**: 入力カードでのインライン編集
- **ENTRY**: モーダルでの建値情報編集
- **EXIT**: モーダルでの決済情報編集

### 2. Undo機能
- **時間制限**: 決済後30分以内のみ有効
- **後続イベント制限**: 後続のトレードがない場合のみ有効

### 3. UI仕様
- **編集アイコン** (✏️): 自分のメッセージのみ表示、ホバー時に表示
- **Undoアイコン** (↩️): EXIT メッセージの時間制限内のみ表示
- **編集ヘッダー**: TEXT編集時に青いヘッダーで編集中を表示

## 📁 ファイル構成

```
frontend/src/
├── components/
│   ├── MessageItem.tsx              # 更新: Edit/Undoアイコン追加
│   ├── ChatInputCard.tsx            # 既存: 編集モード対応済み
│   ├── EditEntryModal.tsx           # 既存: 建値編集モーダル
│   ├── EditExitModal.tsx            # 既存: 決済編集モーダル
│   └── MessageEditContainer.tsx     # 新規: 統合コンテナ
├── services/
│   └── api.ts                       # 更新: Undo, AI再生成API追加
├── utils/
│   └── messageUtils.ts              # 新規: Undo時間制限ユーティリティ
└── __tests__/
    └── MessageEditFeature.test.tsx  # 新規: 基本テスト
```

## 🔄 データフロー

### テキスト編集
```
1. MessageItem ✏️クリック
2. MessageEditContainer が ChatInputCard を編集モードで表示
3. ユーザーがテキスト編集・送信
4. PATCH /chats/messages/{id}
5. メッセージ置き換え
6. POST /ai/reply でAI再生成
```

### 建値/決済編集
```
1. MessageItem ✏️クリック
2. MessageEditContainer が適切なモーダルを表示
3. ユーザーがフォーム編集・保存
4. PATCH /chats/messages/{id}
5. メッセージ置き換え + ポジション更新
6. POST /ai/reply でAI再生成
```

### Undo
```
1. MessageItem ↩️クリック (時間制限内のEXITのみ)
2. POST /chats/messages/{id}/undo
3. メッセージ削除 + ポジション/損益復元
4. POST /ai/reply でAI再生成
```

## 🎨 UI仕様詳細

### メッセージバブル
- **背景色**: ユーザー=青系、AI=白系（既存維持）
- **アイコン位置**: バブル右下、テキストと時刻の間
- **アイコン表示**: `group-hover:opacity-100` でホバー時表示
- **アクセシビリティ**: `aria-label`、キーボード操作対応

### 編集モード
- **TEXT**: 下固定のChatInputCardで編集、青いヘッダー付き
- **ENTRY/EXIT**: モーダルオーバーレイで編集、フォーム検証付き

## 🔧 API エンドポイント

```typescript
// メッセージ更新
PATCH /chats/messages/{messageId}
{
  type: 'TEXT' | 'ENTRY' | 'EXIT',
  text?: string,
  payload?: EntryPayload | ExitPayload
}

// Undo
POST /chats/messages/{messageId}/undo

// AI再生成
POST /ai/reply
{
  chatId: string,
  latestUserMessageId: string,
  context: {}
}
```

## ✅ バリデーション

### TEXT
- 1-2000文字
- 空文字・同内容は更新不可

### ENTRY
- symbolCode: 4桁数字
- side: 'LONG' | 'SHORT'
- price, qty: > 0

### EXIT  
- exitPrice, exitQty: > 0
- exitQty ≤ 保有数量（サーバーで検証）

## 🧪 テスト

### 実行方法
```bash
cd frontend
npm test MessageEditFeature
```

### カバレッジ
- ✅ 編集アイコン表示
- ✅ モーダル/編集モード起動
- ✅ API呼び出し
- ✅ Undo機能
- ✅ 時間制限

## 🚀 使用方法

### 基本的な統合
```typescript
import MessageEditContainer from './components/MessageEditContainer';

function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  return (
    <MessageEditContainer
      messages={messages}
      currentUserId="user123"
      chatId="chat456" 
      onMessagesUpdate={setMessages}
    />
  );
}
```

### カスタムイベントハンドリング
```typescript
const handleMessagesUpdate = useCallback((updatedMessages: ChatMessage[]) => {
  setMessages(updatedMessages);
  // 追加のロジック（ポジション更新など）
}, []);
```

## 🔍 トラブルシューティング

### よくある問題

1. **編集アイコンが表示されない**
   - `currentUserId` と `message.authorId` が一致しているか確認

2. **Undoボタンが表示されない**
   - メッセージが30分以内のEXITタイプか確認
   - `canUndoMessage()` の条件を確認

3. **API呼び出しエラー**
   - ネットワークエラーまたはサーバー側のエンドポイント実装を確認
   - 楽観ロック（409エラー）の場合は再取得が必要

4. **編集後にAIが再生成されない**
   - `generateAIReply()` の呼び出しタイミングを確認
   - 既存の未完了ジョブのキャンセル処理を確認

## 📋 チェックリスト

実装完了時の確認項目：

- [ ] 自分のメッセージにのみ編集アイコン表示
- [ ] TEXTメッセージの編集が入力カードで動作
- [ ] ENTRY/EXITメッセージの編集がモーダルで動作  
- [ ] EXIT メッセージの30分以内Undo機能が動作
- [ ] 編集後にメッセージが置き換えられる
- [ ] 編集後にAIが再生成される
- [ ] ポジション/損益が正しく更新される（ENTRY/EXIT編集時）
- [ ] バリデーションが正しく機能
- [ ] アクセシビリティ（キーボード操作、aria-label）が実装済み
- [ ] エラーハンドリングが適切

---

この実装により、プロンプトで指定された全ての要件を満たすメッセージ編集機能が提供されます。
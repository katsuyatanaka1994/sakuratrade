import React, { useState } from 'react';

// 簡単なテスト用コンポーネント - 建値入力編集機能の動作確認用
export const TestEntryEdit: React.FC = () => {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [autoFilled, setAutoFilled] = useState(false);
  const [symbolInputMode, setSymbolInputMode] = useState<'auto' | 'manual'>('auto');
  const [autoSymbolBadge, setAutoSymbolBadge] = useState(true);

  // 実際のTrade.tsxと同じロジック
  const shouldShowAutoBadge = (() => {
    const isEditing = !!editingMessageId;
    const shouldShowBadge = !isEditing && (autoFilled || (symbolInputMode === 'auto' && autoSymbolBadge));
    return shouldShowBadge;
  })();

  return (
    <div className="p-4 border border-gray-300 rounded-lg max-w-md">
      <h3 className="text-lg font-bold mb-4">建値入力編集テスト</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm">編集モード:</label>
          <button
            className={`px-3 py-1 rounded ${editingMessageId ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
            onClick={() => setEditingMessageId(editingMessageId ? null : 'test-message-id')}
          >
            {editingMessageId ? '編集中 (ID: ' + editingMessageId + ')' : '新規入力'}
          </button>
        </div>

        <div>
          <label className="block text-sm">AutoFilled:</label>
          <button
            className={`px-3 py-1 rounded ${autoFilled ? 'bg-blue-500 text-white' : 'bg-gray-300'}`}
            onClick={() => setAutoFilled(!autoFilled)}
          >
            {autoFilled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div>
          <label className="block text-sm">Symbol Input Mode:</label>
          <button
            className={`px-3 py-1 rounded ${symbolInputMode === 'auto' ? 'bg-purple-500 text-white' : 'bg-orange-500 text-white'}`}
            onClick={() => setSymbolInputMode(symbolInputMode === 'auto' ? 'manual' : 'auto')}
          >
            {symbolInputMode.toUpperCase()}
          </button>
        </div>

        <div>
          <label className="block text-sm">Auto Symbol Badge:</label>
          <button
            className={`px-3 py-1 rounded ${autoSymbolBadge ? 'bg-cyan-500 text-white' : 'bg-gray-300'}`}
            onClick={() => setAutoSymbolBadge(!autoSymbolBadge)}
          >
            {autoSymbolBadge ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="border-t pt-3">
          <div className="text-lg font-semibold">
            結果: autoBadge = 
            <span className={`ml-2 px-2 py-1 rounded ${shouldShowAutoBadge ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {shouldShowAutoBadge ? 'TRUE (表示)' : 'FALSE (非表示)'}
            </span>
          </div>
          
          <div className="mt-2 text-sm text-gray-600">
            <div>編集中: {editingMessageId ? '✅ はい' : '❌ いいえ'}</div>
            <div>AutoFilled: {autoFilled ? '✅' : '❌'}</div>
            <div>Auto Mode: {symbolInputMode === 'auto' ? '✅' : '❌'}</div>
            <div>Symbol Badge: {autoSymbolBadge ? '✅' : '❌'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestEntryEdit;
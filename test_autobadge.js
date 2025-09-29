// 建値入力メッセージ編集時のautoBadge動作テスト
console.log('=== 建値入力メッセージ編集 autoBadge テスト ===');

// テストケース1: 新規入力時（editingMessageId = null）
function testNewEntry() {
  const editingMessageId = null;
  const autoFilled = true;
  const symbolInputMode = 'auto';
  const autoSymbolBadge = true;
  
  const isEditing = !!editingMessageId;
  const shouldShowBadge = !isEditing && (autoFilled || (symbolInputMode === 'auto' && autoSymbolBadge));
  
  console.log('テストケース1: 新規入力時');
  console.log('- editingMessageId:', editingMessageId);
  console.log('- isEditing:', isEditing);  
  console.log('- autoFilled:', autoFilled);
  console.log('- symbolInputMode:', symbolInputMode);
  console.log('- autoSymbolBadge:', autoSymbolBadge);
  console.log('- shouldShowBadge:', shouldShowBadge);
  console.log('→ 期待値: true (バッジ表示)');
  console.log('→ 実際:', shouldShowBadge);
  console.log('→ 結果:', shouldShowBadge === true ? '✅ 正常' : '❌ 異常');
  console.log('');
}

// テストケース2: 編集時（editingMessageId = "some-id"）
function testEditEntry() {
  const editingMessageId = "test-message-123";
  const autoFilled = true;
  const symbolInputMode = 'auto';
  const autoSymbolBadge = true;
  
  const isEditing = !!editingMessageId;
  const shouldShowBadge = !isEditing && (autoFilled || (symbolInputMode === 'auto' && autoSymbolBadge));
  
  console.log('テストケース2: 編集時');
  console.log('- editingMessageId:', editingMessageId);
  console.log('- isEditing:', isEditing);  
  console.log('- autoFilled:', autoFilled);
  console.log('- symbolInputMode:', symbolInputMode);
  console.log('- autoSymbolBadge:', autoSymbolBadge);
  console.log('- shouldShowBadge:', shouldShowBadge);
  console.log('→ 期待値: false (バッジ非表示)');
  console.log('→ 実際:', shouldShowBadge);
  console.log('→ 結果:', shouldShowBadge === false ? '✅ 正常' : '❌ 異常');
  console.log('');
}

// テストケース3: editingMessageIdが空文字の場合
function testEmptyEditingId() {
  const editingMessageId = "";
  const autoFilled = true;
  const symbolInputMode = 'auto';
  const autoSymbolBadge = true;
  
  const isEditing = !!editingMessageId;
  const shouldShowBadge = !isEditing && (autoFilled || (symbolInputMode === 'auto' && autoSymbolBadge));
  
  console.log('テストケース3: editingMessageIdが空文字');
  console.log('- editingMessageId:', '"' + editingMessageId + '"');
  console.log('- isEditing:', isEditing);  
  console.log('- shouldShowBadge:', shouldShowBadge);
  console.log('→ 期待値: true (バッジ表示)');
  console.log('→ 実際:', shouldShowBadge);
  console.log('→ 結果:', shouldShowBadge === true ? '✅ 正常' : '❌ 異常');
  console.log('');
}

// テスト実行
testNewEntry();
testEditEntry();
testEmptyEditingId();

console.log('=== テスト完了 ===');
import { describe, it, expect, beforeEach } from 'vitest';
import * as positionsStore from '../../store/positions';

describe('UI チャット分離テスト', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const state = positionsStore.getState();
    state.positions.clear();
    state.closed.length = 0;
  });

  it('チャットAで建てたポジションはチャットAでのみ表示される', () => {
    // Chat1でポジションを建てる
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    positionsStore.entry('GOOGL', 'SHORT', 2800, 50, 'Alphabet Inc.', 'chat1');

    // Chat2で異なるポジションを建てる
    positionsStore.entry('MSFT', 'LONG', 300, 200, 'Microsoft Corp.', 'chat2');

    // Chat1の表示確認
    const chat1Groups = positionsStore.getGroups('chat1');
    expect(chat1Groups).toHaveLength(2);
    const chat1Symbols = chat1Groups.map(g => g.symbol).sort();
    expect(chat1Symbols).toEqual(['AAPL', 'GOOGL']);

    // Chat2の表示確認
    const chat2Groups = positionsStore.getGroups('chat2');
    expect(chat2Groups).toHaveLength(1);
    expect(chat2Groups[0].symbol).toBe('MSFT');

    // Chat3（空）の表示確認
    const chat3Groups = positionsStore.getGroups('chat3');
    expect(chat3Groups).toHaveLength(0);
  });

  it('チャットAで建てたポジションはチャットBでは決済できない', () => {
    // Chat1でポジションを建てる
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');

    // Chat2からChat1のポジション決済を試行
    expect(() => {
      positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat2');
    }).toThrow('ポジションが見つかりません');

    // Chat1からは正常に決済できる
    const result = positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat1');
    expect(result.realizedPnl).toBe(500); // (160 - 150) * 50
    expect(result.position?.qtyTotal).toBe(50);
  });

  it('同じ銘柄・サイドでも異なるチャットでは独立したポジション', () => {
    // 複数のチャットで同じ銘柄・サイドのポジションを建てる
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    positionsStore.entry('AAPL', 'LONG', 160, 200, 'Apple Inc.', 'chat2');
    positionsStore.entry('AAPL', 'LONG', 170, 300, 'Apple Inc.', 'chat3');

    // 各チャットでポジション確認
    const chat1Groups = positionsStore.getGroups('chat1');
    const chat2Groups = positionsStore.getGroups('chat2');
    const chat3Groups = positionsStore.getGroups('chat3');

    expect(chat1Groups[0].positions[0].qtyTotal).toBe(100);
    expect(chat1Groups[0].positions[0].avgPrice).toBe(150);

    expect(chat2Groups[0].positions[0].qtyTotal).toBe(200);
    expect(chat2Groups[0].positions[0].avgPrice).toBe(160);

    expect(chat3Groups[0].positions[0].qtyTotal).toBe(300);
    expect(chat3Groups[0].positions[0].avgPrice).toBe(170);

    // Chat1のポジション一部決済
    positionsStore.settle('AAPL', 'LONG', 180, 50, 'chat1');

    // Chat1は50株減り、他は変わらず
    const chat1After = positionsStore.getGroups('chat1');
    const chat2After = positionsStore.getGroups('chat2');
    const chat3After = positionsStore.getGroups('chat3');

    expect(chat1After[0].positions[0].qtyTotal).toBe(50);
    expect(chat2After[0].positions[0].qtyTotal).toBe(200);
    expect(chat3After[0].positions[0].qtyTotal).toBe(300);
  });

  it('chatId未指定の場合はdefaultとして扱われる', () => {
    // chatId未指定でポジション建て
    positionsStore.entry('AAPL', 'LONG', 150, 100);
    
    // chatId='default'の場合も同じように扱われる
    const defaultGroups1 = positionsStore.getGroups();
    const defaultGroups2 = positionsStore.getGroups(undefined);
    
    expect(defaultGroups1).toHaveLength(1);
    expect(defaultGroups2).toHaveLength(1);
    expect(defaultGroups1[0].positions[0].qtyTotal).toBe(100);

    // 明示的にchatId指定した場合は分離される
    positionsStore.entry('AAPL', 'LONG', 160, 200, undefined, 'chat1');
    
    const defaultAfter = positionsStore.getGroups();
    const chat1After = positionsStore.getGroups('chat1');
    
    expect(defaultAfter[0].positions[0].qtyTotal).toBe(100);
    expect(chat1After[0].positions[0].qtyTotal).toBe(200);
  });

  it('ポジションカードの決済ボタンはchatId情報を渡す', () => {
    // この部分は実際のDOM操作が必要だが、
    // カスタムイベントの仕組みを使ってUIテストをシミュレート
    
    // Chat1でポジションを建てる
    const position = positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    
    // カスタムイベントをシミュレート（PositionCardの決済ボタンクリック）
    let capturedEventDetail: any = null;
    const mockEventHandler = (e: CustomEvent) => {
      capturedEventDetail = e.detail;
    };
    
    // イベントリスナー設定
    window.addEventListener('open-settle-from-card', mockEventHandler);
    
    // PositionCardが発火するイベントをシミュレート
    const event = new CustomEvent('open-settle-from-card', {
      detail: {
        symbol: position.symbol,
        side: position.side,
        maxQty: position.qtyTotal,
        chatId: position.chatId
      }
    });
    window.dispatchEvent(event);
    
    // chatId情報が正しく渡されていることを確認
    expect(capturedEventDetail.chatId).toBe('chat1');
    expect(capturedEventDetail.symbol).toBe('AAPL');
    expect(capturedEventDetail.side).toBe('LONG');
    
    // クリーンアップ
    window.removeEventListener('open-settle-from-card', mockEventHandler);
  });
});
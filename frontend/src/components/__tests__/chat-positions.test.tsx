import { describe, it, expect, beforeEach } from 'vitest';
import * as positionsStore from '../../store/positions';

describe('チャット別ポジション分離テスト', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const state = positionsStore.getState();
    state.positions.clear();
    state.closed.length = 0;
  });

  it('異なるチャットで同じ銘柄・サイドのポジションを建てられる', () => {
    // Chat1でAAPL LONGポジションを建てる
    const pos1 = positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    // Chat2でも同じAAPL LONGポジションを建てる
    const pos2 = positionsStore.entry('AAPL', 'LONG', 160, 200, 'Apple Inc.', 'chat2');

    expect(pos1.chatId).toBe('chat1');
    expect(pos1.qtyTotal).toBe(100);
    expect(pos1.avgPrice).toBe(150);

    expect(pos2.chatId).toBe('chat2');
    expect(pos2.qtyTotal).toBe(200);
    expect(pos2.avgPrice).toBe(160);
  });

  it('チャットAのポジションはチャットBでは表示されない', () => {
    // Chat1でポジションを建てる
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    positionsStore.entry('GOOGL', 'SHORT', 2800, 50, 'Alphabet Inc.', 'chat1');

    // Chat2でポジションを建てる
    positionsStore.entry('MSFT', 'LONG', 300, 150, 'Microsoft Corp.', 'chat2');

    const chat1Groups = positionsStore.getGroups('chat1');
    const chat2Groups = positionsStore.getGroups('chat2');

    // Chat1には2つの銘柄がある
    expect(chat1Groups).toHaveLength(2);
    const chat1Symbols = chat1Groups.map(g => g.symbol).sort();
    expect(chat1Symbols).toEqual(['AAPL', 'GOOGL']);

    // Chat2には1つの銘柄のみ
    expect(chat2Groups).toHaveLength(1);
    expect(chat2Groups[0].symbol).toBe('MSFT');
  });

  it('チャットAのポジションはチャットBでは決済できない', () => {
    // Chat1でポジションを建てる
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');

    // Chat2からChat1のポジションを決済しようとするとエラー
    expect(() => {
      positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat2');
    }).toThrow('ポジションが見つかりません');

    // Chat1からは正常に決済できる
    expect(() => {
      positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat1');
    }).not.toThrow();
  });

  it('同じチャット内では同じ銘柄・サイドのポジションは統合される', () => {
    // 同じチャットで同じ銘柄・サイドのポジションを複数回建てる
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    positionsStore.entry('AAPL', 'LONG', 160, 100, 'Apple Inc.', 'chat1');

    const groups = positionsStore.getGroups('chat1');
    expect(groups).toHaveLength(1);
    expect(groups[0].positions).toHaveLength(1);
    
    const position = groups[0].positions[0];
    expect(position.qtyTotal).toBe(200);
    expect(position.avgPrice).toBe(155); // (150*100 + 160*100) / 200 = 155
  });

  it('異なるチャットでは同じ銘柄・サイドでも別々に管理される', () => {
    // Chat1でポジション建て
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    // Chat2で同じ銘柄・サイドでポジション建て
    positionsStore.entry('AAPL', 'LONG', 160, 200, 'Apple Inc.', 'chat2');

    const chat1Groups = positionsStore.getGroups('chat1');
    const chat2Groups = positionsStore.getGroups('chat2');

    // それぞれのチャットで1つずつのポジションがある
    expect(chat1Groups[0].positions[0].qtyTotal).toBe(100);
    expect(chat1Groups[0].positions[0].avgPrice).toBe(150);

    expect(chat2Groups[0].positions[0].qtyTotal).toBe(200);
    expect(chat2Groups[0].positions[0].avgPrice).toBe(160);

    // Chat1のポジションを一部決済
    positionsStore.settle('AAPL', 'LONG', 170, 50, 'chat1');
    
    // Chat1は50株残り、Chat2は200株のまま
    const chat1AfterSettle = positionsStore.getGroups('chat1');
    const chat2AfterSettle = positionsStore.getGroups('chat2');

    expect(chat1AfterSettle[0].positions[0].qtyTotal).toBe(50);
    expect(chat2AfterSettle[0].positions[0].qtyTotal).toBe(200);
  });

  it('chatIdなしの場合はdefaultとして扱われ後方互換性を保つ', () => {
    // chatIdなしでポジション建て
    positionsStore.entry('AAPL', 'LONG', 150, 100);
    // chatId='default'と同じ扱い
    positionsStore.entry('AAPL', 'LONG', 160, 100, undefined, undefined);

    const defaultGroups = positionsStore.getGroups();
    expect(defaultGroups).toHaveLength(1);
    expect(defaultGroups[0].positions[0].qtyTotal).toBe(200);

    // 決済も同様
    expect(() => {
      positionsStore.settle('AAPL', 'LONG', 170, 100);
    }).not.toThrow();
  });

  it('getLongShortQtyはチャット別に動作する', () => {
    // Chat1でロング・ショートポジション建て
    positionsStore.entry('AAPL', 'LONG', 150, 100, undefined, 'chat1');
    positionsStore.entry('AAPL', 'SHORT', 160, 50, undefined, 'chat1');

    // Chat2で同じ銘柄の異なるポジション建て
    positionsStore.entry('AAPL', 'LONG', 170, 200, undefined, 'chat2');

    const chat1Qty = positionsStore.getLongShortQty('AAPL', 'chat1');
    const chat2Qty = positionsStore.getLongShortQty('AAPL', 'chat2');

    expect(chat1Qty).toEqual({ long: 100, short: 50 });
    expect(chat2Qty).toEqual({ long: 200, short: 0 });
  });
});
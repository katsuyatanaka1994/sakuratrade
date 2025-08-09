import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as positionsStore from '../../store/positions';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

describe('ポジション永続化テスト', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset the store state
    const state = positionsStore.getState();
    state.positions.clear();
    state.closed.length = 0;
  });

  it('ポジション作成時にlocalStorageに保存される', () => {
    // Create a position
    const position = positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');

    // Check if localStorage.setItem was called
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'positions_data', 
      expect.stringContaining('AAPL:LONG:chat1')
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'closed_positions_data', 
      '[]'
    );

    expect(position.symbol).toBe('AAPL');
    expect(position.chatId).toBe('chat1');
  });

  it('ポジション決済時にlocalStorageが更新される', () => {
    // Create a position
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    
    // Clear previous calls
    vi.clearAllMocks();

    // Settle the position
    const result = positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat1');

    // Check if localStorage.setItem was called again
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'positions_data', 
      expect.stringContaining('AAPL:LONG:chat1')
    );
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'closed_positions_data', 
      '[]'
    );

    expect(result.realizedPnl).toBe(500); // (160 - 150) * 50
  });

  it('全ポジション決済時にclosed配列に移動される', () => {
    // Create a position
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    
    // Settle all shares
    positionsStore.settle('AAPL', 'LONG', 160, 100, 'chat1');

    // Check if localStorage was updated with closed position
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'closed_positions_data',
      expect.stringContaining('AAPL')
    );
  });

  it('複数チャットのポジションが正しく保存される', () => {
    // Create positions in different chats
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    positionsStore.entry('GOOGL', 'SHORT', 2800, 50, 'Alphabet Inc.', 'chat2');
    positionsStore.entry('MSFT', 'LONG', 300, 200, 'Microsoft Corp.', 'chat3');

    // Check that all positions are saved
    const lastCall = localStorageMock.setItem.mock.calls
      .filter(call => call[0] === 'positions_data')
      .pop();
    
    expect(lastCall).toBeDefined();
    const savedData = lastCall![1];
    expect(savedData).toContain('AAPL:LONG:chat1');
    expect(savedData).toContain('GOOGL:SHORT:chat2');
    expect(savedData).toContain('MSFT:LONG:chat3');
  });

  it('同じ銘柄・サイドでも異なるチャットでは別々に保存される', () => {
    // Create same symbol/side in different chats
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    positionsStore.entry('AAPL', 'LONG', 160, 200, 'Apple Inc.', 'chat2');

    const lastCall = localStorageMock.setItem.mock.calls
      .filter(call => call[0] === 'positions_data')
      .pop();
    
    expect(lastCall).toBeDefined();
    const savedData = lastCall![1];
    expect(savedData).toContain('AAPL:LONG:chat1');
    expect(savedData).toContain('AAPL:LONG:chat2');

    // Verify they are separate positions
    const groups1 = positionsStore.getGroups('chat1');
    const groups2 = positionsStore.getGroups('chat2');
    
    expect(groups1[0].positions[0].qtyTotal).toBe(100);
    expect(groups1[0].positions[0].avgPrice).toBe(150);
    
    expect(groups2[0].positions[0].qtyTotal).toBe(200);
    expect(groups2[0].positions[0].avgPrice).toBe(160);
  });

  it('localStorage読み込みエラー時はデフォルト値を使用', () => {
    // Mock localStorage.getItem to throw an error
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    // This should not throw an error and use default empty state
    const groups = positionsStore.getGroups();
    expect(groups).toEqual([]);
  });

  it('localStorage保存エラー時も処理が継続される', () => {
    // Mock localStorage.setItem to throw an error
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('localStorage save error');
    });

    // This should not throw an error
    expect(() => {
      positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    }).not.toThrow();
  });
});
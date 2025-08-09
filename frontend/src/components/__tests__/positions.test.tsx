import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RightPanePositions from '../positions/RightPanePositions';
import * as positionsStore from '../../store/positions';

// Mock the positions store
vi.mock('../../store/positions', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGroups: vi.fn(),
    subscribe: vi.fn(),
  };
});

// Mock the validation utility
vi.mock('../../lib/validation', () => ({
  formatLSHeader: vi.fn((long, short) => `L${long}:S${short}`),
}));

describe('RightPanePositions', () => {
  const mockSubscribe = vi.mocked(positionsStore.subscribe);
  const mockGetGroups = vi.mocked(positionsStore.getGroups);

  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockReturnValue(() => {});
  });

  it('チャットIDなしの場合は全ポジションを表示', () => {
    const mockGroups = [
      {
        symbol: 'AAPL',
        positions: [
          {
            symbol: 'AAPL',
            side: 'LONG' as const,
            qtyTotal: 100,
            avgPrice: 150,
            lots: [],
            realizedPnl: 0,
            updatedAt: new Date().toISOString(),
            chatId: 'chat1',
          },
        ],
      },
    ];
    mockGetGroups.mockReturnValue(mockGroups);

    render(<RightPanePositions />);

    expect(mockGetGroups).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('オープンポジション')).toBeInTheDocument();
  });

  it('特定のチャットIDが指定された場合はそのチャットのポジションのみ表示', () => {
    const mockGroups = [
      {
        symbol: 'AAPL',
        positions: [
          {
            symbol: 'AAPL',
            side: 'LONG' as const,
            qtyTotal: 100,
            avgPrice: 150,
            lots: [],
            realizedPnl: 0,
            updatedAt: new Date().toISOString(),
            chatId: 'chat1',
          },
        ],
      },
    ];
    mockGetGroups.mockReturnValue(mockGroups);

    render(<RightPanePositions chatId="chat1" />);

    expect(mockGetGroups).toHaveBeenCalledWith('chat1');
    expect(screen.getByText('オープンポジション')).toBeInTheDocument();
  });

  it('ポジションがない場合はメッセージを表示', () => {
    mockGetGroups.mockReturnValue([]);

    render(<RightPanePositions chatId="chat1" />);

    expect(screen.getByText('ポジションはまだありません')).toBeInTheDocument();
    expect(screen.getByText('オープンポジション')).toBeInTheDocument();
  });

  it('nullのチャットIDの場合は全ポジションを表示', () => {
    const mockGroups = [];
    mockGetGroups.mockReturnValue(mockGroups);

    render(<RightPanePositions chatId={null} />);

    expect(mockGetGroups).toHaveBeenCalledWith(undefined);
  });
});

describe('Position Store with ChatId', () => {
  beforeEach(() => {
    // Reset the store state before each test
    const state = positionsStore.getState();
    state.positions.clear();
    state.closed.length = 0;
  });

  it('chatIdを指定してポジションをエントリーできる', () => {
    const result = positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');

    expect(result.chatId).toBe('chat1');
    expect(result.symbol).toBe('AAPL');
    expect(result.qtyTotal).toBe(100);
  });

  it('同じチャットIDのポジションのみ取得できる', () => {
    // Chat1のポジションを作成
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');
    // Chat2のポジションを作成
    positionsStore.entry('GOOGL', 'LONG', 2800, 50, 'Alphabet Inc.', 'chat2');

    const chat1Groups = positionsStore.getGroups('chat1');
    const chat2Groups = positionsStore.getGroups('chat2');

    expect(chat1Groups).toHaveLength(1);
    expect(chat1Groups[0].symbol).toBe('AAPL');

    expect(chat2Groups).toHaveLength(1);
    expect(chat2Groups[0].symbol).toBe('GOOGL');
  });

  it('異なるチャットのポジションは決済できない', () => {
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');

    expect(() => {
      positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat2');
    }).toThrow('このチャットのポジションではありません');
  });

  it('同じチャットのポジションは決済できる', () => {
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');

    const result = positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat1');

    expect(result.realizedPnl).toBe(500); // (160 - 150) * 50
    expect(result.position?.qtyTotal).toBe(50);
  });

  it('chatIdなしの場合は後方互換性を保つ', () => {
    positionsStore.entry('AAPL', 'LONG', 150, 100);

    const result = positionsStore.settle('AAPL', 'LONG', 160, 50);

    expect(result.realizedPnl).toBe(500);
  });
});
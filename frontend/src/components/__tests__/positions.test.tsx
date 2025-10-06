import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import RightPanePositions from '../positions/RightPanePositions';
import * as positionsStore from '../../store/positions';
import { renderWithProviders } from '../../test-utils/renderWithProviders';

// Mock the validation utility
vi.mock('../../lib/validation', () => ({
  formatLSHeader: vi.fn((long, short) => `L${long}:S${short}`),
}));

const symbolSuggestMocks = vi.hoisted(() => ({
  mockFindByCode: vi.fn(),
  mockSearch: vi.fn(),
}));

vi.mock('../../hooks/useSymbolSuggest', () => ({
  useSymbolSuggest: () => ({
    ready: true,
    search: symbolSuggestMocks.mockSearch,
    findByCode: symbolSuggestMocks.mockFindByCode,
  }),
}));

const { mockFindByCode, mockSearch } = symbolSuggestMocks;

describe('RightPanePositions', () => {
  let subscribers: Array<() => void> = [];
  let subscribeSpy: vi.SpyInstance<ReturnType<typeof positionsStore.subscribe>, Parameters<typeof positionsStore.subscribe>> | undefined;
  let getGroupsSpy: vi.SpyInstance<ReturnType<typeof positionsStore.getGroups>, Parameters<typeof positionsStore.getGroups>> | undefined;

  beforeEach(() => {
    mockFindByCode.mockReset();
    mockSearch.mockReset();
    subscribers = [];
    subscribeSpy?.mockRestore();
    getGroupsSpy?.mockRestore();
    subscribeSpy = vi.spyOn(positionsStore, 'subscribe');
    getGroupsSpy = vi.spyOn(positionsStore, 'getGroups');

    subscribeSpy.mockImplementation((listener) => {
      subscribers.push(listener);
      return () => {};
    });
  });

  afterEach(() => {
    getGroupsSpy?.mockRestore();
    subscribeSpy?.mockRestore();
    getGroupsSpy = undefined;
    subscribeSpy = undefined;
  });

  it('チャットIDなしの場合は全ポジションを表示', () => {
    renderWithProviders(<RightPanePositions />);

    expect(getGroupsSpy).not.toHaveBeenCalled();
    expect(screen.getByText('オープンポジション')).toBeInTheDocument();
    expect(screen.getByText('チャットを選択してください')).toBeInTheDocument();
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
            version: 1,
          },
        ],
      },
    ];
    getGroupsSpy!.mockReturnValue(mockGroups);

    renderWithProviders(<RightPanePositions chatId="chat1" />);

    expect(getGroupsSpy).toHaveBeenCalledWith('chat1');
    expect(screen.getByText('オープンポジション')).toBeInTheDocument();
  });

  it('ポジションがない場合はメッセージを表示', () => {
    getGroupsSpy!.mockReturnValue([]);

    renderWithProviders(<RightPanePositions chatId="chat1" />);

    expect(screen.getByText('ポジションはまだありません')).toBeInTheDocument();
    expect(screen.getByText('オープンポジション')).toBeInTheDocument();
  });

  it('nullのチャットIDの場合は全ポジションを表示', () => {
    renderWithProviders(<RightPanePositions chatId={null} />);

    expect(getGroupsSpy).not.toHaveBeenCalled();
  });

  it('ポジションカードに編集ボタンが表示されない', () => {
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
            status: 'OPEN' as const,
            ownerId: 'current_user',
            version: 1,
            chatId: 'chat1',
          },
        ],
      },
    ];

    getGroupsSpy!.mockReturnValue(mockGroups);

    renderWithProviders(<RightPanePositions chatId="chat1" />);

    expect(screen.queryByRole('button', { name: 'ポジションを編集' })).toBeNull();
  });

  it('編集後にカードの数値が更新される', () => {
    const initialGroups = [
      {
        symbol: 'AAPL',
        positions: [
          {
            symbol: 'AAPL',
            side: 'LONG' as const,
            qtyTotal: 100,
            avgPrice: 1500,
            lots: [],
            realizedPnl: 0,
            updatedAt: new Date('2024-01-01T00:00:00Z').toISOString(),
            chatId: 'chat1',
            version: 1,
          },
        ],
      },
    ];

    const updatedGroups = [
      {
        symbol: 'AAPL',
        positions: [
          {
            symbol: 'AAPL',
            side: 'LONG' as const,
            qtyTotal: 50,
            avgPrice: 2000,
            lots: [],
            realizedPnl: 0,
            updatedAt: new Date('2024-01-01T01:00:00Z').toISOString(),
            chatId: 'chat1',
            version: 2,
          },
        ],
      },
    ];

    getGroupsSpy!.mockReturnValue(initialGroups);

    renderWithProviders(<RightPanePositions chatId="chat1" />);

    getGroupsSpy!.mockReturnValue(updatedGroups);
    const [notify] = subscribers;
    act(() => {
      notify?.();
    });

    expect(screen.getByTestId('position-qty')).toHaveTextContent('保有 50株');
    expect(screen.getByTestId('position-avg-price')).toHaveTextContent('平均建値 ¥2,000');
    expect(screen.getByTestId('position-tp')).toHaveTextContent('¥2,100');
  });

  it('削除後にカードが消える', () => {
    const initialGroups = [
      {
        symbol: 'AAPL',
        positions: [
          {
            symbol: 'AAPL',
            side: 'LONG' as const,
            qtyTotal: 100,
            avgPrice: 1500,
            lots: [],
            realizedPnl: 0,
            updatedAt: new Date().toISOString(),
            chatId: 'chat1',
            version: 1,
          },
        ],
      },
    ];

    getGroupsSpy!.mockReturnValue(initialGroups);

    renderWithProviders(<RightPanePositions chatId="chat1" />);

    getGroupsSpy!.mockReturnValue([]);
    const [notify] = subscribers;
    act(() => {
      notify?.();
    });

    expect(screen.queryByTestId('position-qty')).toBeNull();
    expect(screen.getByText('ポジションはまだありません')).toBeInTheDocument();
  });

  it('ローディング中はスケルトンを表示する', () => {
    const groups = [
      {
        symbol: 'AAPL',
        positions: [
          {
            symbol: 'AAPL',
            side: 'LONG' as const,
            qtyTotal: 100,
            avgPrice: 1500,
            lots: [],
            realizedPnl: 0,
            updatedAt: new Date().toISOString(),
            chatId: 'chat1',
            version: 1,
          },
        ],
      },
    ];

    getGroupsSpy!.mockReturnValue(groups);

    renderWithProviders(<RightPanePositions chatId="chat1" />);

    act(() => {
      window.dispatchEvent(
        new CustomEvent('position-update-start', {
          detail: { symbol: 'AAPL', side: 'LONG', chatId: 'chat1' },
        })
      );
    });

    expect(screen.getByTestId('position-card-skeleton')).toBeInTheDocument();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('position-update-complete', {
          detail: {
            position: {
              symbol: 'AAPL',
              side: 'LONG',
              qtyTotal: 100,
              avgPrice: 1500,
              updatedAt: new Date().toISOString(),
              version: 2,
              chatId: 'chat1',
            },
          },
        })
      );
    });

    expect(screen.queryByTestId('position-card-skeleton')).toBeNull();
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
    }).toThrow(/ポジション/);
  });

  it('同じチャットのポジションは決済できる', () => {
    positionsStore.entry('AAPL', 'LONG', 150, 100, 'Apple Inc.', 'chat1');

    const result = positionsStore.settle('AAPL', 'LONG', 160, 50, 'chat1');

    expect(result.realizedPnl).toBe(500); // (160 - 150) * 50
    expect(result.position?.qtyTotal).toBe(50);
  });

  it('chatIdなしの場合はエラーになる', () => {
    expect(() => {
      positionsStore.entry('AAPL', 'LONG', 150, 100);
    }).toThrow('[positions.store] chatId is required for position operations');

    expect(() => {
      positionsStore.settle('AAPL', 'LONG', 160, 50);
    }).toThrow('[positions.store] chatId is required for position operations');
  });
});

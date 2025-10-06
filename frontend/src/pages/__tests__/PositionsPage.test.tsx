import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PositionsPage from '../PositionsPage';
import { applyPositionsSnapshot, clearAllPositions, makePositionKey, type Position } from '../../store/positions';
import { featureFlags } from '../../lib/features';

vi.mock('../../hooks/usePositionsLive', () => ({
  usePositionsLive: () => ({
    connectionState: 'connected',
    lastError: null,
    lastHeartbeat: null,
    reconnecting: false,
    requestSnapshot: vi.fn(),
  }),
}));

vi.mock('../../lib/api/positions', () => ({
  fetchPositionsList: vi.fn(async () => []),
}));

const CHAT_ID = 'chat-positions-page';

const basePosition = (overrides: Partial<Position>): Position => ({
  symbol: '7203',
  side: 'LONG',
  qtyTotal: 100,
  avgPrice: 1000,
  lots: [
    {
      price: 1000,
      qtyRemaining: 100,
      time: '2024-01-01T00:00:00Z',
    },
  ],
  realizedPnl: 0,
  updatedAt: '2024-01-01T00:00:00Z',
  status: 'OPEN',
  version: 1,
  chatId: CHAT_ID,
  note: undefined,
  memo: undefined,
  chartPattern: undefined,
  chartPatternLabel: undefined,
  patterns: undefined,
  ...overrides,
});

describe('PositionsPage', () => {
  beforeEach(async () => {
    featureFlags.livePositions = true;
    await act(async () => {
      clearAllPositions();
    });
  });

  afterEach(async () => {
    await act(async () => {
      clearAllPositions();
    });
  });

  it('renders cards sorted by updatedAt descending', async () => {
    applyPositionsSnapshot([
      basePosition({
        symbol: '6758',
        updatedAt: '2024-01-01T01:00:00Z',
      }),
      basePosition({
        symbol: '7203',
        updatedAt: '2024-01-02T00:00:00Z',
      }),
    ]);

    await act(async () => {
      render(
        <MemoryRouter>
          <PositionsPage />
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await screen.findByRole('status');

    await waitFor(() => {
      const cards = screen.getAllByTestId(/position-card-/);
      const latestKey = makePositionKey('7203', 'LONG', CHAT_ID);
      expect(cards[0].getAttribute('data-testid')).toBe(`position-card-${latestKey}`);
    });
  });

  it('keeps the status banner empty while live updates are enabled and connected', async () => {
    featureFlags.livePositions = true;

    await act(async () => {
      render(
        <MemoryRouter>
          <PositionsPage />
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/^$/);
  });

  it('shows disabled message when live positions feature is off', async () => {
    featureFlags.livePositions = false;

    await act(async () => {
      render(
        <MemoryRouter>
          <PositionsPage />
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('リアルタイム更新は無効化されています。');
  });

  it('renders chat links pointing to the selected chat', async () => {
    applyPositionsSnapshot([
      basePosition({
        symbol: '7203',
        name: 'トヨタ自動車',
        updatedAt: '2024-01-02T00:00:00Z',
      }),
    ]);

    await act(async () => {
      render(
        <MemoryRouter>
          <PositionsPage />
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const link = screen.getByRole('link', { name: /チャット画面へ$/ });
    expect(link).toHaveAttribute('href', `/trade?chat=${encodeURIComponent(CHAT_ID)}`);
  });

  it('omits cards for positions without a chatId', async () => {
    applyPositionsSnapshot([
      basePosition({ symbol: '7203', updatedAt: '2024-01-02T00:00:00Z' }),
      {
        ...basePosition({ symbol: '6758' }),
        chatId: undefined as unknown as string,
      },
    ]);

    await act(async () => {
      render(
        <MemoryRouter>
          <PositionsPage />
        </MemoryRouter>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await screen.findByRole('status');

    const cards = screen.getAllByTestId(/position-card-/);
    expect(cards).toHaveLength(1);
    const expectedKey = makePositionKey('7203', 'LONG', CHAT_ID);
    expect(cards[0].getAttribute('data-testid')).toBe(`position-card-${expectedKey}`);
    expect(screen.queryByText('現在、保有中のポジションはありません。')).not.toBeInTheDocument();
  });
});

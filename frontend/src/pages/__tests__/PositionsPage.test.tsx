import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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
  chatId: undefined,
  note: undefined,
  memo: undefined,
  chartPattern: undefined,
  chartPatternLabel: undefined,
  patterns: undefined,
  ...overrides,
});

describe('PositionsPage', () => {
  beforeEach(() => {
    featureFlags.livePositions = true;
    clearAllPositions();
  });

  afterEach(() => {
    clearAllPositions();
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
      render(<PositionsPage />);
    });
    await screen.findByRole('status');

    const cards = screen.getAllByTestId(/position-card-/);
    const latestKey = makePositionKey('7203', 'LONG', undefined);
    expect(cards[0].getAttribute('data-testid')).toBe(`position-card-${latestKey}`);
  });

  it('shows disabled message when live positions feature is off', async () => {
    featureFlags.livePositions = false;

    await act(async () => {
      render(<PositionsPage />);
    });

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('リアルタイム更新は無効化されています。');
  });
});

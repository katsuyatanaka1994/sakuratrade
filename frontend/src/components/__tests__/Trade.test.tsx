import { screen, fireEvent, act, within } from '@testing-library/react';
import { vi } from 'vitest';
import Trade from '../Trade';
import { renderWithProviders } from '@/test-utils/renderWithProviders';
import * as positionsStore from '../../store/positions';

// Mock alert for Vitest
global.alert = vi.fn();

vi.mock('../positions/RightPanePositions', () => ({
  __esModule: true,
  default: () => <div data-testid="right-pane-stub" />,
}));

vi.mock('../AutocompleteSymbol', () => ({
  __esModule: true,
  default: ({ value = '', onChange = () => {} }: { value?: string; onChange?: (next: string) => void }) => (
    <input
      data-testid="autocomplete-stub"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('../../hooks/useSymbolSuggest', () => ({
  __esModule: true,
  useSymbolSuggest: () => ({
    symbols: [],
    isLoading: false,
    suggestions: [],
    querySymbols: () => {},
    findByCode: () => undefined,
  }),
}));

const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const renderTrade = async () => {
  await act(async () => {
    renderWithProviders(
      <Trade isFileListVisible={false} selectedFile="テスト" setSelectedFile={() => {}} />
    );
    await flushAsync();
  });
};

const clickAsync = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
    await flushAsync();
  });
};

const { getState: getPositionsState } = positionsStore;

const resetPositionsStore = () => {
  const state = getPositionsState();
  state.positions.clear();
  state.closed.length = 0;
  state.tradeEntries.clear();
  state.failedJournalQueue.length = 0;
  state.settlementHistory = {};
};

const submitEntry = async ({ symbol, price, qty }: { symbol: string; price: string; qty: string }) => {
  await clickAsync(screen.getByText('建値入力'));
  const heading = screen.getByText('建値入力', { selector: 'h2' });
  const dialog = heading.parentElement?.parentElement as HTMLElement;
  if (!dialog) {
    throw new Error('Entry dialog container not found');
  }

  fireEvent.change(within(dialog).getByTestId('autocomplete-stub'), {
    target: { value: symbol },
  });
  fireEvent.change(within(dialog).getByPlaceholderText('円'), {
    target: { value: price },
  });
  fireEvent.change(within(dialog).getByPlaceholderText('株'), {
    target: { value: qty },
  });

  await clickAsync(within(dialog).getByText('送信'));
};

const mockFetch = () => {
  let entryCounter = 0;

  const createResponse = (data: unknown, ok = true) => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => data,
  });

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method?.toUpperCase() ?? 'GET';
    const rawBody = init?.body;
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : undefined;

    if (url.endsWith('/data/symbols.json')) {
      return createResponse([]);
    }

    if (url.includes('/chats/default-chat-123/messages')) {
      if (method === 'POST' && body?.type === 'ENTRY') {
        entryCounter += 1;
        return createResponse({
          id: `entry-${entryCounter}`,
          type: 'ENTRY',
          payload: body.payload,
          createdAt: '2024-01-01T00:00:00.000Z',
        });
      }
      return createResponse([]);
    }

    if (url.endsWith('/chats/') || url.endsWith('/chats')) {
      if (method === 'POST') {
        return createResponse({
          id: `chat-${Math.random().toString(16).slice(2)}`,
          name: body?.name ?? '新規チャット 1',
          messages: [],
          createdAt: '2024-01-01T00:00:00.000Z',
        });
      }
      return createResponse([]);
    }

    if (url.includes('/chats/') && method === 'DELETE') {
      return createResponse({ success: true });
    }

    if (url.includes('/advice')) {
      return createResponse({ success: true, response: '' });
    }

    if (url.includes('/api/v1/integrated-analysis')) {
      return createResponse({ success: false });
    }

    if (url.includes('/api/v1/feedback/exit')) {
      return createResponse({ success: true, feedback_html: '<div />' });
    }

    return createResponse({});
  });
};

test('コンポーネントが正常にレンダリングされる', async () => {
  await renderTrade();

  // Check if main buttons are rendered
  expect(screen.getByText("建値入力")).toBeInTheDocument();
  expect(screen.getByText("チャート画像をアップロード")).toBeInTheDocument();
});

test('建値入力モーダルが開く', async () => {
  await renderTrade();

  await clickAsync(screen.getByText("建値入力"));

  // Check if modal heading appears
  const modalHeading = screen.getByRole('heading', { name: '建値入力' });
  expect(modalHeading).toBeInTheDocument();
});

test('決済ボタンは現在無効化されている', async () => {
  await renderTrade();

  const settlementButton = screen.getByTestId('payment-button');
  expect(settlementButton).toBeDisabled();
  expect(settlementButton).toHaveAttribute('aria-hidden', 'true');
});

test('追加エントリー時の取引プランは平均建値を使用する', async () => {
  resetPositionsStore();
  window.localStorage.clear();

  const fetchSpy = mockFetch();
  const originalFetch = global.fetch;
  const recordSettlementSpy = vi.spyOn(positionsStore, 'recordSettlement');
  const warnSpy = vi.spyOn(console, 'warn');
  const errorSpy = vi.spyOn(console, 'error');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).fetch = fetchSpy;

  try {
    await renderTrade();

    await submitEntry({ symbol: '1234 テスト', price: '1000', qty: '100' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    await submitEntry({ symbol: '1234 テスト', price: '800', qty: '100' });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
    });

    const planNodes = screen.getAllByText(/利確目標/);
    expect(planNodes.length).toBeGreaterThanOrEqual(2);

    const lastPlanText = planNodes[planNodes.length - 1].textContent ?? '';
    expect(lastPlanText).toContain('945円');
    expect(lastPlanText).not.toContain('840円');

    const stopNodes = screen.getAllByText(/損切り目標/);
    expect(stopNodes.length).toBeGreaterThanOrEqual(2);

    const lastStopText = stopNodes[stopNodes.length - 1].textContent ?? '';
    expect(lastStopText).toContain('882円');
    expect(lastStopText).not.toContain('784円');
    expect(recordSettlementSpy).not.toHaveBeenCalled();
    const warningOutput = warnSpy.mock.calls.flat().join(' ');
    expect(warningOutput).not.toContain('Failed to record settlement history');
    const errorOutput = errorSpy.mock.calls.flat().join(' ');
    expect(errorOutput).not.toContain('Failed to record settlement history');
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).fetch = originalFetch;
    resetPositionsStore();
    window.localStorage.clear();
    recordSettlementSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  }
});

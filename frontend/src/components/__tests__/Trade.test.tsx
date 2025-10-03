import { screen, fireEvent, act } from '@testing-library/react';
import { vi } from 'vitest';
import Trade from '../Trade';
import { renderWithProviders } from '@/test-utils/renderWithProviders';

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

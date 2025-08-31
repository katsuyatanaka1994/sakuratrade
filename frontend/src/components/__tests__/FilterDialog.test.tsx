import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FilterDialog } from '../FilterDialog';
import { TradeFilterRuntime } from '../../types/trades';

// Mock DateRangeOverlay
jest.mock('../DateRangeOverlay', () => ({
  DateRangeOverlay: ({ open, onOpenChange, value, onChange }: any) => (
    open ? (
      <div data-testid="date-range-overlay">
        <button onClick={() => onOpenChange(false)}>Close Calendar</button>
        <button 
          onClick={() => {
            onChange({ from: new Date('2025-01-01'), to: new Date('2025-01-31') });
            onOpenChange(false);
          }}
        >
          Select Range
        </button>
      </div>
    ) : null
  )
}));

describe('FilterDialog', () => {
  const defaultValue: TradeFilterRuntime = {
    type: 'all',
    q: '',
    from: null,
    to: null,
  };

  const mockOnSubmit = jest.fn();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('フィルターダイアログが正常に表示される', () => {
    render(
      <FilterDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        value={defaultValue}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('フィルター')).toBeInTheDocument();
    expect(screen.getByText('結果')).toBeInTheDocument();
    expect(screen.getByText('銘柄検索')).toBeInTheDocument();
    expect(screen.getByText('日付')).toBeInTheDocument();
  });

  it('トレードタイプの選択ができる', () => {
    render(
      <FilterDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        value={defaultValue}
        onSubmit={mockOnSubmit}
      />
    );

    const profitRadio = screen.getByLabelText('利確');
    fireEvent.click(profitRadio);

    expect(profitRadio).toBeChecked();
  });

  it('銘柄検索の入力ができる', () => {
    render(
      <FilterDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        value={defaultValue}
        onSubmit={mockOnSubmit}
      />
    );

    const searchInput = screen.getByPlaceholderText('コードまたは銘柄名を入力');
    fireEvent.change(searchInput, { target: { value: '7203' } });

    expect(searchInput).toHaveValue('7203');
  });

  it('日付選択ダイアログが開ける', async () => {
    render(
      <FilterDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        value={defaultValue}
        onSubmit={mockOnSubmit}
      />
    );

    const dateButton = screen.getByText('— — —');
    fireEvent.click(dateButton);

    await waitFor(() => {
      expect(screen.getByTestId('date-range-overlay')).toBeInTheDocument();
    });
  });

  it('検索ボタンでフィルターが送信される', () => {
    const testValue: TradeFilterRuntime = {
      type: 'profit',
      q: '7203',
      from: new Date('2025-01-01'),
      to: new Date('2025-01-31'),
    };

    render(
      <FilterDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        value={testValue}
        onSubmit={mockOnSubmit}
      />
    );

    const submitButton = screen.getByText('検索する');
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith(testValue);
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('閉じるボタンでダイアログが閉じる', () => {
    render(
      <FilterDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        value={defaultValue}
        onSubmit={mockOnSubmit}
      />
    );

    const closeButton = screen.getByText('閉じる');
    fireEvent.click(closeButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it('ESCキーでダイアログが閉じる', () => {
    render(
      <FilterDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        value={defaultValue}
        onSubmit={mockOnSubmit}
      />
    );

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
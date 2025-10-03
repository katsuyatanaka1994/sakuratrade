import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, type Mock } from 'vitest';
import EditEntryModal from '../EditEntryModal';
import type { Position } from '../../store/positions';
import type { EntryPayload } from '../../types/chat';
import * as positionsApi from '../../lib/api/positions';
import * as aiRegeneration from '../../lib/aiRegeneration';
import * as botMessaging from '../../lib/botMessaging';

vi.mock('../../store/positions', async () => {
  const actual = await vi.importActual<typeof import('../../store/positions')>('../../store/positions');
  return {
    ...actual,
    syncPositionFromServer: vi.fn((position) => position),
  };
});

vi.mock('../../lib/api/positions', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api/positions')>('../../lib/api/positions');
  return {
    ...actual,
    fetchPositionById: vi.fn(),
    updatePositionEntry: vi.fn(),
  };
});

vi.mock('../../lib/aiRegeneration', () => ({
  regeneratePositionAnalysis: vi.fn(),
  handleAIRegenerationFailure: vi.fn(),
}));

vi.mock('../../lib/botMessaging', () => ({
  sendPositionUpdateMessages: vi.fn().mockResolvedValue({
    userMessageResult: { success: true },
    systemMessageResult: { success: true },
    allSuccess: true,
  }),
  logBotMessageFailure: vi.fn(),
}));

describe('EditEntryModal', () => {
  const defaultEntry: EntryPayload & { positionId: string; version: number } = {
    positionId: '7203:LONG:default',
    symbolCode: '7203',
    symbolName: 'トヨタ自動車',
    side: 'LONG',
    price: 1500,
    qty: 100,
    note: '初期建値',
    tradeId: 'trade-1',
    executedAt: '2024-01-01T09:00',
    version: 1,
    chartPattern: 'pullback-buy',
  };

  const mockPosition: Position = {
    symbol: '7203',
    side: 'LONG',
    qtyTotal: 120,
    avgPrice: 1600,
    lots: [],
    realizedPnl: 0,
    updatedAt: new Date().toISOString(),
    name: 'トヨタ自動車',
    chatId: 'default',
    version: 5,
  };

  const sendPositionUpdateMessagesMock = botMessaging
    .sendPositionUpdateMessages as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderModal = (props?: Partial<React.ComponentProps<typeof EditEntryModal>>) => {
    return render(
      <EditEntryModal
        isOpen
        onClose={vi.fn()}
        initialData={defaultEntry}
        {...props}
      />
    );
  };

  const submitForm = () => {
    const form = screen.getByTestId('modal-edit-entry').querySelector('form');
    if (!form) {
      throw new Error('edit entry form element was not found');
    }
    fireEvent.submit(form);
  };

  test('prefills form with latest server values', async () => {
    (positionsApi.fetchPositionById as Mock).mockResolvedValue(mockPosition);

    renderModal();

    await waitFor(() => {
      expect(screen.getByTestId('input-price')).toHaveValue(1600);
      expect(screen.getByTestId('input-size')).toHaveValue(120);
      expect(screen.getByTestId('select-chart-pattern')).toHaveTextContent('押し目買い');
    });
  });

  test('shows validation errors for invalid price and quantity', async () => {
    (positionsApi.fetchPositionById as Mock).mockResolvedValue(mockPosition);

    renderModal();

    await waitFor(() => {
      expect(screen.getByTestId('input-price')).toHaveValue(1600);
    });

    fireEvent.change(screen.getByTestId('input-price'), { target: { value: '-1' } });
    fireEvent.change(screen.getByTestId('input-size'), { target: { value: '0' } });

    const submit = screen.getByTestId('btn-submit-update');
    fireEvent.click(submit);

    await waitFor(() => {
      expect(screen.getByTestId('error-price')).toBeInTheDocument();
      expect(screen.getByTestId('error-size')).toBeInTheDocument();
    });

    expect(positionsApi.updatePositionEntry).not.toHaveBeenCalled();
  });

  test('invokes regeneration when toggle is enabled', async () => {
    (positionsApi.fetchPositionById as Mock).mockResolvedValue(mockPosition);
    (positionsApi.updatePositionEntry as Mock).mockResolvedValue({ position: mockPosition });

    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <EditEntryModal
        isOpen
        onClose={onClose}
        initialData={defaultEntry}
        onSave={onSave}
        chatId="chat-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-price')).toHaveValue(1600);
    });

    fireEvent.change(screen.getByTestId('input-price'), { target: { value: '1650' } });

    submitForm();

    await waitFor(() => {
      expect(positionsApi.updatePositionEntry).toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
        tradeId: 'trade-1',
        chartPattern: 'pullback-buy',
      }), expect.objectContaining({ regenerateEnabled: true, planRegenerated: true }));
      expect(aiRegeneration.regeneratePositionAnalysis).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
      expect(sendPositionUpdateMessagesMock).toHaveBeenCalled();
    });
  });

  test('skips regeneration when toggle is disabled', async () => {
    (positionsApi.fetchPositionById as Mock).mockResolvedValue(mockPosition);
    (positionsApi.updatePositionEntry as Mock).mockResolvedValue({ position: mockPosition });

    const onSave = vi.fn();

    render(
      <EditEntryModal
        isOpen
        onClose={vi.fn()}
        initialData={defaultEntry}
        onSave={onSave}
        chatId="chat-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-price')).toHaveValue(1600);
    });

    fireEvent.click(screen.getByTestId('toggle-regenerate'));
    fireEvent.change(screen.getByTestId('input-price'), { target: { value: '1700' } });
    submitForm();

    await waitFor(() => {
      expect(aiRegeneration.regeneratePositionAnalysis).not.toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ chartPattern: 'pullback-buy' }),
        expect.objectContaining({ regenerateEnabled: false, planRegenerated: true })
      );
      expect(sendPositionUpdateMessagesMock).toHaveBeenCalled();
    });
  });

  test('falls back to provided data when positionId is absent', async () => {
    const onSave = vi.fn();
    const entryWithoutPosition = { ...defaultEntry };
    delete (entryWithoutPosition as any).positionId;

    render(
      <EditEntryModal
        isOpen
        onClose={vi.fn()}
        initialData={entryWithoutPosition}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByTestId('input-price'), { target: { value: '1510' } });
    submitForm();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ chartPattern: 'pullback-buy' }),
        expect.objectContaining({ planRegenerated: true })
      );
      expect(positionsApi.updatePositionEntry).not.toHaveBeenCalled();
      expect(sendPositionUpdateMessagesMock).not.toHaveBeenCalled();
    });
  });

  test('updates trade plan preview when position type changes', async () => {
    (positionsApi.fetchPositionById as Mock).mockResolvedValue(mockPosition);

    renderModal();

    await waitFor(() => {
      expect(screen.getByTestId('plan-take-profit')).toHaveTextContent('¥1,680');
      expect(screen.getByTestId('plan-stop-loss')).toHaveTextContent('¥1,568');
      expect(screen.getByTestId('plan-status')).toHaveTextContent('変更なし');
    });

    fireEvent.click(screen.getByTestId('select-side'));
    fireEvent.click(screen.getByText('ショート（売り）'));

    await waitFor(() => {
      expect(screen.getByTestId('plan-take-profit')).toHaveTextContent('¥1,520');
      expect(screen.getByTestId('plan-stop-loss')).toHaveTextContent('¥1,632');
      expect(screen.getByTestId('plan-status')).toHaveTextContent('再生成予定');
    });
  });

  test('skips AI regeneration when plan inputs are unchanged', async () => {
    (positionsApi.fetchPositionById as Mock).mockResolvedValue(mockPosition);
    (positionsApi.updatePositionEntry as Mock).mockResolvedValue({ position: mockPosition });

    const onSave = vi.fn();

    render(
      <EditEntryModal
        isOpen
        onClose={vi.fn()}
        initialData={defaultEntry}
        onSave={onSave}
        chatId="chat-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-price')).toHaveValue(1600);
    });

    fireEvent.change(screen.getByTestId('input-note'), {
      target: { value: '追加メモ' },
    });

    submitForm();

    await waitFor(() => {
      expect(aiRegeneration.regeneratePositionAnalysis).not.toHaveBeenCalled();
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ chartPattern: 'pullback-buy' }),
        expect.objectContaining({ regenerateEnabled: true, planRegenerated: false })
      );
      expect(screen.getByTestId('plan-status')).toHaveTextContent('変更なし');
      expect(sendPositionUpdateMessagesMock).not.toHaveBeenCalled();
    });
  });

  test('resends plan when only quantity changes', async () => {
    (positionsApi.fetchPositionById as Mock).mockResolvedValue(mockPosition);
    (positionsApi.updatePositionEntry as Mock).mockResolvedValue({
      position: {
        ...mockPosition,
        qtyTotal: 150,
      },
    });

    const onSave = vi.fn();

    render(
      <EditEntryModal
        isOpen
        onClose={vi.fn()}
        initialData={defaultEntry}
        onSave={onSave}
        chatId="chat-1"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('input-size')).toHaveValue(120);
    });

    fireEvent.change(screen.getByTestId('input-size'), { target: { value: '150' } });

    await waitFor(() => {
      expect(screen.getByTestId('plan-status')).toHaveTextContent('再生成予定');
    });

    submitForm();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
      expect(sendPositionUpdateMessagesMock).toHaveBeenCalledTimes(1);
      expect(sendPositionUpdateMessagesMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ qtyTotal: 150 }),
        expect.objectContaining({ qtyChanged: true }),
        expect.any(Object)
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageEditIntegration from '../MessageEditIntegration';
import type { ChatMessage, LegacyMessage } from '../../types/chat';
import * as api from '../../services/api';
import { showToast } from '../UI/Toast';
import { recordEntryEdited } from '../../lib/auditLogger';

// Mock the API functions
vi.mock('../../services/api', () => ({
  updateChatMessage: vi.fn(),
  generateAIReply: vi.fn(),
  undoChatMessage: vi.fn(),
}));

vi.mock('../UI/Toast', () => ({
  showToast: {
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('../../lib/auditLogger', () => ({
  recordEntryEdited: vi.fn(),
  recordEntryDeleted: vi.fn(),
  logAuditEvent: vi.fn(),
}));

const mockUpdateChatMessage = vi.mocked(api.updateChatMessage);
const mockShowToast = vi.mocked(showToast);
const mockRecordEntryEdited = vi.mocked(recordEntryEdited);

describe('MessageEdit E2E Tests', () => {
  const mockMessages: (ChatMessage | LegacyMessage)[] = [
    {
      id: 'msg-1',
      type: 'user',
      content: 'Test legacy message',
      timestamp: '10:00'
    } as LegacyMessage,
    {
      id: 'msg-2',
      type: 'TEXT',
      authorId: 'user',
      text: 'Test text message',
      createdAt: '2024-01-01T10:00:00Z'
    } as ChatMessage,
    {
      id: 'msg-3',
      type: 'ENTRY',
      authorId: 'user',
      payload: {
        symbolCode: '6501',
        symbolName: '日立製作所',
        side: 'LONG',
        price: 4000,
        qty: 100,
        tradeId: 't_123',
        note: 'Initial entry',
        chartPattern: 'pullback-buy'
      },
      createdAt: '2024-01-01T10:01:00Z'
    } as ChatMessage,
    {
      id: 'msg-4',
      type: 'EXIT',
      authorId: 'user',
      payload: {
        tradeId: 't_123',
        exitPrice: 4100,
        exitQty: 100,
        note: 'Profit taking'
      },
      createdAt: '2024-01-01T10:02:00Z'
    } as ChatMessage,
  ];

  const cloneMessages = () =>
    mockMessages.map((msg) => {
      if ('content' in msg) {
        return { ...msg } as LegacyMessage;
      }
      if (msg.type === 'ENTRY') {
        return { ...msg, payload: { ...msg.payload } } as ChatMessage;
      }
      if (msg.type === 'EXIT') {
        return { ...msg, payload: { ...msg.payload } } as ChatMessage;
      }
      return { ...msg } as ChatMessage;
    });

  const createDefaultProps = () => ({
    messages: cloneMessages(),
    currentUserId: 'user',
    chatInput: '',
    onChatInputChange: vi.fn(),
    onMessageSubmit: vi.fn(),
    onMessagesUpdate: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockShowToast.error.mockClear();
    mockShowToast.warning.mockClear();
    mockShowToast.info.mockClear();
    mockShowToast.success.mockClear();
    mockRecordEntryEdited.mockClear();
  });

  it('自分のメッセージにのみ編集アイコンを表示する', () => {
    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Should show edit icons for user messages
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    expect(editButtons).toHaveLength(4); // All messages are from 'user'
    
    // Verify accessibility
    editButtons.forEach(button => {
      expect(button).toHaveAttribute('aria-label', 'メッセージを編集');
    });
  });

  it('他人のメッセージには編集アイコンを表示しない', () => {
    const messagesWithOtherUser = [
      ...mockMessages,
      {
        id: 'msg-5',
        type: 'TEXT',
        authorId: 'other-user',
        text: 'Message from other user',
        createdAt: '2024-01-01T10:03:00Z'
      } as ChatMessage
    ];

    const props = createDefaultProps();
    render(
      <MessageEditIntegration 
        {...props} 
        messages={messagesWithOtherUser}
      />
    );
    
    // Should still show 4 edit icons (only for user's messages)
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    expect(editButtons).toHaveLength(4);
  });

  it('TEXTメッセージの編集フローが正常に動作する', async () => {
    const user = userEvent.setup();
    mockUpdateChatMessage.mockResolvedValue({
      id: 'msg-2',
      type: 'TEXT',
      text: 'Updated text message',
      updatedAt: '2024-01-01T10:05:00Z'
    } as any);

    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Click edit button for text message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]); // Second message is TEXT type
    
    // Verify edit mode UI
    expect(screen.getByText('メッセージを編集中')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test text message')).toBeInTheDocument();
    
    // Edit the message
    const textarea = await screen.findByDisplayValue('Test text message');
    await user.clear(textarea);
    await user.type(textarea, 'Updated text message');
    
    // Submit the update
    const updateButton = screen.getByText('更新');
    await user.click(updateButton);
    
    // Verify API call
    await waitFor(() => {
      expect(mockUpdateChatMessage).toHaveBeenCalledWith('msg-2', {
        type: 'TEXT',
        text: 'Updated text message'
      });
    });
    
    // Verify local state update
    expect(props.onMessagesUpdate).toHaveBeenCalled();
    const finalCall = props.onMessagesUpdate.mock.calls.at(-1)?.[0] as (ChatMessage | LegacyMessage)[] | undefined;
    const finalMessage = finalCall?.find(msg => !('content' in msg) && msg.id === 'msg-2') as ChatMessage | undefined;
    expect(finalMessage?.updatedAt).toBe('2024-01-01T10:05:00Z');
    expect(mockRecordEntryEdited).not.toHaveBeenCalled();
  });

  it('ENTRYメッセージの編集モーダルが正常に動作する', async () => {
    const user = userEvent.setup();
    mockUpdateChatMessage.mockResolvedValue({
      id: 'msg-3',
      type: 'ENTRY',
      payload: {
        symbolCode: '6501',
        symbolName: '日立製作所',
        side: 'SHORT',
        price: 4050,
        qty: 200,
        tradeId: 't_123',
        note: 'Updated entry',
        chartPattern: 'double-bottom'
      }
    } as any);

    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Click edit button for ENTRY message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[2]); // Third message is ENTRY type
    
    // Verify modal opened
    expect(screen.getByRole('heading', { name: /建値.*編集/ })).toBeInTheDocument();
    expect(screen.getByTestId('select-chart-pattern')).toHaveTextContent(/(押し目買い|pullback-buy)/);
    
    // Edit form values
    await user.click(screen.getByTestId('select-side'));
    await user.click(screen.getByText('ショート（売り）'));

    const priceInput = screen.getByDisplayValue('4000');
    await user.clear(priceInput);
    await user.type(priceInput, '4050');

    const qtyInput = screen.getByDisplayValue('100');
    await user.clear(qtyInput);
    await user.type(qtyInput, '200');

    await user.click(screen.getByTestId('select-chart-pattern'));
    await user.click(screen.getByText('ダブルボトム'));

    // Submit the update
    const saveButton = screen.getByTestId('btn-submit-update');
    await user.click(saveButton);

    // Verify API call
    await waitFor(() => {
      expect(mockUpdateChatMessage).toHaveBeenCalledWith('msg-3', {
        type: 'ENTRY',
        payload: expect.objectContaining({
          symbolCode: '6501',
          symbolName: '日立製作所',
          side: 'SHORT',
          price: 4050,
          qty: 200,
          tradeId: 't_123',
          chartPattern: 'double-bottom'
        })
      });
    });

    const updateSnapshots = props.onMessagesUpdate.mock.calls
      .map(([messages]) => messages as (ChatMessage | LegacyMessage)[]);
    const matchingSnapshot = updateSnapshots.find((messages) => {
      const entry = messages.find((msg) => !('content' in msg) && msg.id === 'msg-3') as ChatMessage | undefined;
      if (!entry || entry.type !== 'ENTRY') {
        return false;
      }
      return (
        entry.payload.side === 'SHORT' &&
        entry.payload.price === 4050 &&
        entry.payload.qty === 200 &&
        entry.payload.chartPattern === 'double-bottom'
      );
    });
    expect(matchingSnapshot).toBeTruthy();

    expect(mockRecordEntryEdited).toHaveBeenCalled();
    const matchingAuditCall = mockRecordEntryEdited.mock.calls.find(([payload]) =>
      Boolean(
        payload &&
        payload.entryId === 'msg-3' &&
        payload.actorId === 'user' &&
        payload.before?.chartPattern === 'pullback-buy' &&
        payload.after?.chartPattern === 'double-bottom' &&
        payload.regenerateFlag === true
      )
    );
    expect(matchingAuditCall).toBeTruthy();
  });

  it('EXITメッセージの編集モーダルが正常に動作する', async () => {
    const user = userEvent.setup();
    mockUpdateChatMessage.mockResolvedValue({
      id: 'msg-4',
      type: 'EXIT',
      payload: {
        tradeId: 't_123',
        exitPrice: 4200,
        exitQty: 50,
        note: 'Partial profit taking'
      }
    } as any);

    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Click edit button for EXIT message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[3]); // Fourth message is EXIT type
    
    // Verify modal opened
    expect(screen.getByText('✅ 決済（EXIT）を編集')).toBeInTheDocument();
    expect(screen.getByDisplayValue('t_123')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4100')).toBeInTheDocument();
    
    // Edit form values
    const priceInput = screen.getByDisplayValue('4100');
    await user.clear(priceInput);
    await user.type(priceInput, '4200');
    
    const qtyInput = screen.getByDisplayValue('100');
    await user.clear(qtyInput);
    await user.type(qtyInput, '50');
    
    // Submit the update
    const saveButton = screen.getByText('保存');
    await user.click(saveButton);
    
    // Verify API call
    await waitFor(() => {
      expect(mockUpdateChatMessage).toHaveBeenCalledWith('msg-4', {
        type: 'EXIT',
        payload: expect.objectContaining({
          tradeId: 't_123',
          exitPrice: 4200,
          exitQty: 50
        })
      });
    });
  });

  it('編集中のキャンセル機能が正常に動作する', async () => {
    const user = userEvent.setup();
    
    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Start editing text message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]);
    
    // Verify edit mode
    expect(screen.getByText('メッセージを編集中')).toBeInTheDocument();
    
    // Cancel editing using X button
    const cancelButton = screen.getByLabelText('編集をキャンセル');
    await user.click(cancelButton);
    
    // Verify edit mode exited
    expect(screen.queryByText('メッセージを編集中')).not.toBeInTheDocument();
    expect(props.onChatInputChange).toHaveBeenCalledWith('');
  });

  it('編集中にEscapeキーでキャンセルできる', async () => {
    const user = userEvent.setup();
    
    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Start editing text message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]);
    
    // Press Escape to cancel
    const textarea = await screen.findByDisplayValue('Test text message');
    await user.click(textarea);
    await user.keyboard('{Escape}');
    
    // Verify edit mode exited
    await waitFor(() => {
      expect(screen.queryByText('メッセージを編集中')).not.toBeInTheDocument();
    });
  });

  it('APIエラー時にエラーハンドリングが動作する', async () => {
    const user = userEvent.setup();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock API error
    mockUpdateChatMessage.mockRejectedValue(new Error('API Error'));

    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Start editing and submit
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]);

    const textarea = await screen.findByDisplayValue('Test text message');
    await user.clear(textarea);
    await user.type(textarea, 'Failure text');
    
    const updateButton = screen.getByText('更新');
    await user.click(updateButton);
    
    // Verify error was logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update text message:', expect.any(Error));
    });

    expect(props.onMessagesUpdate).toHaveBeenCalledTimes(2);
    expect(mockShowToast.error).toHaveBeenCalledWith('メッセージの更新に失敗しました', { description: 'API Error' });

    const firstCall = props.onMessagesUpdate.mock.calls[0]?.[0] as (ChatMessage | LegacyMessage)[] | undefined;
    const optimisticMessage = firstCall?.find(msg => !('content' in msg) && msg.id === 'msg-2') as ChatMessage | undefined;
    expect(optimisticMessage?.text).toBe('Failure text');

    const revertedCall = props.onMessagesUpdate.mock.calls[1]?.[0] as (ChatMessage | LegacyMessage)[] | undefined;
    const revertedMessage = revertedCall?.find(msg => !('content' in msg) && msg.id === 'msg-2') as ChatMessage | undefined;
    expect(revertedMessage?.text).toBe('Test text message');

    expect(props.onChatInputChange).toHaveBeenCalledWith('Test text message');
    expect(mockRecordEntryEdited).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('競合時にはサーバ内容を優先し警告を表示する', async () => {
    const user = userEvent.setup();
    mockUpdateChatMessage.mockRejectedValue(new Error('HTTP 409'));

    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);

    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]);

    const textarea = await screen.findByDisplayValue('Test text message');
    await user.clear(textarea);
    await user.type(textarea, 'Conflict text');

    await user.click(screen.getByText('更新'));

    await waitFor(() => {
      expect(mockShowToast.warning).toHaveBeenCalledWith('他のユーザーが先に更新しました。最新の内容を確認してください。');
    });

    expect(props.onMessagesUpdate).toHaveBeenCalledTimes(2);

    const conflictFinalCall = props.onMessagesUpdate.mock.calls[1]?.[0] as (ChatMessage | LegacyMessage)[] | undefined;
    const revertedMessage = conflictFinalCall?.find(msg => !('content' in msg) && msg.id === 'msg-2') as ChatMessage | undefined;
    expect(revertedMessage?.text).toBe('Test text message');

    expect(props.onChatInputChange).toHaveBeenCalledWith('Test text message');
    expect(mockRecordEntryEdited).not.toHaveBeenCalled();
  });

  it('キーボードナビゲーションで編集アイコンにアクセスできる', async () => {
    const user = userEvent.setup();
    
    const props = createDefaultProps();
    render(<MessageEditIntegration {...props} />);
    
    // Tab to first edit button and press Enter
    await user.tab();
    // Skip to edit button (implementation depends on tab order)
    const editButton = screen.getAllByLabelText('メッセージを編集')[0];
    editButton.focus();
    await user.keyboard('{Enter}');
    
    // Verify edit mode started
    expect(props.onChatInputChange).toHaveBeenCalled();
  });
});

describe('MessageEdit Form Validation', () => {
  const defaultProps = {
    messages: [],
    currentUserId: 'user',
    chatInput: '',
    onChatInputChange: vi.fn(),
    onMessageSubmit: vi.fn(),
    onMessagesUpdate: vi.fn(),
  };

  it('ENTRYフォームのバリデーションが動作する', async () => {
    const user = userEvent.setup();
    
    render(
      <MessageEditIntegration 
        {...defaultProps}
        messages={[{
          id: 'msg-entry',
          type: 'ENTRY',
          authorId: 'user',
          payload: {
            symbolCode: '6501',
            symbolName: '日立製作所',
            side: 'LONG',
            price: 4000,
            qty: 100,
            tradeId: 't_123'
          },
          createdAt: '2024-01-01T10:00:00Z'
        } as ChatMessage]}
      />
    );
    
    // Open modal
    const editButton = screen.getByLabelText('メッセージを編集');
    await user.click(editButton);
    
    // Clear required fields
    const priceInput = await screen.findByTestId('input-price');
    await user.clear(priceInput);
    await user.type(priceInput, '0');

    const qtyInput = await screen.findByTestId('input-size');
    await user.clear(qtyInput);
    await user.type(qtyInput, '0');

    const saveButton = screen.getByTestId('btn-submit-update');
    await user.click(saveButton);

    // Verify validation errors
    expect(await screen.findByText('価格は0.01円以上である必要があります')).toBeInTheDocument();
    expect(await screen.findByText('株数は1株以上である必要があります')).toBeInTheDocument();
  });
});

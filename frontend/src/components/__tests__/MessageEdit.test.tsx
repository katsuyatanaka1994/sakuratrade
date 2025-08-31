import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageEditIntegration from '../MessageEditIntegration';
import { ChatMessage, LegacyMessage } from '../../types/chat';
import * as api from '../../services/api';

// Mock the API functions
vi.mock('../../services/api', () => ({
  updateChatMessage: vi.fn(),
}));

const mockUpdateChatMessage = vi.mocked(api.updateChatMessage);

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
        note: 'Initial entry'
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

  const defaultProps = {
    messages: mockMessages,
    currentUserId: 'user',
    chatInput: '',
    onChatInputChange: vi.fn(),
    onMessageSubmit: vi.fn(),
    onMessagesUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('自分のメッセージにのみ編集アイコンを表示する', () => {
    render(<MessageEditIntegration {...defaultProps} />);
    
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

    render(
      <MessageEditIntegration 
        {...defaultProps} 
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

    render(<MessageEditIntegration {...defaultProps} />);
    
    // Click edit button for text message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]); // Second message is TEXT type
    
    // Verify edit mode UI
    expect(screen.getByText('メッセージを編集中')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test text message')).toBeInTheDocument();
    
    // Edit the message
    const textarea = screen.getByDisplayValue('Test text message');
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
    expect(defaultProps.onMessagesUpdate).toHaveBeenCalled();
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
        note: 'Updated entry'
      }
    } as any);

    render(<MessageEditIntegration {...defaultProps} />);
    
    // Click edit button for ENTRY message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[2]); // Third message is ENTRY type
    
    // Verify modal opened
    expect(screen.getByText('📈 建値（ENTRY）を編集')).toBeInTheDocument();
    expect(screen.getByDisplayValue('6501')).toBeInTheDocument();
    expect(screen.getByDisplayValue('日立製作所')).toBeInTheDocument();
    
    // Edit form values
    const sideSelect = screen.getByRole('combobox');
    await user.click(sideSelect);
    await user.click(screen.getByText('SHORT (売り)'));
    
    const priceInput = screen.getByDisplayValue('4000');
    await user.clear(priceInput);
    await user.type(priceInput, '4050');
    
    const qtyInput = screen.getByDisplayValue('100');
    await user.clear(qtyInput);
    await user.type(qtyInput, '200');
    
    // Submit the update
    const saveButton = screen.getByText('保存');
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
          tradeId: 't_123'
        })
      });
    });
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

    render(<MessageEditIntegration {...defaultProps} />);
    
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
    
    render(<MessageEditIntegration {...defaultProps} />);
    
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
    expect(defaultProps.onChatInputChange).toHaveBeenCalledWith('');
  });

  it('編集中にEscapeキーでキャンセルできる', async () => {
    const user = userEvent.setup();
    
    render(<MessageEditIntegration {...defaultProps} />);
    
    // Start editing text message
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]);
    
    // Press Escape to cancel
    const textarea = screen.getByDisplayValue('Test text message');
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

    render(<MessageEditIntegration {...defaultProps} />);
    
    // Start editing and submit
    const editButtons = screen.getAllByLabelText('メッセージを編集');
    await user.click(editButtons[1]);
    
    const updateButton = screen.getByText('更新');
    await user.click(updateButton);
    
    // Verify error was logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update text message:', expect.any(Error));
    });
    
    consoleErrorSpy.mockRestore();
  });

  it('キーボードナビゲーションで編集アイコンにアクセスできる', async () => {
    const user = userEvent.setup();
    
    render(<MessageEditIntegration {...defaultProps} />);
    
    // Tab to first edit button and press Enter
    await user.tab();
    // Skip to edit button (implementation depends on tab order)
    const editButton = screen.getAllByLabelText('メッセージを編集')[0];
    editButton.focus();
    await user.keyboard('{Enter}');
    
    // Verify edit mode started
    expect(defaultProps.onChatInputChange).toHaveBeenCalled();
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
    const symbolCodeInput = screen.getByDisplayValue('6501');
    await user.clear(symbolCodeInput);
    
    const priceInput = screen.getByDisplayValue('4000');
    await user.clear(priceInput);
    await user.type(priceInput, '0');
    
    // Try to submit
    const saveButton = screen.getByText('保存');
    await user.click(saveButton);
    
    // Verify validation errors
    expect(screen.getByText('銘柄コードは必須です')).toBeInTheDocument();
    expect(screen.getByText('価格は0より大きい値を入力してください')).toBeInTheDocument();
  });
});
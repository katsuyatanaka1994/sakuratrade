import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, type MockedFunction } from 'vitest';
import MessageEditContainer from '../MessageEditContainer';
import type { ChatMessage } from '../../types/chat';
import * as api from '../../services/api';

// Mock the API functions
vi.mock('../../services/api', () => ({
  updateChatMessage: vi.fn(),
  undoChatMessage: vi.fn(),
  generateAIReply: vi.fn()
}));

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    type: 'TEXT',
    text: 'テストメッセージ',
    authorId: 'user1',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    type: 'ENTRY',
    authorId: 'user1',
    createdAt: new Date().toISOString(),
    payload: {
      symbolCode: '9984',
      symbolName: 'ソフトバンクグループ',
      side: 'LONG',
      price: 15870,
      qty: 100,
      tradeId: 't_001'
    }
  },
  {
    id: '3',
    type: 'EXIT',
    authorId: 'user1',
    createdAt: new Date().toISOString(),
    payload: {
      tradeId: 't_001',
      exitPrice: 16550,
      exitQty: 100
    }
  }
];

const mockProps = {
  messages: mockMessages,
  currentUserId: 'user1',
  chatId: 'chat1',
  onMessagesUpdate: vi.fn()
};

describe('MessageEditFeature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders messages with edit icons for user messages', () => {
    render(<MessageEditContainer {...mockProps} />);
    
    expect(screen.getByText('テストメッセージ')).toBeInTheDocument();
    expect(screen.getByText(/建値入力しました/)).toBeInTheDocument();
    expect(screen.getByText(/決済しました/)).toBeInTheDocument();
  });

  test('shows edit and undo icons on hover for user messages', () => {
    render(<MessageEditContainer {...mockProps} />);
    
    const messageElements = screen.getAllByRole('button', { name: /編集/ });
    expect(messageElements).toHaveLength(3);
    
    const undoButton = screen.getByRole('button', { name: /取り消し/ });
    expect(undoButton).toBeInTheDocument();
  });

  test('opens text edit mode when clicking edit on TEXT message', async () => {
    render(<MessageEditContainer {...mockProps} />);
    
    const editButtons = screen.getAllByRole('button', { name: /編集/ });
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('メッセージを編集中')).toBeInTheDocument();
      expect(screen.getByDisplayValue('テストメッセージ')).toBeInTheDocument();
    });
  });

  test('opens entry modal when clicking edit on ENTRY message', async () => {
    render(<MessageEditContainer {...mockProps} />);
    
    const editButtons = screen.getAllByRole('button', { name: /編集/ });
    fireEvent.click(editButtons[1]);
    
    await waitFor(() => {
      expect(screen.getByText('📈 建値（ENTRY）を編集')).toBeInTheDocument();
      expect(screen.getByDisplayValue('9984')).toBeInTheDocument();
    });
  });

  test('opens exit modal when clicking edit on EXIT message', async () => {
    render(<MessageEditContainer {...mockProps} />);
    
    const editButtons = screen.getAllByRole('button', { name: /編集/ });
    fireEvent.click(editButtons[2]);
    
    await waitFor(() => {
      expect(screen.getByText('✅ 決済（EXIT）を編集')).toBeInTheDocument();
      expect(screen.getByDisplayValue('16550')).toBeInTheDocument();
    });
  });

  test('calls undo API when clicking undo button', async () => {
    const mockUndoChatMessage = api.undoChatMessage as MockedFunction<typeof api.undoChatMessage>;
    mockUndoChatMessage.mockResolvedValueOnce();

    render(<MessageEditContainer {...mockProps} />);
    
    const undoButton = screen.getByRole('button', { name: /取り消し/ });
    fireEvent.click(undoButton);
    
    await waitFor(() => {
      expect(mockUndoChatMessage).toHaveBeenCalledWith('3');
    });
  });

  test('updates message when submitting text edit', async () => {
    const mockUpdateChatMessage = api.updateChatMessage as MockedFunction<typeof api.updateChatMessage>;
    const mockGenerateAIReply = api.generateAIReply as MockedFunction<typeof api.generateAIReply>;
    
    mockUpdateChatMessage.mockResolvedValueOnce({
      ...mockMessages[0],
      text: '更新されたメッセージ'
    });
    mockGenerateAIReply.mockResolvedValueOnce();

    render(<MessageEditContainer {...mockProps} />);
    
    const editButtons = screen.getAllByRole('button', { name: /編集/ });
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      const textarea = screen.getByDisplayValue('テストメッセージ');
      fireEvent.change(textarea, { target: { value: '更新されたメッセージ' } });
      
      const updateButton = screen.getByRole('button', { name: /更新/ });
      fireEvent.click(updateButton);
    });
    
    await waitFor(() => {
      expect(mockUpdateChatMessage).toHaveBeenCalledWith('1', {
        type: 'TEXT',
        text: '更新されたメッセージ'
      });
      expect(mockGenerateAIReply).toHaveBeenCalledWith('chat1', '1');
    });
  });
});

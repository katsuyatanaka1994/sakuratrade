import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageItem from '../MessageItem';
import type { ChatMessage } from '../../types/chat';

const baseEntryMessage: ChatMessage = {
  id: 'entry-1',
  type: 'ENTRY',
  authorId: 'user-1',
  createdAt: '2024-01-01T10:00:00Z',
  payload: {
    symbolCode: '6501',
    symbolName: '日立製作所',
    side: 'LONG',
    price: 4000,
    qty: 100,
    tradeId: 't-1',
  },
};

describe('MessageItem edited entry indicators', () => {
  it('does not show edited indicators on initial entry message', () => {
    render(
      <MessageItem
        message={baseEntryMessage}
        currentUserId="user-1"
      />
    );

    expect(
      screen.getByText((content) => content.startsWith('📈 建値を入力しました！'))
    ).toBeInTheDocument();
    expect(
      screen.queryByText((content) => content.startsWith('📈 建値を入力しました！（編集済み）'))
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/最終更新/)).not.toBeInTheDocument();
  });

  it('shows edited headline and badge after entry update', () => {
    const editedMessage: ChatMessage = {
      ...baseEntryMessage,
      updatedAt: '2024-01-01T10:05:00Z',
      payload: {
        ...baseEntryMessage.payload,
        price: 4050,
      },
    };

    render(
      <MessageItem
        message={editedMessage}
        currentUserId="user-1"
      />
    );

    expect(
      screen.getByText((content) => content.startsWith('📈 建値を入力しました！（編集済み）'))
    ).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes('(編集済) 最終更新')
      )
    ).toBeInTheDocument();
  });

  it('displays timestamps in Asia/Tokyo timezone', () => {
    const message: ChatMessage = {
      ...baseEntryMessage,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T01:00:00Z',
    };

    render(
      <MessageItem
        message={message}
        currentUserId="user-1"
      />
    );

    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes('最終更新 10:00'))
    ).toBeInTheDocument();
  });
});

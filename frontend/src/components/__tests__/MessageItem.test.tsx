process.env.TZ = 'Asia/Tokyo';

import { describe, expect, it, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);
import React from 'react';

vi.mock('lucide-react', () => {
  const Icon = ({ name }: { name: string }) => <span data-icon={name} />;
  return {
    __esModule: true,
    Edit3: () => <Icon name="Edit3" />,
    Undo2: () => <Icon name="Undo2" />,
  };
});

import { render, screen } from '@testing-library/react';
import MessageItem from '@/components/MessageItem';
import type { ChatMessage } from '@/types/chat';

const formatTokyoTime = (iso: string) =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(iso));

describe('MessageItem minimal harness', () => {
  it('smoke: basic expectation', () => {
    expect(true).toBe(true);
  });
});

describe('MessageItem basic rendering', () => {
  it('renders MessageItem with minimal props', () => {
    const message: ChatMessage = {
      id: 'text-1',
      type: 'TEXT',
      authorId: 'user-1',
      createdAt: '2024-01-01T00:00:00Z',
      text: 'Hello world',
    };

    const { container, getByText } = render(
      <MessageItem
        message={message}
        currentUserId="user-1"
      />
    );

    expect(container).toBeDefined();
    expect(getByText('Hello world')).toBeInTheDocument();
  });
});

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
      screen.getByText((content) => content.includes('(編集済) 最終更新'))
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

    const createdAtText = formatTokyoTime(message.createdAt);
    const updatedAtText = formatTokyoTime(message.updatedAt!);

    expect(screen.getByText(createdAtText)).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes(`最終更新 ${updatedAtText}`))
    ).toBeInTheDocument();
  });
});

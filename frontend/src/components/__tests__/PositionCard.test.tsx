import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PositionCard, type HoldingPositionCardData } from '../positions/PositionCard';

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const baseCardData: HoldingPositionCardData = {
  id: 'card-1',
  symbolCode: '7203',
  symbolName: 'トヨタ自動車',
  side: 'LONG',
  averagePrice: 2180,
  quantity: 100,
  patterns: [],
  memo: undefined,
  memoEntries: undefined,
  updatedAt: '2025-09-12T12:00:00+09:00',
  chatLink: '/trade',
};

const renderCard = (overrides: Partial<HoldingPositionCardData> = {}) => {
  const position = { ...baseCardData, ...overrides };
  return render(
    <MemoryRouter>
      <PositionCard position={position} />
    </MemoryRouter>,
  );
};

describe('PositionCard memo entries', () => {
  it('displays the latest memo at the top', () => {
    renderCard({
      memoEntries: [
        { text: '午前のメモ', updatedAt: '2025-09-12T10:00:00+09:00' },
        { text: '午後のメモ', updatedAt: '2025-09-12T12:00:00+09:00' },
      ],
    });

    const latest = screen.getByText('午後のメモ');
    const earlier = screen.getByText('午前のメモ');

    const relation = latest.compareDocumentPosition(earlier);
    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the memo updated timestamp next to the text', () => {
    renderCard({
      memoEntries: [
        { text: '確認メモ', updatedAt: '2025-09-12T12:00:00+09:00' },
        { text: '過去メモ', updatedAt: '2025-09-11T18:15:00+09:00' },
      ],
    });

    const latestTimestamp = dateTimeFormatter.format(new Date('2025-09-12T12:00:00+09:00'));
    const earlierTimestamp = dateTimeFormatter.format(new Date('2025-09-11T18:15:00+09:00'));

    expect(screen.getByText(latestTimestamp)).toBeInTheDocument();
    expect(screen.getByText(earlierTimestamp)).toBeInTheDocument();
  });
});

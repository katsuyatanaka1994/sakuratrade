import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import EntryDeleteDialog from '../EntryDeleteDialog';

describe('EntryDeleteDialog', () => {
  test('renders dialog body text and preview', () => {
    render(
      <EntryDeleteDialog
        open
        preview={'銘柄: 7203 トヨタ\n数量: 100株'}
        isDeleting={false}
        onCancel={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(screen.getByTestId('dialog-delete-entry')).toBeInTheDocument();
    expect(screen.getByText('建値メッセージを削除')).toBeInTheDocument();
    expect(
      screen.getByText('この建値メッセージを削除するとチャットから完全に消去されます。')
    ).toBeInTheDocument();
    expect(screen.getByText('銘柄: 7203 トヨタ')).toBeInTheDocument();
  });

  test('fires confirm handler when destructive button is clicked', () => {
    const handleConfirm = vi.fn();
    render(
      <EntryDeleteDialog
        open
        onCancel={() => {}}
        onConfirm={handleConfirm}
      />
    );

    fireEvent.click(screen.getByTestId('btn-confirm-destructive'));
    expect(handleConfirm).toHaveBeenCalled();
  });

  test('disables buttons during deleting state', () => {
    render(
      <EntryDeleteDialog
        open
        onCancel={() => {}}
        onConfirm={() => {}}
        isDeleting
      />
    );

    expect(screen.getByTestId('btn-confirm-destructive')).toBeDisabled();
    expect(screen.getByTestId('btn-cancel-delete')).toBeDisabled();
  });
});

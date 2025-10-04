import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import EntryMessageActions from '../EntryMessageActions';

describe('EntryMessageActions', () => {
  test('renders active buttons when permitted', async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    render(
      <EntryMessageActions
        canEdit
        canDelete
        isVisible
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    );

    const editButton = screen.getByTestId('btn-edit-entry');
    await user.click(editButton);
    expect(handleEdit).toHaveBeenCalledTimes(1);

    const deleteButton = screen.getByTestId('btn-delete-entry');
    await user.click(deleteButton);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });

  test('disables buttons and shows tooltip with reason when not permitted', async () => {
    const user = userEvent.setup();

    render(
      <EntryMessageActions
        canEdit={false}
        canDelete={false}
        isVisible
        disabledReason={{
          edit: '決済済みのため編集できません',
          delete: '権限がないため削除できません',
        }}
      />
    );

    const editButton = screen.getByTestId('btn-edit-entry') as HTMLButtonElement;
    expect(editButton).toBeDisabled();
    const editTrigger = editButton.parentElement as HTMLElement;
    await user.hover(editTrigger);
    expect(await screen.findByTestId('tooltip-disabled-reason')).toHaveTextContent('決済済み');
    await user.unhover(editTrigger);

    const deleteButton = screen.getByTestId('btn-delete-entry') as HTMLButtonElement;
    expect(deleteButton).toBeDisabled();
    const deleteTrigger = deleteButton.parentElement as HTMLElement;
    await user.hover(deleteTrigger);
    expect(await screen.findByTestId('tooltip-disabled-reason')).toHaveTextContent('権限がないため削除できません');
  });

  test('provides required test ids and hover opacity classes', () => {
    render(
      <EntryMessageActions
        canEdit
        canDelete
        isVisible={false}
      />
    );

    const container = screen.getByTestId('entry-actions');
    expect(container.className).toContain('bottom-1');
    expect(container.className).toContain('opacity-0');
    expect(container.className).toContain('pointer-events-none');

    expect(screen.getByTestId('btn-edit-entry')).toBeInTheDocument();
    expect(screen.getByTestId('btn-delete-entry')).toBeInTheDocument();
  });
});

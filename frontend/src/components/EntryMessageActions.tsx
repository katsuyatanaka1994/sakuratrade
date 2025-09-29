import React, { useMemo } from 'react';
import clsx from 'clsx';
import { Edit3, Trash2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './UI/tooltip';

type DisabledReason = string | {
  edit?: string;
  delete?: string;
};

interface EntryMessageActionsProps {
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  disabledReason?: DisabledReason;
  isVisible?: boolean;
}

interface ActionButtonProps {
  ariaLabel: string;
  canPerform: boolean;
  onClick?: () => void;
  reason?: string;
  testId: 'btn-edit-entry' | 'btn-delete-entry';
  icon: React.ReactNode;
}

const baseButtonClass = 'w-7 h-7 rounded-full flex items-center justify-center transition-colors shadow-sm z-10';

const EntryActionButton: React.FC<ActionButtonProps> = ({
  ariaLabel,
  canPerform,
  onClick,
  reason,
  testId,
  icon,
}) => {
  const disabled = !canPerform;

  const handleClick = () => {
    if (!disabled) {
      onClick?.();
    }
  };

  const button = (
    <button
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      onClick={handleClick}
      disabled={disabled}
      className={clsx(
        baseButtonClass,
        disabled
          ? 'bg-gray-300 text-white opacity-60 pointer-events-none'
          : 'bg-gray-500 text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
      )}
    >
      <span aria-hidden="true" className="flex items-center text-[0] leading-none">
        {icon}
      </span>
    </button>
  );

  if (!disabled || !reason) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">
          {button}
        </span>
      </TooltipTrigger>
      <TooltipContent data-testid="tooltip-disabled-reason">
        {reason}
      </TooltipContent>
    </Tooltip>
  );
};

const EntryMessageActions: React.FC<EntryMessageActionsProps> = ({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  disabledReason,
  isVisible = false,
}) => {
  const reasons = useMemo(() => {
    if (!disabledReason) return {};
    if (typeof disabledReason === 'string') {
      return { edit: disabledReason, delete: disabledReason };
    }
    return disabledReason;
  }, [disabledReason]);

  const containerClass = clsx(
    'absolute bottom-1 right-1 flex gap-2 transition-opacity duration-150',
    isVisible
      ? 'opacity-90 hover:opacity-100'
      : 'opacity-0 pointer-events-none'
  );

  return (
    <div data-testid="entry-actions" className={containerClass}>
      <EntryActionButton
        ariaLabel="建値を編集"
        canPerform={canEdit}
        onClick={onEdit}
        reason={reasons.edit}
        testId="btn-edit-entry"
        icon={<Edit3 size={14} />}
      />
      <EntryActionButton
        ariaLabel="建値を削除"
        canPerform={canDelete}
        onClick={onDelete}
        reason={reasons.delete}
        testId="btn-delete-entry"
        icon={<Trash2 size={14} />}
      />
    </div>
  );
};

export default EntryMessageActions;

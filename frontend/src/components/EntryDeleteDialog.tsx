import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './UI/dialog';
import { Button } from './UI/button';

interface EntryDeleteDialogProps {
  open: boolean;
  preview?: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const EntryDeleteDialog: React.FC<EntryDeleteDialogProps> = ({
  open,
  preview,
  isDeleting = false,
  onCancel,
  onConfirm,
}) => {
  const handleOpenChange = (next: boolean) => {
    if (!next && !isDeleting) {
      onCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        role="alertdialog"
        className="w-full max-w-md bg-white"
        data-testid="dialog-delete-entry"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            建値メッセージを削除
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            この操作は取り消せません。
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3 text-sm text-gray-700">
          <p>この建値メッセージを削除するとチャットから完全に消去されます。</p>
          <p>関連するポジションは最新の建玉情報で再計算されます。</p>
          <p>内容を確認のうえ、必要であれば事前にメモを控えてください。</p>
        </div>

        {preview && (
          <div className="mt-4 whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
            {preview}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!isDeleting) onCancel();
            }}
            disabled={isDeleting}
            data-testid="btn-cancel-delete"
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-600 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="btn-confirm-destructive"
          >
            {isDeleting ? '削除中...' : '削除する（破壊的）'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EntryDeleteDialog;

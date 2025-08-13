import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './UI/dialog';
import { Button } from './UI/button';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  chatName: string;
  isDeleting?: boolean;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  chatName,
  isDeleting = false
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[400px] rounded-[16px] p-6 bg-white shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900 mb-4">
            チャットを削除しますか？
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <p className="mb-2">以下のチャットを削除しようとしています：</p>
            <p className="font-medium text-gray-900 bg-gray-50 p-3 rounded-lg">
              「{chatName}」
            </p>
          </div>
          
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <p className="font-medium mb-1">⚠️ 注意</p>
            <p>削除されたチャットは復元できません。この操作を続行しますか？</p>
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              キャンセル
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  削除中...
                </span>
              ) : (
                '削除する'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmDialog;
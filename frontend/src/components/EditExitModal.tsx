import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './UI/dialog';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import type { ExitPayload } from '../types/chat';

interface EditExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: ExitPayload;
  onSave: (data: ExitPayload) => Promise<void>;
  isLoading?: boolean;
}

const EditExitModal: React.FC<EditExitModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<ExitPayload>({
    tradeId: '',
    exitPrice: 0,
    exitQty: 0,
    note: '',
    executedAt: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when modal opens or initial data changes
  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        ...initialData,
        executedAt: initialData.executedAt || new Date().toISOString().slice(0, 16)
      });
      setErrors({});
    }
  }, [isOpen, initialData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.tradeId.trim()) {
      newErrors.tradeId = 'トレードIDは必須です';
    }

    if (formData.exitPrice <= 0) {
      newErrors.exitPrice = '決済価格は0より大きい値を入力してください';
    }

    if (formData.exitQty <= 0) {
      newErrors.exitQty = '決済数量は0より大きい値を入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Failed to save exit:', error);
      // Error handling could be enhanced with proper error messages
    }
  };

  const handleInputChange = (field: keyof ExitPayload, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setFormData({
        tradeId: '',
        exitPrice: 0,
        exitQty: 0,
        note: '',
        executedAt: ''
      });
      setErrors({});
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[420px] rounded-[24px] p-6 bg-white shadow-[0_8px_24px_0_rgba(0,0,0,0.1)] z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-[#374151]">
            ✅ 決済（EXIT）を編集
          </DialogTitle>
          <DialogDescription className="sr-only">
            決済メッセージの編集モーダルです。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label htmlFor="tradeId" className="text-sm font-medium text-gray-700">
              トレードID *
            </Label>
            <Input
              id="tradeId"
              type="text"
              placeholder="例: t_12345"
              value={formData.tradeId}
              onChange={(e) => handleInputChange('tradeId', e.target.value)}
              className={`mt-1 ${errors.tradeId ? 'border-red-500' : ''}`}
              disabled={isLoading}
            />
            {errors.tradeId && (
              <p className="mt-1 text-xs text-red-600">{errors.tradeId}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exitPrice" className="text-sm font-medium text-gray-700">
                決済価格 *
              </Label>
              <Input
                id="exitPrice"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formData.exitPrice || ''}
                onChange={(e) => handleInputChange('exitPrice', parseFloat(e.target.value) || 0)}
                className={`mt-1 ${errors.exitPrice ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.exitPrice && (
                <p className="mt-1 text-xs text-red-600">{errors.exitPrice}</p>
              )}
            </div>

            <div>
              <Label htmlFor="exitQty" className="text-sm font-medium text-gray-700">
                決済数量 *
              </Label>
              <Input
                id="exitQty"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={formData.exitQty || ''}
                onChange={(e) => handleInputChange('exitQty', parseInt(e.target.value) || 0)}
                className={`mt-1 ${errors.exitQty ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.exitQty && (
                <p className="mt-1 text-xs text-red-600">{errors.exitQty}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="executedAt" className="text-sm font-medium text-gray-700">
              決済日時
            </Label>
            <Input
              id="executedAt"
              type="datetime-local"
              value={formData.executedAt}
              onChange={(e) => handleInputChange('executedAt', e.target.value)}
              className="mt-1"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="note" className="text-sm font-medium text-gray-700">
              メモ
            </Label>
            <textarea
              id="note"
              placeholder="メモを入力..."
              value={formData.note || ''}
              onChange={(e) => handleInputChange('note', e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditExitModal;

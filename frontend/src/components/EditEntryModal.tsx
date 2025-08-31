import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './UI/dialog';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './UI/select';
import { EntryPayload } from '../types/chat';

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: EntryPayload;
  onSave: (data: EntryPayload) => Promise<void>;
  isLoading?: boolean;
}

const EditEntryModal: React.FC<EditEntryModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<EntryPayload>({
    symbolCode: '',
    symbolName: '',
    side: 'LONG',
    price: 0,
    qty: 0,
    note: '',
    executedAt: '',
    tradeId: ''
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

    if (!formData.symbolCode.trim()) {
      newErrors.symbolCode = '銘柄コードは必須です';
    } else if (!/^\d{4}$/.test(formData.symbolCode)) {
      newErrors.symbolCode = '銘柄コードは4桁の数字で入力してください';
    }

    if (!formData.symbolName.trim()) {
      newErrors.symbolName = '銘柄名は必須です';
    }

    if (formData.price <= 0) {
      newErrors.price = '価格は0より大きい値を入力してください';
    }

    if (formData.qty <= 0) {
      newErrors.qty = '数量は0より大きい値を入力してください';
    }

    if (!formData.tradeId.trim()) {
      newErrors.tradeId = 'トレードIDは必須です';
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
      console.error('Failed to save entry:', error);
      // Error handling could be enhanced with proper error messages
    }
  };

  const handleInputChange = (field: keyof EntryPayload, value: string | number) => {
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
        symbolCode: '',
        symbolName: '',
        side: 'LONG',
        price: 0,
        qty: 0,
        note: '',
        executedAt: '',
        tradeId: ''
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
            📈 建値（ENTRY）を編集
          </DialogTitle>
          <DialogDescription className="sr-only">
            エントリーメッセージの編集モーダルです。
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="symbolCode" className="text-sm font-medium text-gray-700">
                銘柄コード *
              </Label>
              <Input
                id="symbolCode"
                type="text"
                placeholder="例: 6501"
                value={formData.symbolCode}
                onChange={(e) => handleInputChange('symbolCode', e.target.value)}
                className={`mt-1 ${errors.symbolCode ? 'border-red-500' : ''}`}
                disabled={isLoading}
                maxLength={4}
              />
              {errors.symbolCode && (
                <p className="mt-1 text-xs text-red-600">{errors.symbolCode}</p>
              )}
            </div>

            <div>
              <Label htmlFor="symbolName" className="text-sm font-medium text-gray-700">
                銘柄名 *
              </Label>
              <Input
                id="symbolName"
                type="text"
                placeholder="例: 日立製作所"
                value={formData.symbolName}
                onChange={(e) => handleInputChange('symbolName', e.target.value)}
                className={`mt-1 ${errors.symbolName ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.symbolName && (
                <p className="mt-1 text-xs text-red-600">{errors.symbolName}</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-gray-700">
              サイド *
            </Label>
            <Select
              value={formData.side}
              onValueChange={(value: 'LONG' | 'SHORT') => handleInputChange('side', value)}
              disabled={isLoading}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LONG">LONG (買い)</SelectItem>
                <SelectItem value="SHORT">SHORT (売り)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="price" className="text-sm font-medium text-gray-700">
                価格 *
              </Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={formData.price || ''}
                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                className={`mt-1 ${errors.price ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.price && (
                <p className="mt-1 text-xs text-red-600">{errors.price}</p>
              )}
            </div>

            <div>
              <Label htmlFor="qty" className="text-sm font-medium text-gray-700">
                数量 *
              </Label>
              <Input
                id="qty"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={formData.qty || ''}
                onChange={(e) => handleInputChange('qty', parseInt(e.target.value) || 0)}
                className={`mt-1 ${errors.qty ? 'border-red-500' : ''}`}
                disabled={isLoading}
              />
              {errors.qty && (
                <p className="mt-1 text-xs text-red-600">{errors.qty}</p>
              )}
            </div>
          </div>

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

          <div>
            <Label htmlFor="executedAt" className="text-sm font-medium text-gray-700">
              実行日時
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
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditEntryModal;
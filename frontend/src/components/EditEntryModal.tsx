import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogOverlay, DialogPortal } from './UI/dialog';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './UI/select';
import { entryEditSchema, type EntryEditFormData, type ValidationErrors } from '../schemas/entryForm';
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
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    watch
  } = useForm<EntryEditFormData>({
    resolver: zodResolver(entryEditSchema),
    mode: 'onChange',
    defaultValues: {
      symbolCode: '',
      symbolName: '',
      side: 'LONG',
      price: 0,
      qty: 0,
      note: '',
      tradeId: '',
      executedAt: new Date().toISOString().slice(0, 16)
    }
  });

  // プレフィル処理
  useEffect(() => {
    if (isOpen && initialData) {
      reset({
        symbolCode: initialData.symbolCode || '',
        symbolName: initialData.symbolName || '',
        side: initialData.side || 'LONG',
        price: initialData.price || 0,
        qty: initialData.qty || 0,
        note: initialData.note || '',
        tradeId: initialData.tradeId || '',
        executedAt: initialData.executedAt || new Date().toISOString().slice(0, 16)
      });
      setSubmitError('');
    }
  }, [isOpen, initialData, reset]);

  const onSubmit = async (data: EntryEditFormData) => {
    if (isSubmitting || !isValid) return;
    
    setIsSubmitting(true);
    setSubmitError('');
    
    try {
      const payload: EntryPayload = {
        symbolCode: data.symbolCode,
        symbolName: data.symbolName,
        side: data.side,
        price: data.price,
        qty: data.qty,
        note: data.note,
        tradeId: data.tradeId,
        executedAt: data.executedAt
      };
      
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error('Failed to save entry:', error);
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : '保存に失敗しました。もう一度お試しください。'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isLoading) {
      reset();
      setSubmitError('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting && !isLoading) {
      handleClose();
    }
  };

  const watchedValues = watch();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-[rgba(51,51,51,0.8)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent 
          className="fixed left-[50%] top-[50%] z-50 w-[369px] max-w-[90vw] translate-x-[-50%] translate-y-[-50%] bg-white p-6 shadow-[1px_4px_10.4px_0px_rgba(0,0,0,0.15)] duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] rounded-lg"
          onKeyDown={handleKeyDown}
          data-testid="entry-edit-modal"
        >
          <DialogHeader className="flex items-center justify-between mb-6">
            <DialogTitle 
              className="font-bold text-[16px] text-[#333333]"
              data-testid="entry-edit-title"
            >
              建値入力
            </DialogTitle>
            <button
              onClick={handleClose}
              disabled={isSubmitting || isLoading}
              className="w-6 h-6 flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
              aria-label="モーダルを閉じる"
            >
              <svg className="w-4 h-4 text-[#333333]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            <DialogDescription className="sr-only">
              建値入力の編集フォームです。
            </DialogDescription>
          </DialogHeader>

          {/* エラーバナー */}
          {submitError && (
            <div 
              className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md"
              data-testid="entry-edit-banner"
              role="alert"
            >
              <p className="text-sm text-red-800">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* 銘柄 - 読み取り専用 */}
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-[14px] font-normal text-[#333333]">
                銘柄
              </Label>
              <div 
                className="h-10 px-2 py-2 bg-white border border-[#8b9198] rounded-[4px] flex items-center"
                data-testid="entry-symbol"
              >
                <span className="text-[14px] font-medium text-[#333333]">
                  {watchedValues.symbolCode} {watchedValues.symbolName}
                </span>
              </div>
            </div>

            {/* ポジションタイプ */}
            <div className="space-y-2">
              <Label className="text-[14px] font-normal text-[#333333]">
                ポジションタイプ
              </Label>
              <Controller
                name="side"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting || isLoading}
                  >
                    <SelectTrigger 
                      className="h-10 border-[#8b9198] rounded-[4px]"
                      data-testid="entry-side"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LONG">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 6L18.29 8.29 13.41 13.17 9.41 9.17 2 16.59 3.41 18 9.41 12 13.41 16 19.71 9.71 22 12V6Z"/>
                          </svg>
                          <span>ロング（買い）</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="SHORT">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-red-600" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M16 18L18.29 15.71 13.41 10.83 9.41 14.83 2 7.41 3.41 6 9.41 12 13.41 8 19.71 14.29 22 12V18Z"/>
                          </svg>
                          <span>ショート（売り）</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.side && (
                <p className="text-xs text-red-600" role="alert">
                  {errors.side.message}
                </p>
              )}
            </div>

            {/* 価格 */}
            <div className="space-y-2">
              <Label htmlFor="price" className="text-[14px] font-normal text-[#333333]">
                価格
              </Label>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <div className="relative">
                    <Input
                      {...field}
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0"
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      className={`h-10 border-[#8b9198] rounded-[4px] pr-8 ${errors.price ? 'border-red-500' : ''}`}
                      disabled={isSubmitting || isLoading}
                      data-testid="entry-price"
                      aria-describedby={errors.price ? 'price-error' : undefined}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[14px] text-[#8b9198]">
                      円
                    </span>
                  </div>
                )}
              />
              {errors.price && (
                <p id="price-error" className="text-xs text-red-600" role="alert">
                  {errors.price.message}
                </p>
              )}
            </div>

            {/* 株数 */}
            <div className="space-y-2">
              <Label htmlFor="qty" className="text-[14px] font-normal text-[#333333]">
                株数
              </Label>
              <Controller
                name="qty"
                control={control}
                render={({ field }) => (
                  <div className="relative">
                    <Input
                      {...field}
                      id="qty"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="0"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      className={`h-10 border-[#8b9198] rounded-[4px] pr-8 ${errors.qty ? 'border-red-500' : ''}`}
                      disabled={isSubmitting || isLoading}
                      data-testid="entry-qty"
                      aria-describedby={errors.qty ? 'qty-error' : undefined}
                    />
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[14px] text-[#8b9198]">
                      株
                    </span>
                  </div>
                )}
              />
              {errors.qty && (
                <p id="qty-error" className="text-xs text-red-600" role="alert">
                  {errors.qty.message}
                </p>
              )}
            </div>

            {/* 区切り線 */}
            <div className="h-px bg-[#d9d9d9] my-4" />

            {/* AI分析セクション */}
            <div className="space-y-2">
              <Label className="text-[16px] font-normal text-[#333333]">
                AI分析 <span className="text-[#70757c]">（任意）</span>
              </Label>
              <div className="bg-[#f6fbff] p-2 rounded-[4px] text-[14px] text-[#565a5f] leading-[1.6]">
                AIがエントリーの判断を評価し、改善のヒントをお届けします✨
              </div>
              
              {/* 画像アップロード */}
              <div className="border-2 border-dashed border-[#8b9198] rounded-lg p-4 text-center">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-6 h-6 text-[#8b9198]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                  <span className="text-[14px] font-medium text-[#8b9198]">
                    チャート画像をアップロード
                  </span>
                </div>
                <div className="mt-2 text-[12px] text-[#8b9198]">
                  <p>対応ファイル形式：png・jpg</p>
                  <p>最大ファイルサイズ：10MB</p>
                </div>
              </div>
            </div>

            {/* メモ */}
            <div className="space-y-2">
              <Label htmlFor="note" className="text-[14px] font-normal text-[#333333]">
                メモ（任意）
              </Label>
              <Controller
                name="note"
                control={control}
                render={({ field }) => (
                  <textarea
                    {...field}
                    id="note"
                    placeholder="メモを入力..."
                    rows={3}
                    className="w-full px-3 py-2 border border-[#8b9198] rounded-[4px] text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isSubmitting || isLoading}
                    data-testid="entry-note"
                  />
                )}
              />
            </div>

            {/* アクションボタン */}
            <div className="flex justify-end gap-8 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting || isLoading}
                className="text-[16px] font-medium text-[#8b9198] hover:text-[#333333]"
                data-testid="entry-edit-cancel"
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isLoading || !isValid}
                className="bg-[#1e77f0] hover:bg-[#1557b0] text-white text-[16px] font-bold px-4 py-3 rounded-lg w-[83px] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="entry-edit-save"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>送信中</span>
                  </div>
                ) : (
                  '送信'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};

export default EditEntryModal;
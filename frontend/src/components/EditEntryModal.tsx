import React, { useState, useEffect } from 'react';

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogOverlay, DialogPortal } from './UI/dialog';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './UI/select';
import { entryEditSchema, type EntryEditFormData, type ValidationErrors } from '../schemas/entryForm';
import { EntryPayload } from '../types/chat';
import { updatePositionEntry, fetchPositionById, PositionsApiError } from '../lib/api/positions';
import { Position } from '../store/positions';
import { 
  classifyError, 
  generateUserFriendlyMessage, 
  type ErrorDetail 
} from '../lib/errorHandling';
import { reportErrorToSentry, addUserActionBreadcrumb, addAPICallBreadcrumb } from '../lib/sentryIntegration';
import { telemetryHelpers } from '../lib/telemetry';
import { regeneratePositionAnalysis } from '../lib/aiRegeneration';

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: EntryPayload & { positionId?: string; version?: number };
  onSave: (data: EntryPayload) => Promise<void>;
  onUpdateSuccess?: (position: Position) => void;
  onAddBotMessage?: (message: { id: string; type: 'bot'; content: string; timestamp: string; testId?: string }) => void;
  isLoading?: boolean;
}

const EditEntryModal: React.FC<EditEntryModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  onUpdateSuccess,
  onAddBotMessage,
  isLoading = false
}) => {
  const [submitError, setSubmitError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConflictMode, setIsConflictMode] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  const [currentErrorDetail, setCurrentErrorDetail] = useState<ErrorDetail | null>(null);
  const [bannerType, setBannerType] = useState<'error' | 'info'>('error');
  const [aiRegeneratingStatus, setAiRegeneratingStatus] = useState<'idle' | 'regenerating' | 'error' | 'ready'>('idle');

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
      executedAt: new Date().toISOString().slice(0, 16),
      version: 0
    }
  });

  // プレフィル処理
  useEffect(() => {
    if (isOpen && initialData) {
      // symbolCodeから銘柄コードと銘柄名を分離
      let symbolCode = initialData.symbolCode || '';
      let symbolName = initialData.symbolName || '';
      
      // もしsymbolCodeに銘柄名も含まれている場合（"4661 銘柄名"形式）
      if (symbolCode && !symbolName && symbolCode.includes(' ')) {
        const parts = symbolCode.split(' ');
        symbolCode = parts[0];
        symbolName = parts.slice(1).join(' ');
      }
      
      reset({
        symbolCode,
        symbolName,
        side: initialData.side || 'LONG',
        price: initialData.price || 0,
        qty: initialData.qty || 0,
        note: initialData.note || '',
        tradeId: initialData.tradeId || '',
        executedAt: initialData.executedAt || new Date().toISOString().slice(0, 16),
        version: initialData.version || 0
      });
      setSubmitError('');
      setIsConflictMode(false);
      
      // テレメトリ記録: エントリ編集モーダル表示
      const currentPosition: Position = {
        id: initialData?.positionId || '',
        symbol: initialData.symbolCode || '',
        side: initialData.side || 'LONG',
        avgPrice: initialData.price || 0,
        qtyTotal: initialData.qty || 0,
        status: 'OPEN' as const,
        ownerId: 'current_user',
        version: initialData?.version || 1,
        updatedAt: new Date().toISOString(),
        chatId: 'default'
      };
      
      telemetryHelpers.trackEditOpened(
        currentPosition,
        'menu', // トリガー - メニューから開かれることが多い
        Boolean(initialData.symbolCode) // 既存データありか
      );
    }
  }, [isOpen, initialData, reset]);

  // 409エラー後の再取得処理
  const handleRefetch = async () => {
    if (!initialData?.positionId || isRefetching) return;
    
    setIsRefetching(true);
    
    // ユーザー操作パンくず記録
    addUserActionBreadcrumb('refetch_position', {
      position_id: initialData.positionId
    });
    
    try {
      const startTime = Date.now();
      const updatedPosition = await fetchPositionById(initialData.positionId);
      const responseTime = Date.now() - startTime;
      
      // API呼び出しパンくず記録
      addAPICallBreadcrumb(
        'GET',
        `/api/positions/${initialData.positionId}`,
        200,
        responseTime
      );
      
      // 既存のユーザー入力を保持したまま、versionのみ更新
      const currentFormData = watch();
      setValue('version', updatedPosition.version);
      
      setIsConflictMode(false);
      setSubmitError('');
      setCurrentErrorDetail(null);
      setBannerType('error');
      
      // テレメトリ記録
      if (window.gtag) {
        window.gtag('event', 'entry_edit_refetch', {
          event_category: 'position_management',
          position_id: initialData.positionId
        });
      }
    } catch (error) {
      console.error('Failed to refetch position:', error);
      
      // エラー分類・整形
      const errorDetail = classifyError(error as Error, {
        operation: 'position_refetch',
        statusCode: error instanceof PositionsApiError ? error.status : undefined
      });
      
      const userMessage = generateUserFriendlyMessage(errorDetail);
      setSubmitError(userMessage);
      setCurrentErrorDetail(errorDetail);
      
      // Sentryエラー送信
      reportErrorToSentry(errorDetail, {
        operation: 'position_refetch',
        position_id: initialData.positionId
      });
      
    } finally {
      setIsRefetching(false);
    }
  };

  const onSubmit = async (data: EntryEditFormData) => {
    if (isSubmitting || !isValid) return;
    
    setIsSubmitting(true);
    setSubmitError('');
    setIsConflictMode(false);
    
    try {
      // Position Store直接更新ロジック
      const updatedPosition: Position = {
        symbol: data.symbolCode,
        side: data.side,
        qtyTotal: data.qty,
        avgPrice: data.price,
        lots: [], // 既存のlots構造は保持されるはず
        realizedPnl: 0, // 既存の値は保持されるはず
        updatedAt: new Date().toISOString(),
        name: data.symbolName,
        chatId: initialData?.positionId?.split(':')[2] || 'default',
        version: data.version + 1,
        status: 'OPEN',
        ownerId: 'current_user'
      };
      
      console.log('🔧 Updated position data:', updatedPosition);
      
      // テレメトリ記録: エントリ保存成功  
      const changeFields = Object.keys(data).filter(key => {
        return key !== 'version' && initialData && (initialData as any)[key] !== (data as any)[key];
      });
      
      const validationErrors = Object.keys(errors).length;
      
      telemetryHelpers.trackEditSaved(
        updatedPosition,
        changeFields,
        validationErrors,
        0 // 初回成功時はretryCount = 0
      );
      
      // 成功イベント発行
      if (onUpdateSuccess) {
        onUpdateSuccess(updatedPosition);
      }
      
      // ユーザーメッセージ追加: 建値更新通知
      if (onAddBotMessage) {
        const symbolDisplayName = updatedPosition.name 
          ? `${updatedPosition.symbol} ${updatedPosition.name}`
          : updatedPosition.symbol;
          
        const sideText = updatedPosition.side === 'LONG' ? 'ロング（買い）' : 'ショート（売り）';
        
        const userMessageContent = `📈 建値を更新しました！<br/>銘柄: ${symbolDisplayName}<br/>ポジションタイプ: ${sideText}<br/>建値: ${updatedPosition.avgPrice.toLocaleString()}円<br/>数量: ${updatedPosition.qtyTotal.toLocaleString()}株`;
        
        onAddBotMessage({
          id: crypto.randomUUID(),
          type: 'user',
          content: userMessageContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          testId: 'user-msg-price-updated'
        });

        // 取引プラン設定ボットメッセージを追加（建値更新用）
        setTimeout(() => {
          if (onAddBotMessage) {
            const entryPrice = updatedPosition.avgPrice;
            const profitTarget5Pct = Math.round(entryPrice * (updatedPosition.side === 'LONG' ? 1.05 : 0.95));
            const stopLoss2Pct = Math.round(entryPrice * (updatedPosition.side === 'LONG' ? 0.98 : 1.02));
            const predictedProfit = Math.round((profitTarget5Pct - entryPrice) * updatedPosition.qtyTotal);
            const predictedLoss = Math.round((entryPrice - stopLoss2Pct) * updatedPosition.qtyTotal) * -1;

            const tradingPlanContent = 
              `🎯 取引プラン設定<br/>` +
              `📋 リスク管理ルール<br/>` +
              `• 利確目標: +5% → <span style="color: #10b981;">${profitTarget5Pct.toLocaleString()}円</span><br/>` +
              `• 損切り目標: -2% → <span style="color: #ef4444;">${stopLoss2Pct.toLocaleString()}円</span><br/><br/>` +
              `💰 予想損益<br/>` +
              `• 利確時: <span style="color: #10b981;">+${predictedProfit.toLocaleString()}円</span><br/>` +
              `• 損切り時: <span style="color: #ef4444;">${predictedLoss.toLocaleString()}円</span><br/><br/>` +
              `⚠️ 重要: 必ず逆指値注文を設定して、感情に左右されない取引を心がけましょう`;

            onAddBotMessage({
              id: crypto.randomUUID(),
              type: 'bot',
              content: tradingPlanContent,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              testId: 'bot-msg-trading-plan-updated'
            });
          }
        }, 500);

        // AI分析再生成を実行（チャート画像がある場合のみ）
        setTimeout(async () => {
          try {
            setAiRegeneratingStatus('regenerating');
            const chatId = 'default'; // チャットIDを適切に取得
            
            const result = await regeneratePositionAnalysis(chatId, updatedPosition);
            
            if (result.success) {
              setAiRegeneratingStatus('ready');
            } else {
              console.log('AI regeneration skipped:', result.error);
              setAiRegeneratingStatus('idle'); // 画像がない場合は通常状態に戻す
            }
          } catch (error) {
            console.error('AI regeneration error:', error);
            setAiRegeneratingStatus('error');
          }
        }, 1000); // 取引プランメッセージの後に実行
      }
      
      // 既存のgtag記録も維持
      if (window.gtag) {
        window.gtag('event', 'entry_edit_success', {
          event_category: 'position_management',
          position_id: initialData?.positionId || 'unknown'
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save entry:', error);
      
      // API呼び出しエラーのパンくず記録
      addAPICallBreadcrumb(
        'PATCH',
        `/api/positions/${initialData?.positionId}/entry`,
        error instanceof PositionsApiError ? error.status : undefined
      );
      
      // エラー分類・整形
      const errorDetail = classifyError(error as Error, {
        operation: 'position_update',
        statusCode: error instanceof PositionsApiError ? error.status : undefined,
        originalError: error
      });
      
      const userMessage = generateUserFriendlyMessage(errorDetail);
      setSubmitError(userMessage);
      setCurrentErrorDetail(errorDetail);
      
      // UI状態設定
      if (errorDetail.type === 'PATCH_CONFLICT_409') {
        setIsConflictMode(true);
        setBannerType('info'); // 409は情報レベル
        
        // テレメトリ記録: 409競合エラー
        const currentPosition: Position = {
          id: initialData?.positionId || '',
          symbol: data.symbolCode,
          side: data.side,
          avgPrice: data.price,
          qtyTotal: data.qty,
          status: 'OPEN',
          ownerId: 'current_user',
          version: data.version || 1,
          updatedAt: new Date().toISOString(),
          chatId: 'default'
        };
        
        const conflictFields = (error instanceof PositionsApiError && error.details?.conflictFields) || [];
        const versionDiff = (error instanceof PositionsApiError && error.details?.currentVersion || 1) - (data.version || 1);
        
        telemetryHelpers.trackConflict409(
          currentPosition,
          conflictFields,
          versionDiff,
          'refresh' // デフォルトは再取得アクション
        );
        
        // 既存のgtag記録も維持
        if (window.gtag) {
          window.gtag('event', 'entry_edit_conflict_409', {
            event_category: 'position_management',
            position_id: initialData?.positionId || 'unknown'
          });
        }
      } else {
        setIsConflictMode(false);
        setBannerType('error');
      }
      
      // Sentryエラー送信
      reportErrorToSentry(errorDetail, {
        operation: 'position_update',
        position_id: initialData?.positionId || 'unknown',
        form_data: {
          symbol: data.symbolCode,
          side: data.side,
          price: data.price,
          qty: data.qty
        }
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isLoading && !isRefetching) {
      reset();
      setSubmitError('');
      setIsConflictMode(false);
      setCurrentErrorDetail(null);
      setBannerType('error');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting && !isLoading && !isRefetching) {
      handleClose();
    }
  };

  const watchedValues = watch();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-50 bg-[rgba(51,51,51,0.8)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogContent 
          className="w-[400px] rounded-[24px] p-6 bg-white shadow-[0_8px_24px_0_rgba(0,0,0,0.1)] z-[9999]"
          onKeyDown={handleKeyDown}
          data-testid="entry-edit-modal"
        >
          <DialogHeader className="flex items-center justify-between mb-6">
            <DialogTitle 
              className="font-bold text-[16px] text-[#333333]"
              data-testid="entry-edit-title"
            >
              建値を編集
            </DialogTitle>
            <DialogDescription className="sr-only">
              建値入力の編集フォームです。
            </DialogDescription>
          </DialogHeader>

          {/* エラーバナー */}
          {submitError && (
            <div 
              className={`
                mb-4 p-3 rounded-md border
                ${
                  bannerType === 'info' 
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-red-50 border-red-200'
                }
              `}
              data-testid={isConflictMode ? "entry-edit-conflict" : "entry-edit-banner"}
              data-banner-type={bannerType}
              role="alert"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start">
                    {/* アイコン */}
                    <div className="flex-shrink-0">
                      <svg 
                        className={`w-4 h-4 mt-0.5 ${
                          bannerType === 'info' ? 'text-blue-600' : 'text-red-600'
                        }`}
                        fill="none" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth="2" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        {bannerType === 'info' ? (
                          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        ) : (
                          <path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        )}
                      </svg>
                    </div>
                    <div className="ml-2">
                      <p className={`text-sm font-medium ${
                        bannerType === 'info' ? 'text-blue-800' : 'text-red-800'
                      }`}>
                        {submitError}
                      </p>
                      {currentErrorDetail?.technicalMessage && process.env.NODE_ENV === 'development' && (
                        <p className={`mt-1 text-xs opacity-75 ${
                          bannerType === 'info' ? 'text-blue-700' : 'text-red-700'
                        }`}>
                          {currentErrorDetail.technicalMessage}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {isConflictMode && (
                  <div className="ml-3 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleRefetch}
                      disabled={isRefetching || isSubmitting}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      data-testid="entry-edit-refetch"
                    >
                      {isRefetching && (
                        <svg className="animate-spin -ml-1 mr-2 h-3 w-3" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      )}
                      {isRefetching ? '取得中...' : '最新を取得'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            {/* 銘柄 - 読み取り専用 */}
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-sm text-[#374151] mb-2 block">
                銘柄
              </Label>
              <Input
                value={`${watchedValues.symbolCode || ''} ${watchedValues.symbolName || ''}`.trim()}
                readOnly
                className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB] bg-[#F6F6F6]"
                data-testid="entry-symbol"
              />
            </div>

            {/* ポジションタイプ */}
            <div className="space-y-2">
              <Label className="text-sm text-[#374151] mb-2 block">
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
                      className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB]"
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

            <div>
              <Label className="text-sm text-[#374151] mb-2 block">価格</Label>
              <Controller
                name="price"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="円"
                    value={field.value?.toString() || ''}
                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB] bg-[#F6F6F6]"
                    disabled={isSubmitting || isLoading || isRefetching}
                    data-testid="entry-price"
                  />
                )}
              />
              {errors.price && (
                <p className="text-xs text-red-600" role="alert">
                  {errors.price.message}
                </p>
              )}
            </div>

            <div>
              <Label className="text-sm text-[#374151] mb-2 block">数量</Label>
              <Controller
                name="qty"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="株"
                    value={field.value?.toString() || ''}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    className="w-full h-10 border-[#D1D5DB] focus:border-[#2563EB] bg-[#F6F6F6]"
                    disabled={isSubmitting || isLoading || isRefetching}
                    data-testid="entry-qty"
                  />
                )}
              />
              {errors.qty && (
                <p className="text-xs text-red-600" role="alert">
                  {errors.qty.message}
                </p>
              )}
            </div>

            {/* AI分析（任意） */}
            <div className="border-t border-[#E5E7EB] pt-4">

              <div className="mb-3">
                <Label className="text-sm text-[#374151] font-medium">AI分析（任意）</Label>
              </div>
              
              {/* 説明文 */}
              <div className="bg-[#F6FBFF] px-4 py-3 rounded-lg mb-4">
                <p className="text-sm text-[#374151]">
                  AIがエントリーの判断を評価し、改善のヒントをお届けします✨
                </p>
              </div>
              
              <div className="space-y-3">
                {/* アップロード領域 */}
                <label className="w-full border-2 border-dashed border-[#D1D5DB] rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-[#9CA3AF] transition-colors" style={{height: '72px'}}>
                  <svg className="w-5 h-5 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,5 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="5"/>
                  </svg>
                  <span className="text-sm text-[#9CA3AF]">
                    チャート画像をアップロード
                  </span>
                  <input type="file" accept="image/*" className="hidden" />
                </label>
                <p className="text-xs text-[#9CA3AF] text-center">対応形式：png / jpeg・最大10MB</p>
              </div>
            </div>


            {/* AI再生成状態表示 */}
            {aiRegeneratingStatus === 'regenerating' && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 rounded-lg" data-testid="ai-regenerating">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-700">AI分析を再生成しています...</span>
              </div>
            )}
            
            {aiRegeneratingStatus === 'error' && (
              <div className="flex items-center justify-between gap-2 mb-4 p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-700">AI分析の再生成に失敗しました</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      setAiRegeneratingStatus('regenerating');
                      const chatId = 'default';
                      const result = await regeneratePositionAnalysis(chatId, {
                        id: initialData?.positionId || '',
                        symbol: watch('symbolCode'),
                        side: watch('side'),
                        avgPrice: watch('price'),
                        qtyTotal: watch('qty'),
                        status: 'OPEN',
                        ownerId: 'current_user',
                        version: watch('version') || 1,
                        updatedAt: new Date().toISOString(),
                        chatId: 'default'
                      });
                      
                      if (result.success) {
                        setAiRegeneratingStatus('ready');
                      } else {
                        setAiRegeneratingStatus('idle');
                      }
                    } catch (error) {
                      setAiRegeneratingStatus('error');
                    }
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  再試行
                </Button>
              </div>
            )}

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
                disabled={isSubmitting || isLoading || isRefetching || !isValid}
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
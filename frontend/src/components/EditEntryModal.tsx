import React, { useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './UI/dialog';
import { Button } from './UI/button';
import { Input } from './UI/input';
import { Label } from './UI/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './UI/select';
import { Switch } from './UI/switch';
import type { EntryPayload, ChartPattern } from '../types/chat';
import type { Position } from '../store/positions';
import { syncPositionFromServer, makePositionKey } from '../store/positions';
import {
  fetchPositionById,
  updatePositionEntry,
  PositionsApiError,
} from '../lib/api/positions';
import {
  regeneratePositionAnalysis,
  handleAIRegenerationFailure,
} from '../lib/aiRegeneration';
import { CHART_PATTERNS } from '../constants/chartPatterns';
import { showToast } from './UI/Toast';

interface RiskSettings {
  takeProfitRate: number;
  stopLossRate: number;
}

interface PlanInputs {
  price: number;
  qty: number;
  side: 'LONG' | 'SHORT';
}

interface TradePlanPreview {
  takeProfitPrice: number;
  stopLossPrice: number;
  expectedProfit: number;
  expectedLoss: number;
  riskReward: number | null;
}

const DEFAULT_RISK_SETTINGS: RiskSettings = {
  takeProfitRate: 0.05,
  stopLossRate: 0.02,
};

const PRICE_PRECISION = 2;

const getNumberFromStorage = (key: string): number | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getRiskSettings = (): RiskSettings => {
  const takeProfitPercent = getNumberFromStorage('takeProfitPercent');
  const stopLossPercent = getNumberFromStorage('stopLossPercent');

  const takeProfitRate = takeProfitPercent && takeProfitPercent > 0
    ? takeProfitPercent / 100
    : DEFAULT_RISK_SETTINGS.takeProfitRate;
  const stopLossRate = stopLossPercent && stopLossPercent > 0
    ? stopLossPercent / 100
    : DEFAULT_RISK_SETTINGS.stopLossRate;

  return {
    takeProfitRate,
    stopLossRate,
  };
};

const toPlanInputs = (
  price: number | undefined,
  qty: number | undefined,
  side: 'LONG' | 'SHORT' | undefined
): PlanInputs | null => {
  if (!side) return null;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0) return null;
  return { price, qty, side };
};

const computeTradePlanPreview = (
  inputs: PlanInputs | null,
  settings: RiskSettings
): TradePlanPreview | null => {
  if (!inputs) return null;

  const { price, qty, side } = inputs;
  const { takeProfitRate, stopLossRate } = settings;

  const takeProfitPrice = side === 'LONG'
    ? price * (1 + takeProfitRate)
    : price * (1 - takeProfitRate);
  const stopLossPrice = side === 'LONG'
    ? price * (1 - stopLossRate)
    : price * (1 + stopLossRate);

  const expectedProfit = Math.abs(takeProfitPrice - price) * qty;
  const expectedLoss = Math.abs(price - stopLossPrice) * qty;
  const riskReward = expectedLoss === 0 ? null : expectedProfit / expectedLoss;

  return {
    takeProfitPrice,
    stopLossPrice,
    expectedProfit,
    expectedLoss,
    riskReward,
  };
};

const arePlanInputsEqual = (a: PlanInputs, b: PlanInputs): boolean => {
  const normalizePrice = (value: number) => Number(value.toFixed(PRICE_PRECISION));
  return (
    normalizePrice(a.price) === normalizePrice(b.price) &&
    a.qty === b.qty &&
    a.side === b.side
  );
};

const formatCurrency = (value: number): string => {
  return `¥${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: PRICE_PRECISION }).format(value)}`;
};

const formatAmount = (value: number): string => {
  return `¥${new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(Math.round(value))}`;
};

const MAX_PRICE = 99999999.99;
const MAX_QTY = 100000000;

const chartPatternValues = CHART_PATTERNS.map(pattern => pattern.value);

const formSchema = z.object({
  symbolCode: z.string().min(1, '銘柄コードが不正です'),
  symbolName: z.string().optional().default(''),
  side: z.enum(['LONG', 'SHORT'], {
    errorMap: () => ({ message: 'ポジションタイプを選択してください' }),
  }),
  price: z
    .number({
      required_error: '価格を入力してください',
      invalid_type_error: '価格は数値で入力してください',
    })
    .min(0.01, '価格は0.01円以上である必要があります')
    .max(MAX_PRICE, '価格が大きすぎます')
    .refine((value) => {
      const decimal = value.toString().split('.')[1];
      return !decimal || decimal.length <= 2;
    }, '価格は小数点以下2桁までです'),
  qty: z
    .number({
      required_error: '株数を入力してください',
      invalid_type_error: '株数は数値で入力してください',
    })
    .int('株数は整数である必要があります')
    .min(1, '株数は1株以上である必要があります')
    .max(MAX_QTY, '株数が大きすぎます'),
  note: z
    .string()
    .max(500, 'メモは500文字以内で入力してください')
    .optional()
    .default(''),
  chartPattern: z
    .string()
    .optional()
    .default('')
    .refine(
      (value) => value === '' || chartPatternValues.includes(value as ChartPattern),
      'チャートパターンが不正です'
    ),
  version: z
    .number({
      required_error: 'バージョン情報が不正です',
      invalid_type_error: 'バージョン情報が不正です',
    })
    .nonnegative('バージョン情報が不正です'),
  tradeId: z.string().optional(),
});

export type EditEntryFormValues = z.infer<typeof formSchema>;

interface EditEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: (EntryPayload & { positionId?: string; version?: number; chatId?: string | null }) | null;
  onSave?: (data: EntryPayload, context: EditEntrySaveContext) => Promise<void> | void;
  onUpdateSuccess?: (position: Position) => void;
  chatId?: string | null;
  isLoading?: boolean;
  onAddBotMessage?: (message: {
    id: string;
    type: 'bot';
    content: string;
    timestamp: string;
    testId?: string;
  }) => void;
}

interface EditEntrySaveContext {
  regenerateEnabled: boolean;
  planRegenerated: boolean;
}

const defaultValues: EditEntryFormValues = {
  symbolCode: '',
  symbolName: '',
  side: 'LONG',
  price: 0,
  qty: 0,
  note: '',
  chartPattern: '',
  version: 0,
  tradeId: '',
};

const EditEntryModal: React.FC<EditEntryModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  onUpdateSuccess,
  chatId,
  isLoading = false,
  onAddBotMessage: _onAddBotMessage,
}) => {
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [serverError, setServerError] = useState<string>('');
  const [regenerateEnabled, setRegenerateEnabled] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPlanDirty, setIsPlanDirty] = useState(false);

  const positionId = initialData?.positionId;
  const riskSettings = useMemo(() => getRiskSettings(), []);
  const lastSavedPlanInputsRef = useRef<PlanInputs | null>(null);

  const emitPositionEvent = (eventName: string, detail: Record<string, unknown>) => {
    if (typeof window === 'undefined') {
      return;
    }
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  };

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isValid },
  } = useForm<EditEntryFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
    mode: 'onChange',
  });

  const watchedSide = useWatch({ control, name: 'side' });
  const watchedPrice = useWatch({ control, name: 'price' });
  const watchedQty = useWatch({ control, name: 'qty' });

  const watchedPlanInputs = useMemo(
    () => toPlanInputs(watchedPrice, watchedQty, watchedSide),
    [watchedPrice, watchedQty, watchedSide]
  );

  const planPreview = useMemo(
    () => computeTradePlanPreview(watchedPlanInputs, riskSettings),
    [watchedPlanInputs, riskSettings]
  );

  useEffect(() => {
    const previous = lastSavedPlanInputsRef.current;
    if (!watchedPlanInputs || !previous) {
      setIsPlanDirty(false);
      return;
    }
    setIsPlanDirty(!arePlanInputsEqual(previous, watchedPlanInputs));
  }, [watchedPlanInputs]);

  useEffect(() => {
    if (!isOpen) {
      reset(defaultValues);
      setServerError('');
      setRegenerateEnabled(true);
      setIsPlanDirty(false);
      lastSavedPlanInputsRef.current = null;
      return;
    }

    let isCancelled = false;
    async function prefill() {
      if (!initialData) {
        reset(defaultValues);
        lastSavedPlanInputsRef.current = toPlanInputs(
          defaultValues.price,
          defaultValues.qty,
          defaultValues.side
        );
        setIsPlanDirty(false);
        return;
      }

      setPrefillLoading(true);
      setServerError('');
      setRegenerateEnabled(true);

      try {
        let latestSymbolName = initialData.symbolName ?? '';
        let latestValues: EditEntryFormValues = {
          symbolCode: initialData.symbolCode,
          symbolName: latestSymbolName,
          side: initialData.side,
          price: initialData.price,
          qty: initialData.qty,
          note: initialData.note ?? '',
          chartPattern: initialData.chartPattern ?? '',
          version: initialData.version ?? 0,
          tradeId: initialData.tradeId ?? '',
        };

        if (positionId) {
          const latest = await fetchPositionById(positionId);
          latestSymbolName = latest.name ?? latestSymbolName;
          latestValues = {
            symbolCode: latest.symbol,
            symbolName: latestSymbolName,
            side: latest.side,
            price: latest.avgPrice,
            qty: latest.qtyTotal,
            note: initialData.note ?? '',
            chartPattern: initialData.chartPattern ?? '',
            version: latest.version,
            tradeId: initialData.tradeId ?? latest.currentTradeId ?? '',
          };
        }

        if (!isCancelled) {
          reset(latestValues, { keepDefaultValues: false });
          lastSavedPlanInputsRef.current = toPlanInputs(
            latestValues.price,
            latestValues.qty,
            latestValues.side
          );
          setIsPlanDirty(false);
        }
      } catch (error) {
        console.error('Failed to fetch latest position:', error);
        if (!isCancelled) {
          const message =
            error instanceof PositionsApiError
              ? error.message
              : '最新の建値情報の取得に失敗しました';
          setServerError(message);
          reset({
            symbolCode: initialData.symbolCode,
            symbolName: initialData.symbolName ?? '',
            side: initialData.side,
            price: initialData.price,
            qty: initialData.qty,
            note: initialData.note ?? '',
            chartPattern: initialData.chartPattern ?? '',
            version: initialData.version ?? 0,
            tradeId: initialData.tradeId ?? '',
          });
          lastSavedPlanInputsRef.current = toPlanInputs(
            initialData.price,
            initialData.qty,
            initialData.side
          );
          setIsPlanDirty(false);
        }
      } finally {
        if (!isCancelled) {
          setPrefillLoading(false);
        }
      }
    }

    prefill();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, initialData, positionId, reset]);

  const isSubmitDisabled =
    prefillLoading ||
    isSubmitting ||
    isLoading ||
    !isValid ||
    !isDirty;

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const submitHandler = handleSubmit(async (values) => {
    if (!initialData) {
      setServerError('編集対象が見つかりません');
      return;
    }

    setIsSubmitting(true);
    setServerError('');

    try {
      const nextPlanInputs: PlanInputs = {
        price: values.price,
        qty: values.qty,
        side: values.side,
      };
      const previousPlanInputs = lastSavedPlanInputsRef.current;
      const planInputsChanged =
        !previousPlanInputs || !arePlanInputsEqual(previousPlanInputs, nextPlanInputs);

      const entryPayload: EntryPayload = {
        symbolCode: values.symbolCode,
        symbolName: values.symbolName,
        side: values.side,
        price: values.price,
        qty: values.qty,
        note: values.note,
        tradeId:
          values.tradeId && values.tradeId.length > 0
            ? values.tradeId
            : initialData.tradeId ?? '',
        executedAt: initialData.executedAt,
        chartPattern:
          values.chartPattern && values.chartPattern.length > 0
            ? (values.chartPattern as ChartPattern)
            : undefined,
      };

      if (!positionId) {
        if (onSave) {
          await onSave(entryPayload, {
            regenerateEnabled,
            planRegenerated: planInputsChanged,
          });
        }
        lastSavedPlanInputsRef.current = nextPlanInputs;
        setIsPlanDirty(false);
        onClose();
        return;
      }

      const payload = {
        symbolCode: values.symbolCode,
        symbolName: values.symbolName,
        side: values.side,
        price: values.price,
        qty: values.qty,
        note: values.note ?? '',
        version: values.version,
        chartPattern:
          values.chartPattern && values.chartPattern.length > 0
            ? (values.chartPattern as ChartPattern)
            : undefined,
      };

      let dispatchedStart = false;
      let mutationContext: { symbol: string; side: 'LONG' | 'SHORT'; chatId: string | null } | null = null;

      if (positionId) {
        mutationContext = {
          symbol: values.symbolCode,
          side: values.side,
          chatId: initialData?.chatId ?? chatId ?? null,
        };

        emitPositionEvent('position-update-start', {
          ...mutationContext,
          key: makePositionKey(
            mutationContext.symbol,
            mutationContext.side,
            mutationContext.chatId
          ),
        });
        dispatchedStart = true;
      }

      const response = await updatePositionEntry(positionId, payload);
      const position = response.position;

      const effectiveChatId = position.chatId ?? mutationContext?.chatId ?? undefined;
      const positionForSync: Position = effectiveChatId === position.chatId
        ? position
        : { ...position, chatId: effectiveChatId };

      const syncedPosition = syncPositionFromServer(positionForSync);
      const positionForEvent = syncedPosition ?? positionForSync;

      if (dispatchedStart) {
        emitPositionEvent('position-update-complete', {
          position: positionForEvent,
          key: makePositionKey(
            positionForEvent.symbol,
            positionForEvent.side,
            positionForEvent.chatId ?? mutationContext?.chatId ?? null
          ),
        });
      }

      const resolvedTradeId =
        entryPayload.tradeId && entryPayload.tradeId.length > 0
          ? entryPayload.tradeId
          : position.currentTradeId ?? '';

      const payloadForSave: EntryPayload = {
        ...entryPayload,
        tradeId: resolvedTradeId,
      };

      if (onSave) {
        await onSave(payloadForSave, {
          regenerateEnabled,
          planRegenerated: planInputsChanged,
        });
      }

      if (onUpdateSuccess) {
        onUpdateSuccess(positionForEvent);
      }

      lastSavedPlanInputsRef.current = nextPlanInputs;
      setIsPlanDirty(false);

      if (regenerateEnabled && chatId && planInputsChanged) {
        try {
          const result = await regeneratePositionAnalysis(chatId, position);
          if (!result.success && chatId) {
            handleAIRegenerationFailure(
              chatId,
              position,
              result.error ?? '再生成に失敗しました'
            );
          }
        } catch (error) {
          if (chatId) {
            handleAIRegenerationFailure(
              chatId,
              position,
              error instanceof Error ? error.message : 'unknown error'
            );
          }
        }
      }

      onClose();
    } catch (error) {
      console.error('Failed to update entry:', error);
      if (positionId) {
        const chatContext = initialData?.chatId ?? chatId ?? null;
        emitPositionEvent('position-update-error', {
          symbol: values.symbolCode,
          side: values.side,
          chatId: chatContext,
          key: makePositionKey(values.symbolCode, values.side, chatContext),
          error: error instanceof Error ? error.message : 'unknown error',
        });
      }
      if (error instanceof PositionsApiError) {
        if (error.status === 400) {
          const message = error.message || '入力内容を確認してください';
          if (/株数|qty/i.test(message)) {
            setError('qty', { message });
          } else if (/価格|price/i.test(message)) {
            setError('price', { message });
          } else {
            setServerError(message);
          }
        } else if (error.status === 409) {
          setServerError('他のユーザーが先に更新しました。再度開き直してください。');
        } else {
          setServerError(error.message || '更新に失敗しました');
        }
      } else {
        setServerError('建値の更新に失敗しました');
      }

      const toastDescription =
        error instanceof PositionsApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : undefined;
      showToast.error('建値の更新に失敗しました', toastDescription ? { description: toastDescription } : undefined);
    } finally {
      setIsSubmitting(false);
    }
  });

  const priceError = errors.price?.message;
  const qtyError = errors.qty?.message;

  const helperText = useMemo(() => {
    if (!regenerateEnabled) {
      return '再生成をオフにすると、AIによる取引プランは更新されません。';
    }
    if (!isPlanDirty) {
      return '値に変更がない場合はAI取引プランの再生成をスキップします。';
    }
    return '建値更新後にAI取引プランを自動で再生成します。';
  }, [regenerateEnabled, isPlanDirty]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="w-full max-w-lg"
        data-testid="modal-edit-entry"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900">
            建値を編集
          </DialogTitle>
          <DialogDescription>
            最新の建値情報に更新し、必要に応じてAI分析を再生成します。
          </DialogDescription>
        </DialogHeader>

        <form className="mt-6 grid gap-4" onSubmit={submitHandler}>
          {serverError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="price" className="text-sm font-medium text-gray-700">
              建値（円）
            </Label>
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min={0}
                  disabled={prefillLoading || isSubmitting || isLoading}
                  data-testid="input-price"
                  value={Number.isNaN(field.value) ? '' : field.value}
                  onChange={(event) => {
                    const value = event.target.value;
                    field.onChange(value === '' ? 0 : Number(value));
                  }}
                />
              )}
            />
            {priceError && (
              <p className="text-xs text-red-600" data-testid="error-price">
                {priceError}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="qty" className="text-sm font-medium text-gray-700">
              株数
            </Label>
            <Controller
              name="qty"
              control={control}
              render={({ field }) => (
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  step={1}
                  disabled={prefillLoading || isSubmitting || isLoading}
                  data-testid="input-size"
                  value={Number.isNaN(field.value) ? '' : field.value}
                  onChange={(event) => {
                    const value = event.target.value;
                    field.onChange(value === '' ? 0 : Number(value));
                  }}
                />
              )}
            />
            {qtyError && (
              <p className="text-xs text-red-600" data-testid="error-size">
                {qtyError}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="text-sm font-medium text-gray-700" htmlFor="side">
              ポジションタイプ
            </Label>
            <Controller
              name="side"
              control={control}
              render={({ field }) => (
                <Select
                  defaultValue={field.value}
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={prefillLoading || isSubmitting || isLoading}
                >
                  <SelectTrigger id="side" data-testid="select-side">
                    <SelectValue placeholder="選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LONG">ロング（買い）</SelectItem>
                    <SelectItem value="SHORT">ショート（売り）</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="chartPattern" className="text-sm font-medium text-gray-700">
              チャートパターン（任意）
            </Label>
            <Controller
              name="chartPattern"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? ''}
                  defaultValue={field.value ?? ''}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={prefillLoading || isSubmitting || isLoading}
                >
                  <SelectTrigger id="chartPattern" data-testid="select-chart-pattern">
                    <SelectValue placeholder="選択しない" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">選択しない</SelectItem>
                    {CHART_PATTERNS.map((pattern) => (
                      <SelectItem key={pattern.value} value={pattern.value}>
                        {pattern.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="note" className="text-sm font-medium text-gray-700">
              メモ（任意）
            </Label>
            <Controller
              name="note"
              control={control}
              render={({ field }) => (
                <textarea
                  id="note"
                  rows={3}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={500}
                  placeholder="取引の理由や背景を入力してください"
                  disabled={prefillLoading || isSubmitting || isLoading}
                  data-testid="input-note"
                  value={field.value ?? ''}
                  onChange={(event) => field.onChange(event.target.value)}
                />
              )}
            />
          </div>

          <div
            className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-4"
            data-testid="trade-plan-preview"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-900">取引プランプレビュー</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isPlanDirty
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-500'
                }`}
                data-testid="plan-status"
              >
                {isPlanDirty ? '再生成予定' : '変更なし'}
              </span>
            </div>
            {planPreview ? (
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">利確目標</span>
                  <span className="text-green-600" data-testid="plan-take-profit">
                    {formatCurrency(planPreview.takeProfitPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">損切り目標</span>
                  <span className="text-red-600" data-testid="plan-stop-loss">
                    {formatCurrency(planPreview.stopLossPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">想定利益</span>
                  <span className="text-gray-900" data-testid="plan-expected-profit">
                    {formatAmount(planPreview.expectedProfit)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">想定損失</span>
                  <span className="text-gray-900" data-testid="plan-expected-loss">
                    {formatAmount(planPreview.expectedLoss)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">リスクリワード</span>
                  <span className="text-gray-900" data-testid="plan-risk-reward">
                    {planPreview.riskReward ? `1:${planPreview.riskReward.toFixed(2)}` : '—'}
                  </span>
                </div>
                {isPlanDirty && (
                  <p className="mt-2 text-xs text-blue-600" data-testid="plan-dirty-hint">
                    保存すると新しい取引プランが適用されます。
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-500" data-testid="plan-empty">
                建値と株数を入力すると、利確・損切り目標が表示されます。
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-3">
            <div className="space-y-1">
              <span className="text-sm font-medium text-gray-900">
                AI取引プランを再生成
              </span>
              <p className="text-xs text-gray-500" data-testid="toggle-helper">
                {helperText}
              </p>
            </div>
            <Switch
              checked={regenerateEnabled}
              onCheckedChange={setRegenerateEnabled}
              data-testid="toggle-regenerate"
              disabled={prefillLoading || isSubmitting || isLoading}
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting || isLoading}
              data-testid="btn-cancel-update"
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={isSubmitDisabled}
              data-testid="btn-submit-update"
            >
              {isSubmitting ? '更新中...' : '更新する'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditEntryModal;

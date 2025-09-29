/**
 * 再試行ロジック・重複防止システム
 * Bot/AI失敗時の個別再試行処理
 */

import type { Position } from '../store/positions';
import { PositionUpdateDiff } from '../utils/positionCalculations';
import { sendPositionUpdateMessages } from './botMessaging';
import { regeneratePositionAnalysis } from './aiRegeneration';
import { 
  ErrorDetail, 
  calculateRetryDelay, 
  incrementErrorCount, 
  getErrorCount, 
  resetErrorCount,
  generateErrorHash,
  logError
} from './errorHandling';
import { showToast, createToastFromError } from '../components/UI/Toast';
import { calculatePositionMetrics } from '../utils/positionCalculations';

// 再試行の状態管理
interface RetryState {
  inProgress: boolean;
  attemptCount: number;
  lastAttempt: number;
  errorHashes: Set<string>;
}

// 再試行状態のマップ（操作種別ごと）
const retryStates = new Map<string, RetryState>();

// 再試行のタイプ定義
export type RetryType = 
  | 'position_update'
  | 'bot_messages'
  | 'bot_user_message'
  | 'bot_system_message'
  | 'ai_regeneration';

// 再試行コンテキスト
export interface RetryContext {
  chatId: string;
  position: Position;
  updateDiff?: PositionUpdateDiff;
  originalError?: ErrorDetail;
}

// 再試行結果
export interface RetryResult {
  success: boolean;
  error?: ErrorDetail;
  attemptCount: number;
  skipReason?: string;
}

/**
 * 再試行状態の確認
 */
export function isRetryInProgress(key: string): boolean {
  const state = retryStates.get(key);
  return state?.inProgress || false;
}

/**
 * 再試行状態のリセット
 */
export function resetRetryState(key: string): void {
  retryStates.delete(key);
  resetErrorCount(key);
}

/**
 * 再試行可否の判定
 */
export function canRetry(
  key: string, 
  maxRetries: number = 3,
  minInterval: number = 1000
): { canRetry: boolean; reason?: string } {
  const state = retryStates.get(key);
  
  // 進行中チェック
  if (state?.inProgress) {
    return { canRetry: false, reason: '再試行が進行中です' };
  }
  
  // 最大試行回数チェック
  if (state && state.attemptCount >= maxRetries) {
    return { canRetry: false, reason: '最大再試行回数に達しました' };
  }
  
  // 間隔チェック
  if (state && (Date.now() - state.lastAttempt) < minInterval) {
    return { canRetry: false, reason: '再試行間隔が短すぎます' };
  }
  
  return { canRetry: true };
}

/**
 * 再試行状態の更新
 */
function updateRetryState(
  key: string, 
  update: Partial<RetryState>
): void {
  const current = retryStates.get(key) || {
    inProgress: false,
    attemptCount: 0,
    lastAttempt: 0,
    errorHashes: new Set()
  };
  
  retryStates.set(key, { ...current, ...update });
}

/**
 * Bot メッセージ再送信
 */
export async function retryBotMessages(
  context: RetryContext
): Promise<RetryResult> {
  const key = 'bot_messages';
  const maxRetries = 2;
  
  // 再試行可否チェック
  const checkResult = canRetry(key, maxRetries);
  if (!checkResult.canRetry) {
    return {
      success: false,
      error: {
        type: 'BOT_MESSAGE_FAILED',
        uiType: 'toast',
        severity: 'medium',
        message: checkResult.reason || '再試行できません',
        retryable: false
      } as ErrorDetail,
      attemptCount: retryStates.get(key)?.attemptCount || 0,
      skipReason: checkResult.reason
    };
  }
  
  // 再試行状態開始
  const currentAttempt = (retryStates.get(key)?.attemptCount || 0) + 1;
  updateRetryState(key, {
    inProgress: true,
    attemptCount: currentAttempt,
    lastAttempt: Date.now()
  });
  
  try {
    // 遅延適用（指数バックオフ）
    if (currentAttempt > 1) {
      const delay = calculateRetryDelay(currentAttempt - 1, 1000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // Bot メッセージ再送信実行
    if (!context.updateDiff) {
      throw new Error('UpdateDiff is required for bot message retry');
    }
    
    const metrics = calculatePositionMetrics(context.position);
    const positionMetrics = {
      stopLossTarget: metrics.stopLossTarget,
      profitTarget: metrics.profitTarget,
      riskRatio: metrics.riskRatio,
      expectedProfitAmount: metrics.expectedProfitAmount,
      expectedLossAmount: metrics.expectedLossAmount,
    };
    
    const result = await sendPositionUpdateMessages(
      context.chatId,
      context.position,
      context.updateDiff,
      positionMetrics
    );
    
    if (result.allSuccess) {
      // 成功：状態リセット
      resetRetryState(key);
      
      // 成功トースト表示
      showToast.success('メッセージの再送信が完了しました', {
        duration: 3000
      });
      
      // テレメトリ記録
      if (window.gtag) {
        window.gtag('event', 'bot_message_retry_success', {
          event_category: 'retry_operations',
          attempt_count: currentAttempt,
          position_symbol: context.position.symbol
        });
      }
      
      return {
        success: true,
        attemptCount: currentAttempt
      };
    } else {
      // 部分失敗
      const error: ErrorDetail = {
        type: 'BOT_MESSAGE_FAILED',
        uiType: 'toast',
        severity: 'medium',
        message: 'メッセージ送信の一部が失敗しました',
        retryable: true,
        maxRetries,
        context: {
          operation: 'bot_message_retry',
          attempt: currentAttempt,
          user_success: result.userMessageResult.success,
          system_success: result.systemMessageResult.success
        }
      };
      
      return {
        success: false,
        error,
        attemptCount: currentAttempt
      };
    }
  } catch (error) {
    console.error(`Bot message retry failed (attempt ${currentAttempt}):`, error);
    
    const errorDetail: ErrorDetail = {
      type: 'BOT_MESSAGE_FAILED',
      uiType: 'toast',
      severity: 'medium',
      message: 'メッセージの再送信に失敗しました',
      technicalMessage: error instanceof Error ? error.message : String(error),
      retryable: currentAttempt < maxRetries,
      maxRetries,
      context: {
        operation: 'bot_message_retry',
        attempt: currentAttempt
      }
    };
    
    return {
      success: false,
      error: errorDetail,
      attemptCount: currentAttempt
    };
  } finally {
    // 進行中フラグをクリア
    updateRetryState(key, { inProgress: false });
  }
}

/**
 * AI分析再生成の再試行
 */
export async function retryAIRegeneration(
  context: RetryContext
): Promise<RetryResult> {
  const key = 'ai_regeneration';
  const maxRetries = 2;
  
  // 再試行可否チェック
  const checkResult = canRetry(key, maxRetries);
  if (!checkResult.canRetry) {
    return {
      success: false,
      error: {
        type: 'AI_REGENERATION_FAILED',
        uiType: 'toast',
        severity: 'low',
        message: checkResult.reason || '再生成できません',
        retryable: false
      } as ErrorDetail,
      attemptCount: retryStates.get(key)?.attemptCount || 0,
      skipReason: checkResult.reason
    };
  }
  
  // 再試行状態開始
  const currentAttempt = (retryStates.get(key)?.attemptCount || 0) + 1;
  updateRetryState(key, {
    inProgress: true,
    attemptCount: currentAttempt,
    lastAttempt: Date.now()
  });
  
  try {
    // 遅延適用
    if (currentAttempt > 1) {
      const delay = calculateRetryDelay(currentAttempt - 1, 2000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    // AI分析再生成実行
    const result = await regeneratePositionAnalysis(
      context.chatId,
      context.position
    );
    
    if (result.success) {
      // 成功：状態リセット
      resetRetryState(key);
      
      // 成功トースト表示
      showToast.success('AI分析の再生成が完了しました', {
        duration: 3000
      });
      
      // テレメトリ記録
      if (window.gtag) {
        window.gtag('event', 'ai_regeneration_retry_success', {
          event_category: 'retry_operations',
          attempt_count: currentAttempt,
          position_symbol: context.position.symbol,
          analysis_id: result.analysisId
        });
      }
      
      return {
        success: true,
        attemptCount: currentAttempt
      };
    } else {
      const errorDetail: ErrorDetail = {
        type: 'AI_REGENERATION_FAILED',
        uiType: 'toast',
        severity: 'low',
        message: result.error || 'AI分析の再生成に失敗しました',
        retryable: currentAttempt < maxRetries,
        maxRetries,
        context: {
          operation: 'ai_regeneration_retry',
          attempt: currentAttempt
        }
      };
      
      return {
        success: false,
        error: errorDetail,
        attemptCount: currentAttempt
      };
    }
  } catch (error) {
    console.error(`AI regeneration retry failed (attempt ${currentAttempt}):`, error);
    
    const errorDetail: ErrorDetail = {
      type: 'AI_REGENERATION_FAILED',
      uiType: 'toast',
      severity: 'low',
      message: 'AI分析の再生成に失敗しました',
      technicalMessage: error instanceof Error ? error.message : String(error),
      retryable: currentAttempt < maxRetries,
      maxRetries,
      context: {
        operation: 'ai_regeneration_retry',
        attempt: currentAttempt
      }
    };
    
    return {
      success: false,
      error: errorDetail,
      attemptCount: currentAttempt
    };
  } finally {
    // 進行中フラグをクリア
    updateRetryState(key, { inProgress: false });
  }
}

/**
 * 包括的な再試行処理（複数の失敗タイプ対応）
 */
export async function executeRetry(
  retryType: RetryType,
  context: RetryContext
): Promise<RetryResult> {
  // テレメトリ記録（試行開始）
  if (window.gtag) {
    window.gtag('event', 'entry_edit_retry_attempted', {
      event_category: 'retry_operations',
      retry_type: retryType,
      position_symbol: context.position.symbol
    });
  }
  
  try {
    switch (retryType) {
      case 'bot_messages':
      case 'bot_user_message':
      case 'bot_system_message':
        return await retryBotMessages(context);
        
      case 'ai_regeneration':
        return await retryAIRegeneration(context);
        
      case 'position_update':
        // Position更新の再試行は EditEntryModal で直接処理
        throw new Error('Position update retry should be handled in EditEntryModal');
        
      default:
        throw new Error(`Unsupported retry type: ${retryType}`);
    }
  } catch (error) {
    logError({
      type: 'UNKNOWN_ERROR',
      uiType: 'toast',
      severity: 'high',
      message: '再試行処理でエラーが発生しました',
      technicalMessage: error instanceof Error ? error.message : String(error),
      retryable: false,
      context: {
        operation: `retry_${retryType}`,
        position_symbol: context.position.symbol
      }
    }, `Retry execution failed: ${retryType}`);
    
    return {
      success: false,
      error: {
        type: 'UNKNOWN_ERROR',
        uiType: 'toast',
        severity: 'high',
        message: '再試行処理でエラーが発生しました',
        technicalMessage: error instanceof Error ? error.message : String(error),
        retryable: false
      } as ErrorDetail,
      attemptCount: 0
    };
  }
}

/**
 * 重複防止付きトースト表示
 */
export function showRetryToast(
  errorDetail: ErrorDetail,
  context: RetryContext,
  retryType: RetryType
): string {
  const errorHash = generateErrorHash(errorDetail);
  
  // 重複チェック
  const existingState = retryStates.get(retryType);
  if (existingState?.errorHashes.has(errorHash)) {
    console.log('Duplicate error toast suppressed:', errorHash);
    return ''; // 重複のため表示しない
  }
  
  // ハッシュを記録
  updateRetryState(retryType, {
    errorHashes: new Set([...(existingState?.errorHashes || []), errorHash])
  });
  
  // 再試行アクション付きトースト作成
  const toast = createToastFromError(errorDetail, () => {
    return executeRetry(retryType, context);
  });
  
  // トースト表示
  return showToast.error(toast.message, {
    ...toast,
    actionButton: toast.actionButton
  });
}

/**
 * 全再試行状態のクリア（テスト用）
 */
export function clearAllRetryStates(): void {
  retryStates.clear();
}

/**
 * 再試行統計の取得（デバッグ用）
 */
export function getRetryStats(): Record<string, RetryState> {
  return Object.fromEntries(retryStates.entries());
}

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

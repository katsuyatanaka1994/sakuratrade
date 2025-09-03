/**
 * エラーハンドリング・メッセージ管理システム
 * i18n対応とユーザー向けエラーメッセージ変換
 */

// エラー種別の定義
export type ErrorType = 
  | 'PATCH_FAILED'
  | 'PATCH_CONFLICT_409'
  | 'PATCH_NETWORK_ERROR'
  | 'BOT_MESSAGE_FAILED'
  | 'AI_REGENERATION_FAILED'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

// UI表示種別の定義
export type ErrorUIType = 
  | 'modal-banner'
  | 'modal-banner-conflict'
  | 'toast'
  | 'inline';

// エラー重要度レベル
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// エラー詳細情報
export interface ErrorDetail {
  type: ErrorType;
  uiType: ErrorUIType;
  severity: ErrorSeverity;
  message: string;
  technicalMessage?: string;
  retryable: boolean;
  autoRetry?: boolean;
  maxRetries?: number;
  context?: Record<string, any>;
}

/**
 * i18n対応エラーメッセージ
 * 本来は外部ファイルまたはi18nライブラリから読み込み
 */
const ERROR_MESSAGES: Record<string, string> = {
  // PATCH関連エラー
  'patch_failed_generic': 'エントリーの保存に失敗しました。もう一度お試しください。',
  'patch_failed_validation': '入力内容に問題があります。内容をご確認ください。',
  'patch_failed_network': 'ネットワークエラーが発生しました。接続をご確認ください。',
  'patch_failed_server': 'サーバーエラーが発生しました。しばらくしてから再度お試しください。',
  'patch_conflict_409': '他のユーザーによってこのポジションが更新されています。最新情報を取得してから再度編集してください。',
  
  // Bot関連エラー
  'bot_message_failed': 'メッセージの送信に失敗しました。',
  'bot_user_message_failed': '更新通知の送信に失敗しました。',
  'bot_system_message_failed': '取引プランの送信に失敗しました。',
  
  // AI関連エラー
  'ai_regeneration_failed': 'AI分析の生成に失敗しました。',
  'ai_no_image': 'チャート画像が見つからないため、AI分析をスキップしました。',
  'ai_service_unavailable': 'AI分析サービスが一時的に利用できません。',
  
  // 一般的なエラー
  'network_error': 'ネットワーク接続に問題があります。',
  'unknown_error': '予期しないエラーが発生しました。',
  'validation_error': '入力内容を確認してください。',
  
  // 成功メッセージ
  'retry_success': '再試行が完了しました。',
  'bot_retry_success': 'メッセージの再送信が完了しました。',
  'ai_retry_success': 'AI分析の再生成が完了しました。'
};

/**
 * エラー種別とUI種別のマッピング
 */
const ERROR_UI_MAPPING: Record<ErrorType, ErrorUIType> = {
  'PATCH_FAILED': 'modal-banner',
  'PATCH_CONFLICT_409': 'modal-banner-conflict',
  'PATCH_NETWORK_ERROR': 'modal-banner',
  'BOT_MESSAGE_FAILED': 'toast',
  'AI_REGENERATION_FAILED': 'toast',
  'VALIDATION_ERROR': 'modal-banner',
  'UNKNOWN_ERROR': 'modal-banner'
};

/**
 * エラーの重要度マッピング
 */
const ERROR_SEVERITY_MAPPING: Record<ErrorType, ErrorSeverity> = {
  'PATCH_FAILED': 'high',
  'PATCH_CONFLICT_409': 'medium',
  'PATCH_NETWORK_ERROR': 'high',
  'BOT_MESSAGE_FAILED': 'medium',
  'AI_REGENERATION_FAILED': 'low',
  'VALIDATION_ERROR': 'high',
  'UNKNOWN_ERROR': 'critical'
};

/**
 * エラーの再試行可否マッピング
 */
const ERROR_RETRY_MAPPING: Record<ErrorType, { retryable: boolean; maxRetries?: number; autoRetry?: boolean }> = {
  'PATCH_FAILED': { retryable: true, maxRetries: 3 },
  'PATCH_CONFLICT_409': { retryable: true, maxRetries: 1 },
  'PATCH_NETWORK_ERROR': { retryable: true, maxRetries: 3, autoRetry: false },
  'BOT_MESSAGE_FAILED': { retryable: true, maxRetries: 2 },
  'AI_REGENERATION_FAILED': { retryable: true, maxRetries: 2 },
  'VALIDATION_ERROR': { retryable: false },
  'UNKNOWN_ERROR': { retryable: true, maxRetries: 1 }
};

/**
 * エラーを分類してErrorDetailを生成
 */
export function classifyError(
  error: Error | any,
  context: {
    operation: string;
    statusCode?: number;
    originalError?: any;
  }
): ErrorDetail {
  let errorType: ErrorType = 'UNKNOWN_ERROR';
  let messageKey = 'unknown_error';

  // HTTPステータスコードによる分類
  if (context.statusCode) {
    if (context.statusCode === 409) {
      errorType = 'PATCH_CONFLICT_409';
      messageKey = 'patch_conflict_409';
    } else if (context.statusCode >= 400 && context.statusCode < 500) {
      if (context.statusCode === 422) {
        errorType = 'VALIDATION_ERROR';
        messageKey = 'validation_error';
      } else {
        errorType = 'PATCH_FAILED';
        messageKey = 'patch_failed_generic';
      }
    } else if (context.statusCode >= 500) {
      errorType = 'PATCH_FAILED';
      messageKey = 'patch_failed_server';
    }
  }
  
  // 操作種別による分類
  else if (context.operation.includes('position')) {
    if (error.message?.includes('network') || error.name === 'TypeError') {
      errorType = 'PATCH_NETWORK_ERROR';
      messageKey = 'patch_failed_network';
    } else {
      errorType = 'PATCH_FAILED';
      messageKey = 'patch_failed_generic';
    }
  } else if (context.operation.includes('bot')) {
    errorType = 'BOT_MESSAGE_FAILED';
    messageKey = context.operation.includes('user') ? 'bot_user_message_failed' : 'bot_system_message_failed';
  } else if (context.operation.includes('ai')) {
    errorType = 'AI_REGENERATION_FAILED';
    if (error.message?.includes('no image')) {
      messageKey = 'ai_no_image';
    } else if (error.message?.includes('service unavailable')) {
      messageKey = 'ai_service_unavailable';
    } else {
      messageKey = 'ai_regeneration_failed';
    }
  }

  // エラー詳細の構築
  const retryConfig = ERROR_RETRY_MAPPING[errorType];
  
  return {
    type: errorType,
    uiType: ERROR_UI_MAPPING[errorType],
    severity: ERROR_SEVERITY_MAPPING[errorType],
    message: ERROR_MESSAGES[messageKey] || ERROR_MESSAGES['unknown_error'],
    technicalMessage: error.message || String(error),
    retryable: retryConfig.retryable,
    autoRetry: retryConfig.autoRetry,
    maxRetries: retryConfig.maxRetries,
    context: {
      operation: context.operation,
      statusCode: context.statusCode,
      timestamp: new Date().toISOString(),
      ...context
    }
  };
}

/**
 * エラーメッセージを取得（i18n対応）
 */
export function getErrorMessage(
  key: string,
  fallback?: string,
  interpolations?: Record<string, string>
): string {
  let message = ERROR_MESSAGES[key] || fallback || ERROR_MESSAGES['unknown_error'];
  
  // 簡単な文字列置換（本格的なi18nライブラリならより高機能）
  if (interpolations) {
    Object.entries(interpolations).forEach(([key, value]) => {
      message = message.replace(`{${key}}`, value);
    });
  }
  
  return message;
}

/**
 * ユーザー向けエラーメッセージの生成
 * 技術的な詳細を隠し、アクション可能な情報を提供
 */
export function generateUserFriendlyMessage(errorDetail: ErrorDetail): string {
  const baseMessage = errorDetail.message;
  
  // 再試行可能な場合のガイダンス追加
  if (errorDetail.retryable) {
    return `${baseMessage} 再試行してください。`;
  }
  
  // 409エラーの場合は専用ガイダンス
  if (errorDetail.type === 'PATCH_CONFLICT_409') {
    return `${baseMessage}`;
  }
  
  return baseMessage;
}

/**
 * エラー詳細の個人情報マスク処理
 * Sentry等への送信前に機密情報を除去
 */
export function sanitizeErrorForReporting(errorDetail: ErrorDetail): {
  type: ErrorType;
  message: string;
  severity: ErrorSeverity;
  context: Record<string, any>;
} {
  const sanitizedContext = { ...errorDetail.context };
  
  // 個人情報関連キーを削除
  const personalInfoKeys = ['userId', 'chatId', 'email', 'phone', 'address'];
  personalInfoKeys.forEach(key => {
    if (sanitizedContext[key]) {
      delete sanitizedContext[key];
    }
  });
  
  // URLに含まれる可能性のあるIDをマスク
  if (sanitizedContext.url) {
    sanitizedContext.url = sanitizedContext.url.replace(/\/[a-f0-9-]{36}\//g, '/****/');
  }
  
  return {
    type: errorDetail.type,
    message: errorDetail.technicalMessage || errorDetail.message,
    severity: errorDetail.severity,
    context: sanitizedContext
  };
}

/**
 * エラー発生回数の追跡（メモリベース、本格実装ではRedis等使用）
 */
const errorCountMap = new Map<string, number>();

export function incrementErrorCount(key: string): number {
  const current = errorCountMap.get(key) || 0;
  const newCount = current + 1;
  errorCountMap.set(key, newCount);
  return newCount;
}

export function getErrorCount(key: string): number {
  return errorCountMap.get(key) || 0;
}

export function resetErrorCount(key: string): void {
  errorCountMap.delete(key);
}

/**
 * エラーのハッシュ値生成（重複検知用）
 */
export function generateErrorHash(errorDetail: ErrorDetail): string {
  const hashInput = `${errorDetail.type}-${errorDetail.context?.operation}-${errorDetail.context?.statusCode}`;
  // 簡易ハッシュ（本格実装ではcrypto使用）
  return btoa(hashInput).slice(0, 8);
}

/**
 * 再試行間隔の計算（指数バックオフ）
 */
export function calculateRetryDelay(attemptNumber: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attemptNumber - 1), 10000); // 最大10秒
}

/**
 * エラーログ出力（開発環境での詳細ログ）
 */
export function logError(errorDetail: ErrorDetail, context?: string): void {
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Error [${errorDetail.type}] ${context || ''}`);
    console.error('Message:', errorDetail.message);
    console.error('Technical:', errorDetail.technicalMessage);
    console.error('Severity:', errorDetail.severity);
    console.error('Context:', errorDetail.context);
    console.groupEnd();
  }
}
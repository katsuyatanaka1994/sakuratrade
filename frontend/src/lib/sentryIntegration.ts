/**
 * Sentry統合・エラー送信システム
 * 個人情報マスク処理付きエラー報告
 */

import {
  ErrorDetail,
  sanitizeErrorForReporting,
  generateErrorHash,
  incrementErrorCount
} from './errorHandling';
import { getEnvironmentName, isDevelopmentEnv } from './env';

// Sentryの簡易インターフェース（実際のSentryライブラリ使用時は置換）
interface SentryLike {
  captureException(error: Error, context?: any): string;
  captureMessage(message: string, level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug', context?: any): string;
  setContext(key: string, context: any): void;
  setTag(key: string, value: string): void;
  setUser(user: { id?: string; username?: string; email?: string }): void;
  addBreadcrumb(breadcrumb: { message: string; category?: string; level?: string; data?: any }): void;
  configureScope(callback: (scope: any) => void): void;
}

// モック実装（実環境では実際のSentryを使用）
const IS_DEV = isDevelopmentEnv();
const ENVIRONMENT = getEnvironmentName();

const MockSentry: SentryLike = {
  captureException: (error: Error, context?: any) => {
    if (IS_DEV) {
      console.error('[Sentry Mock] Exception:', error, context);
    }
    return `mock-${Date.now()}`;
  },
  captureMessage: (message: string, level?: string, context?: any) => {
    if (IS_DEV) {
      console.warn(`[Sentry Mock] ${level?.toUpperCase()}: ${message}`, context);
    }
    return `mock-msg-${Date.now()}`;
  },
  setContext: (key: string, context: any) => {
    if (IS_DEV) {
      console.log(`[Sentry Mock] Context [${key}]:`, context);
    }
  },
  setTag: (key: string, value: string) => {
    if (IS_DEV) {
      console.log(`[Sentry Mock] Tag: ${key} = ${value}`);
    }
  },
  setUser: (user: any) => {
    if (IS_DEV) {
      console.log('[Sentry Mock] User:', user);
    }
  },
  addBreadcrumb: (breadcrumb: any) => {
    if (IS_DEV) {
      console.log('[Sentry Mock] Breadcrumb:', breadcrumb);
    }
  },
  configureScope: (callback: (scope: any) => void) => {
    // Mock scope
    const mockScope = {
      setTag: MockSentry.setTag,
      setContext: MockSentry.setContext,
      setUser: MockSentry.setUser
    };
    callback(mockScope);
  }
};

// 実際のSentryインスタンス（実環境では @sentry/browser から import）
const Sentry: SentryLike = (window as any).Sentry || MockSentry;

// エラー送信の設定
interface ErrorReportingConfig {
  enableReporting: boolean;
  environment: string;
  release?: string;
  sampleRate: number;
  beforeSend?: (event: any) => any | null;
}

const defaultConfig: ErrorReportingConfig = {
  enableReporting: ENVIRONMENT === 'production',
  environment: ENVIRONMENT || 'development',
  sampleRate: 1.0,
  beforeSend: (event) => {
    // 開発環境では送信しない
    if (event.environment === 'development') {
      return null;
    }
    return event;
  }
};

let currentConfig = { ...defaultConfig };

/**
 * Sentry設定の初期化
 */
export function initializeSentry(config: Partial<ErrorReportingConfig> = {}): void {
  currentConfig = { ...defaultConfig, ...config };
  
  if (currentConfig.enableReporting) {
    // 実際のSentry初期化はここで行う
    // Sentry.init({ ... })
    console.log('Sentry initialized with config:', currentConfig);
  }
}

/**
 * エラー詳細のSentry送信
 */
export function reportErrorToSentry(
  errorDetail: ErrorDetail,
  additionalContext: Record<string, any> = {}
): string | null {
  if (!currentConfig.enableReporting) {
    return null;
  }
  
  try {
    // 個人情報マスク処理
    const sanitized = sanitizeErrorForReporting(errorDetail);
    
    // エラーハッシュ生成（重複検知用）
    const errorHash = generateErrorHash(errorDetail);
    
    // 発生回数記録
    const occurrenceCount = incrementErrorCount(errorHash);
    
    // サンプリング判定（高頻度エラーの送信制御）
    if (occurrenceCount > 5 && Math.random() > 0.1) {
      console.log(`High-frequency error suppressed: ${errorHash}`);
      return null;
    }
    
    // Sentryコンテキスト設定
    Sentry.configureScope((scope) => {
      // タグ設定
      scope.setTag('error_type', sanitized.type);
      scope.setTag('error_severity', sanitized.severity);
      scope.setTag('ui_type', errorDetail.uiType);
      scope.setTag('error_hash', errorHash);
      
      // コンテキスト設定
      scope.setContext('error_detail', {
        type: sanitized.type,
        severity: sanitized.severity,
        retryable: errorDetail.retryable,
        occurrence_count: occurrenceCount,
        ...sanitized.context,
        ...additionalContext
      });
      
      // ユーザー情報（個人情報なし）
      scope.setUser({
        id: 'anonymous', // 実際のユーザーIDは送信しない
        // その他の非個人情報があれば追加
      });
    });
    
    // エラーレベルの判定
    const sentryLevel = getSentryLevel(errorDetail.severity);
    
    // エラー送信
    let sentryId: string;
    
    if (errorDetail.technicalMessage) {
      // 実際のエラーオブジェクトがある場合
      const error = new Error(sanitized.message);
      error.name = sanitized.type;
      error.stack = errorDetail.technicalMessage;
      
      sentryId = Sentry.captureException(error, {
        level: sentryLevel,
        fingerprint: [errorHash],
        extra: {
          user_message: errorDetail.message,
          technical_message: sanitized.message,
          context: sanitized.context
        }
      });
    } else {
      // メッセージのみの場合
      sentryId = Sentry.captureMessage(sanitized.message, sentryLevel, {
        fingerprint: [errorHash],
        extra: {
          error_type: sanitized.type,
          context: sanitized.context
        }
      });
    }
    
    // パンくず追加
    Sentry.addBreadcrumb({
      message: `Error reported: ${sanitized.type}`,
      category: 'error_handling',
      level: sentryLevel,
      data: {
        error_hash: errorHash,
        sentry_id: sentryId
      }
    });
    
    // テレメトリ記録
    if (window.gtag) {
      window.gtag('event', 'error_reported_to_sentry', {
        event_category: 'error_tracking',
        error_type: sanitized.type,
        error_severity: sanitized.severity,
        sentry_id: sentryId,
        occurrence_count: occurrenceCount
      });
    }
    
    return sentryId;
    
  } catch (sentryError) {
    console.error('Failed to report error to Sentry:', sentryError);
    return null;
  }
}

/**
 * エラー重要度からSentryレベルへの変換
 */
function getSentryLevel(severity: string): 'fatal' | 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'critical':
      return 'fatal';
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    default:
      return 'info';
  }
}

/**
 * ユーザー操作のパンくず追加
 */
export function addUserActionBreadcrumb(
  action: string,
  data: Record<string, any> = {}
): void {
  if (!currentConfig.enableReporting) return;
  
  // 個人情報を除外したデータ
  const sanitizedData = { ...data };
  delete sanitizedData.userId;
  delete sanitizedData.chatId;
  delete sanitizedData.email;
  
  Sentry.addBreadcrumb({
    message: `User action: ${action}`,
    category: 'user_interaction',
    level: 'info',
    data: sanitizedData
  });
}

/**
 * API呼び出しのパンくず追加
 */
export function addAPICallBreadcrumb(
  method: string,
  url: string,
  statusCode?: number,
  responseTime?: number
): void {
  if (!currentConfig.enableReporting) return;
  
  // URLから個人情報を除去
  const sanitizedUrl = url.replace(/\/[a-f0-9-]{36}\//g, '/***/');
  
  Sentry.addBreadcrumb({
    message: `API ${method} ${sanitizedUrl}`,
    category: 'api_request',
    level: statusCode && statusCode >= 400 ? 'warning' : 'info',
    data: {
      method,
      url: sanitizedUrl,
      status_code: statusCode,
      response_time: responseTime
    }
  });
}

/**
 * Position関連操作のパンくず追加
 */
export function addPositionOperationBreadcrumb(
  operation: string,
  positionSymbol: string,
  data: Record<string, any> = {}
): void {
  if (!currentConfig.enableReporting) return;
  
  Sentry.addBreadcrumb({
    message: `Position ${operation}`,
    category: 'position_management',
    level: 'info',
    data: {
      operation,
      symbol: positionSymbol, // 銘柄コードは個人情報ではない
      ...data
    }
  });
}

/**
 * エラー送信統計の取得（デバッグ用）
 */
export function getErrorReportingStats(): {
  config: ErrorReportingConfig;
  totalErrors: number;
  errorsByType: Record<string, number>;
} {
  // 実際の実装では内部統計を返す
  return {
    config: currentConfig,
    totalErrors: 0, // モック値
    errorsByType: {} // モック値
  };
}

/**
 * エラー送信のテスト（開発用）
 */
export function testErrorReporting(): void {
  if (IS_DEV) {
    const testError: ErrorDetail = {
      type: 'UNKNOWN_ERROR',
      uiType: 'toast',
      severity: 'medium',
      message: 'This is a test error for Sentry integration',
      technicalMessage: 'Test error message',
      retryable: false,
      context: {
        operation: 'sentry_test',
        timestamp: new Date().toISOString()
      }
    };
    
    const sentryId = reportErrorToSentry(testError, {
      test_mode: true
    });
    
    console.log('Test error reported to Sentry:', sentryId);
  }
}

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

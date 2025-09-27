/**
 * テレメトリシステム - イベント計測・送信
 * PII除外、ノンブロッキング送信、受け入れ基準対応
 */

import type { Position } from '../store/positions';
import { isDevelopmentEnv, resolveTelemetryEndpoint } from './env';

// テレメトリイベント名の定義
export type TelemetryEvent = 
  | 'position_menu_opened'      // メニュー表示時
  | 'entry_edit_opened'         // モーダル表示時  
  | 'entry_edit_saved'          // PATCH成功
  | 'plan_bot_sent'             // Bot②送信時
  | 'ai_reply_regenerated'      // AI再生成成功時
  | 'entry_edit_conflict_409';  // 409発生時

// 共通ペイロード（PII除外済み）
export interface TelemetryPayload {
  positionId: string;    // ハッシュ化済みID
  ownerId: string;       // ハッシュ化済みID
  status: 'OPEN' | 'CLOSED';
  side: 'LONG' | 'SHORT';
  price: number;
  qty: number;
  version: number;
  ts: number;           // Unix timestamp
}

// イベント別の追加データ
export interface TelemetryEventData {
  position_menu_opened: {
    menuType: 'context' | 'button';
    positionCount: number;
  };
  entry_edit_opened: {
    trigger: 'menu' | 'shortcut';
    hasExistingData: boolean;
  };
  entry_edit_saved: {
    changeFields: string[];  // 変更されたフィールド名
    validationErrors: number;
    retryCount: number;
  };
  plan_bot_sent: {
    messageType: 'user' | 'system' | 'both';
    planComplexity: 'simple' | 'complex';
  };
  ai_reply_regenerated: {
    regenerationReason: 'failure' | 'manual' | 'timeout';
    analysisId: string;
  };
  entry_edit_conflict_409: {
    conflictFields: string[];
    versionDiff: number;
    resolutionAction: 'refresh' | 'force' | 'cancel';
  };
}

// テレメトリ設定
interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushInterval: number;
  debug: boolean;
}

const defaultConfig: TelemetryConfig = {
  enabled: true,
  endpoint: resolveTelemetryEndpoint('/api/telemetry'),
  batchSize: 10,
  flushInterval: 5000, // 5秒
  debug: isDevelopmentEnv()
};

let currentConfig = { ...defaultConfig };

// イベントバッファ（バッチ送信用）
const eventBuffer: Array<{
  event: TelemetryEvent;
  payload: TelemetryPayload;
  additionalData: any;
  timestamp: number;
}> = [];

// 送信タイマー
let flushTimer: NodeJS.Timeout | null = null;

/**
 * テレメトリ設定の初期化
 */
export function initializeTelemetry(config: Partial<TelemetryConfig> = {}): void {
  currentConfig = { ...defaultConfig, ...config };
  
  if (currentConfig.debug) {
    console.log('Telemetry initialized with config:', currentConfig);
  }
  
  // 定期フラッシュタイマーの設定
  if (flushTimer) {
    clearInterval(flushTimer);
  }
  
  flushTimer = setInterval(() => {
    if (eventBuffer.length > 0) {
      flushEvents();
    }
  }, currentConfig.flushInterval);
}

/**
 * Positionデータから共通ペイロード生成（PII除外）
 */
export function createTelemetryPayload(position: Position): TelemetryPayload {
  return {
    positionId: hashId(position.id || `${position.symbol}:${position.side}:${position.chatId || 'default'}`),
    ownerId: hashId(position.ownerId || 'unknown'),
    status: position.status,
    side: position.side,
    price: Math.round(position.avgPrice * 100) / 100, // 小数点2桁に丸め
    qty: Math.round(position.qtyTotal * 100) / 100,
    version: position.version || 1,
    ts: Date.now()
  };
}

/**
 * テレメトリイベントの送信
 */
export function trackEvent<T extends TelemetryEvent>(
  event: T,
  position: Position,
  additionalData: TelemetryEventData[T] = {} as TelemetryEventData[T]
): void {
  if (!currentConfig.enabled) {
    return;
  }
  
  try {
    const payload = createTelemetryPayload(position);
    
    // イベントをバッファに追加
    eventBuffer.push({
      event,
      payload,
      additionalData,
      timestamp: Date.now()
    });
    
    // デバッグログ
    if (currentConfig.debug) {
      console.log(`[Telemetry] ${event}:`, { payload, additionalData });
    }
    
    // バッファサイズが上限に達した場合は即座にフラッシュ
    if (eventBuffer.length >= currentConfig.batchSize) {
      flushEvents();
    }
    
    // gtag統合（既存システムとの互換性）
    if (window.gtag) {
      window.gtag('event', event, {
        event_category: 'position_management',
        event_label: position.symbol,
        custom_map: {
          position_side: payload.side,
          position_status: payload.status,
          ...additionalData
        }
      });
    }
    
  } catch (error) {
    if (currentConfig.debug) {
      console.error('Failed to track event:', event, error);
    }
  }
}

/**
 * 特定イベントの追跡用ヘルパー関数
 */
export const telemetryHelpers = {
  // メニュー表示時
  trackMenuOpened: (position: Position, menuType: 'context' | 'button', positionCount: number) => {
    trackEvent('position_menu_opened', position, { menuType, positionCount });
  },
  
  // モーダル表示時
  trackEditOpened: (position: Position, trigger: 'menu' | 'shortcut', hasExistingData: boolean) => {
    trackEvent('entry_edit_opened', position, { trigger, hasExistingData });
  },
  
  // PATCH成功時
  trackEditSaved: (position: Position, changeFields: string[], validationErrors: number, retryCount: number = 0) => {
    trackEvent('entry_edit_saved', position, { changeFields, validationErrors, retryCount });
  },
  
  // Bot送信時
  trackBotSent: (position: Position, messageType: 'user' | 'system' | 'both', planComplexity: 'simple' | 'complex') => {
    trackEvent('plan_bot_sent', position, { messageType, planComplexity });
  },
  
  // AI再生成成功時
  trackAIRegenerated: (position: Position, regenerationReason: 'failure' | 'manual' | 'timeout', analysisId: string) => {
    trackEvent('ai_reply_regenerated', position, { regenerationReason, analysisId });
  },
  
  // 409エラー発生時
  trackConflict409: (position: Position, conflictFields: string[], versionDiff: number, resolutionAction: 'refresh' | 'force' | 'cancel') => {
    trackEvent('entry_edit_conflict_409', position, { conflictFields, versionDiff, resolutionAction });
  }
};

/**
 * イベントバッファのフラッシュ（送信）
 */
async function flushEvents(): Promise<void> {
  if (eventBuffer.length === 0) {
    return;
  }
  
  const eventsToSend = [...eventBuffer];
  eventBuffer.length = 0; // バッファをクリア
  
  try {
    // ノンブロッキング送信（awaitしない）
    sendEvents(eventsToSend).catch(error => {
      if (currentConfig.debug) {
        console.error('Failed to send telemetry events:', error);
      }
      
      // 送信失敗時は一部のイベントをバッファに戻す（最新のもののみ）
      const recentEvents = eventsToSend.slice(-5);
      eventBuffer.push(...recentEvents);
    });
    
  } catch (error) {
    if (currentConfig.debug) {
      console.error('Error during telemetry flush:', error);
    }
  }
}

/**
 * イベントの実際の送信処理
 */
async function sendEvents(events: typeof eventBuffer): Promise<void> {
  const response = await fetch(currentConfig.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      events,
      metadata: {
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        sessionId: getSessionId(),
        batchId: generateBatchId()
      }
    })
  });
  
  if (!response.ok) {
    throw new Error(`Telemetry send failed: ${response.status}`);
  }
  
  if (currentConfig.debug) {
    console.log(`[Telemetry] Sent ${events.length} events successfully`);
  }
}

/**
 * ID のハッシュ化（PII除外用）
 */
function hashId(id: string): string {
  // 簡易ハッシュ関数（本格実装ではcrypto.subtle.digestを使用）
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit整数に変換
  }
  return Math.abs(hash).toString(16);
}

/**
 * セッションIDの生成・取得
 */
function getSessionId(): string {
  const stored = sessionStorage.getItem('telemetry_session_id');
  if (stored) {
    return stored;
  }
  
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('telemetry_session_id', sessionId);
  return sessionId;
}

/**
 * バッチIDの生成
 */
function generateBatchId(): string {
  return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

/**
 * テレメトリの統計取得（デバッグ用）
 */
export function getTelemetryStats(): {
  config: TelemetryConfig;
  bufferSize: number;
  sessionId: string;
} {
  return {
    config: currentConfig,
    bufferSize: eventBuffer.length,
    sessionId: getSessionId()
  };
}

/**
 * 手動フラッシュ（テスト用）
 */
export function flushTelemetryEvents(): Promise<void> {
  return flushEvents();
}

/**
 * テレメトリのクリーンアップ
 */
export function shutdownTelemetry(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  
  // 残りのイベントを送信
  if (eventBuffer.length > 0) {
    flushEvents();
  }
}

// ページ離脱時の自動クリーンアップ
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    shutdownTelemetry();
  });
}

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

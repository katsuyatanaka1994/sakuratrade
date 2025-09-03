import type { Position, Side } from '../store/positions';
import { PositionUpdateDiff, formatPrice, formatQty } from '../utils/positionCalculations';
import { telemetryHelpers } from './telemetry';

/**
 * Bot投稿の種類
 */
export type BotMessageType = 'user_update' | 'system_plan';

/**
 * Bot投稿結果
 */
export interface BotMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Bot投稿設定
 */
export interface BotMessageConfig {
  chatId: string;
  messageType: BotMessageType;
  content: string;
  metadata?: Record<string, any>;
}

/**
 * ユーザー側Bot投稿内容生成
 * 📈 建値を更新しました！
 */
export function generateUserUpdateMessage(
  position: Position,
  updateDiff: PositionUpdateDiff
): string {
  const { symbol, name = '' } = position;
  const symbolDisplay = name ? `${symbol} ${name}` : symbol;
  
  let message = `📈 建値を更新しました！\n\n`;
  message += `**銘柄:** ${symbolDisplay}\n`;
  message += `**ポジション:** ${position.side}\n\n`;
  
  // 変更内容を詳細表示
  if (updateDiff.sideChanged) {
    message += `**ポジションタイプ変更:** ${updateDiff.oldSide} → ${updateDiff.newSide}\n`;
  }
  
  if (updateDiff.priceChanged) {
    message += `**建値変更:** ${formatPrice(updateDiff.oldPrice)} → ${formatPrice(updateDiff.newPrice)}\n`;
  }
  
  if (updateDiff.qtyChanged) {
    message += `**数量変更:** ${formatQty(updateDiff.oldQty)} → ${formatQty(updateDiff.newQty)}\n`;
  }
  
  message += `\n**更新時刻:** ${new Date().toLocaleString('ja-JP')}\n`;
  
  return message.trim();
}

/**
 * システム側Bot投稿内容生成
 * 📝 取引プラン設定
 */
export function generateSystemPlanMessage(
  position: Position,
  metrics: {
    stopLossTarget: number;
    profitTarget: number;
    riskRatio: number;
  }
): string {
  const { symbol, name = '', side, avgPrice, qtyTotal } = position;
  const symbolDisplay = name ? `${symbol} ${name}` : symbol;
  
  let message = `📝 **取引プラン設定**\n\n`;
  message += `**銘柄:** ${symbolDisplay}\n`;
  message += `**ポジション:** ${side}\n`;
  message += `**建値:** ${formatPrice(avgPrice)}\n`;
  message += `**数量:** ${formatQty(qtyTotal)}\n\n`;
  
  message += `**リスク管理:**\n`;
  message += `• 損切目標: ${formatPrice(metrics.stopLossTarget)}\n`;
  message += `• 利確目標: ${formatPrice(metrics.profitTarget)}\n`;
  message += `• リスク比率: 1:${metrics.riskRatio.toFixed(2)}\n\n`;
  
  // ポジション方向による推奨アクション
  if (side === 'LONG') {
    message += `**推奨アクション:**\n`;
    message += `• ${formatPrice(metrics.stopLossTarget)}を下回ったら損切検討\n`;
    message += `• ${formatPrice(metrics.profitTarget)}到達で利確検討\n`;
  } else {
    message += `**推奨アクション:**\n`;
    message += `• ${formatPrice(metrics.stopLossTarget)}を上回ったら損切検討\n`;
    message += `• ${formatPrice(metrics.profitTarget)}到達で利確検討\n`;
  }
  
  message += `\n⚠️ 投資は自己責任で行ってください`;
  
  return message.trim();
}

/**
 * 単一Bot投稿の送信
 */
export async function sendBotMessage(config: BotMessageConfig): Promise<BotMessageResult> {
  try {
    // Bot API未実装のため、現在はスキップして成功として扱う
    console.log('📝 Bot message (simulated):', {
      chatId: config.chatId,
      messageType: config.messageType,
      content: config.content,
      metadata: config.metadata || {}
    });
    
    // シミュレート用の遅延
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      messageId: `simulated-${Date.now()}`
    };
    
  } catch (error) {
    console.error('Failed to send bot message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Position更新成功時の2件Bot投稿処理
 * 順序保証: ①ユーザー側投稿 → ②システム側投稿
 */
export async function sendPositionUpdateMessages(
  chatId: string,
  position: Position,
  updateDiff: PositionUpdateDiff,
  positionMetrics: {
    stopLossTarget: number;
    profitTarget: number;
    riskRatio: number;
  }
): Promise<{
  userMessageResult: BotMessageResult;
  systemMessageResult: BotMessageResult;
  allSuccess: boolean;
}> {
  
  // ①ユーザー側投稿: 📈 建値を更新しました！
  const userMessage = generateUserUpdateMessage(position, updateDiff);
  const userMessageResult = await sendBotMessage({
    chatId,
    messageType: 'user_update',
    content: userMessage,
    metadata: {
      position_id: `${position.symbol}:${position.side}:${position.chatId}`,
      update_type: 'position_entry_update',
      timestamp: new Date().toISOString()
    }
  });
  
  // ②システム側投稿: 📝 取引プラン設定 (plan_bot_sent テレメトリ対象)
  const systemMessage = generateSystemPlanMessage(position, positionMetrics);
  const systemMessageResult = await sendBotMessage({
    chatId,
    messageType: 'system_plan',
    content: systemMessage,
    metadata: {
      position_id: `${position.symbol}:${position.side}:${position.chatId}`,
      plan_type: 'position_risk_management',
      risk_ratio: positionMetrics.riskRatio,
      stop_loss: positionMetrics.stopLossTarget,
      profit_target: positionMetrics.profitTarget,
      timestamp: new Date().toISOString()
    }
  });
  
  const allSuccess = userMessageResult.success && systemMessageResult.success;
  
  // テレメトリ記録: Bot投稿送信
  if (allSuccess) {
    const messageType: 'user' | 'system' | 'both' = 'both'; // 両方送信
    const planComplexity: 'simple' | 'complex' = 
      (systemMessage.length > 200 || systemMessage.includes('リスク')) ? 'complex' : 'simple';
    
    // TODO: テレメトリ記録: ボットメッセージ送信 (API未実装のため一時無効化)
    // telemetryHelpers.trackBotSent(position, messageType, planComplexity);
  }
  
  // シーケンスログ記録（AC検証用）
  if ((window as any).acTestContext) {
    (window as any).acTestContext.sequenceLog.push({
      action: 'bot_messages_sent',
      timestamp: Date.now(),
      success: allSuccess
    });
  }
  
  // 既存のgtag記録も維持 (システム投稿成功時のみ)
  if (systemMessageResult.success && window.gtag) {
    window.gtag('event', 'plan_bot_sent', {
      event_category: 'bot_messaging',
      position_id: `${position.symbol}:${position.side}:${position.chatId}`,
      message_id: systemMessageResult.messageId
    });
  }
  
  return {
    userMessageResult,
    systemMessageResult,
    allSuccess
  };
}

/**
 * Bot投稿の失敗をログ記録
 */
export function logBotMessageFailure(
  messageType: BotMessageType,
  error: string,
  context: Record<string, any> = {}
): void {
  console.error(`Bot message failed [${messageType}]:`, error, context);
  
  // テレメトリ記録 (失敗イベント)
  if (window.gtag) {
    window.gtag('event', 'bot_message_failed', {
      event_category: 'bot_messaging',
      message_type: messageType,
      error_message: error,
      ...context
    });
  }
}

/**
 * Bot投稿の成功をログ記録
 */
export function logBotMessageSuccess(
  messageType: BotMessageType,
  messageId: string,
  context: Record<string, any> = {}
): void {
  console.log(`Bot message sent successfully [${messageType}]:`, messageId, context);
  
  // ユーザー投稿成功のテレメトリ
  if (messageType === 'user_update' && window.gtag) {
    window.gtag('event', 'user_bot_sent', {
      event_category: 'bot_messaging',
      message_id: messageId,
      ...context
    });
  }
}

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
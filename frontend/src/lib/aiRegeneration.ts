import type { Position } from '../store/positions';
import { telemetryHelpers } from './telemetry';

/**
 * AI分析再生成の条件
 */
export interface AIRegenerationCondition {
  hasChartImage: boolean;
  imageSource: 'recent' | 'uploaded' | 'none';
  imageId?: string;
  imageUrl?: string;
}

/**
 * AI分析再生成結果
 */
export interface AIRegenerationResult {
  success: boolean;
  analysisId?: string;
  replacedMessageId?: string;
  error?: string;
  analysisContent?: string;
}

/**
 * AI分析再生成設定
 */
export interface AIRegenerationConfig {
  chatId: string;
  position: Position;
  condition: AIRegenerationCondition;
  replaceLastAI?: boolean; // 直前AI返信を置き換え (デフォルト: true)
  collapseReplaced?: boolean; // 置き換え前メッセージを折りたたみ (デフォルト: false)
}

/**
 * チャート画像の検索
 * 直近1枚または編集時アップロード画像を取得
 */
export async function findChartImage(
  chatId: string,
  positionSymbol: string
): Promise<AIRegenerationCondition> {
  try {
    const response = await fetch(`/api/chat/${chatId}/images/recent`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      return {
        hasChartImage: false,
        imageSource: 'none'
      };
    }
    
    const images = await response.json();
    
    // 直近のチャート画像を検索
    const recentImage = images.find((img: any) => 
      img.type === 'chart' || 
      img.filename?.toLowerCase().includes('chart') ||
      img.metadata?.symbol === positionSymbol
    );
    
    if (recentImage) {
      return {
        hasChartImage: true,
        imageSource: 'recent',
        imageId: recentImage.id,
        imageUrl: recentImage.url
      };
    }
    
    return {
      hasChartImage: false,
      imageSource: 'none'
    };
    
  } catch (error) {
    console.error('Failed to find chart image:', error);
    return {
      hasChartImage: false,
      imageSource: 'none'
    };
  }
}

/**
 * 直前のAI返信メッセージIDを取得
 */
export async function getLastAIMessageId(chatId: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/chat/${chatId}/messages/recent?type=ai&limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const messages = await response.json();
    return messages.length > 0 ? messages[0].id : null;
    
  } catch (error) {
    console.error('Failed to get last AI message:', error);
    return null;
  }
}

/**
 * AI分析プロンプト生成
 * Position更新を考慮した分析依頼
 */
export function generateAIAnalysisPrompt(
  position: Position,
  condition: AIRegenerationCondition
): string {
  const { symbol, name = '', side, avgPrice, qtyTotal } = position;
  const symbolDisplay = name ? `${symbol} ${name}` : symbol;
  
  let prompt = `建値更新に基づくエントリー分析をお願いします。\n\n`;
  prompt += `**更新情報:**\n`;
  prompt += `- 銘柄: ${symbolDisplay}\n`;
  prompt += `- ポジション: ${side}\n`;
  prompt += `- 建値: ¥${new Intl.NumberFormat('ja-JP').format(avgPrice)}\n`;
  prompt += `- 数量: ${new Intl.NumberFormat('ja-JP').format(qtyTotal)}株\n\n`;
  
  if (condition.hasChartImage) {
    prompt += `**分析観点:**\n`;
    prompt += `1. チャート画像からテクニカル分析\n`;
    prompt += `2. 現在の建値水準の妥当性\n`;
    prompt += `3. エントリー改善点の提案\n`;
    prompt += `4. リスク管理のアドバイス\n\n`;
  } else {
    prompt += `**分析観点:**\n`;
    prompt += `1. 建値水準の一般的評価\n`;
    prompt += `2. ${side}ポジションの注意点\n`;
    prompt += `3. リスク管理の推奨事項\n\n`;
  }
  
  prompt += `**回答形式:** 簡潔で実用的なアドバイス（300字以内）`;
  
  return prompt.trim();
}

/**
 * AI分析の実行
 * 直前AI返信を置き換え
 */
export async function executeAIRegeneration(
  config: AIRegenerationConfig
): Promise<AIRegenerationResult> {
  try {
    const { chatId, position, condition, replaceLastAI = true } = config;
    
    // 直前AI返信IDを取得 (置き換え対象)
    let replacedMessageId: string | null = null;
    if (replaceLastAI) {
      replacedMessageId = await getLastAIMessageId(chatId);
    }
    
    // AI分析プロンプト生成
    const prompt = generateAIAnalysisPrompt(position, condition);
    
    // AI分析API呼び出し
    const analysisPayload: any = {
      chat_id: chatId,
      prompt: prompt,
      context_type: 'position_update_analysis',
      position_metadata: {
        symbol: position.symbol,
        side: position.side,
        price: position.avgPrice,
        qty: position.qtyTotal,
        version: position.version
      }
    };
    
    // チャート画像がある場合は添付
    if (condition.hasChartImage && condition.imageId) {
      analysisPayload.image_id = condition.imageId;
      analysisPayload.image_url = condition.imageUrl;
    }
    
    // 置き換え対象がある場合
    if (replacedMessageId) {
      analysisPayload.replace_message_id = replacedMessageId;
      analysisPayload.collapse_replaced = config.collapseReplaced || false;
    }
    
    const response = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(analysisPayload)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `AI analysis failed: ${response.status}`);
    }
    
    const result = await response.json();
    
    // テレメトリ記録: AI再生成成功
    const regenerationReason: 'failure' | 'manual' | 'timeout' = 'manual'; // Position更新による手動再生成
    telemetryHelpers.trackAIRegenerated(position, regenerationReason, result.analysis_id);
    
    // シーケンスログ記録（AC検証用）
    if ((window as any).acTestContext) {
      (window as any).acTestContext.sequenceLog.push({
        action: 'ai_analysis_regenerated',
        timestamp: Date.now(),
        success: true
      });
    }
    
    // 既存のgtag記録も維持
    if (window.gtag) {
      window.gtag('event', 'ai_reply_regenerated', {
        event_category: 'ai_analysis',
        chat_id: chatId,
        position_symbol: position.symbol,
        analysis_id: result.analysis_id,
        has_chart_image: condition.hasChartImage,
        replaced_message: !!replacedMessageId
      });
    }
    
    return {
      success: true,
      analysisId: result.analysis_id,
      replacedMessageId: replacedMessageId || undefined,
      analysisContent: result.content
    };
    
  } catch (error) {
    console.error('AI regeneration failed:', error);
    
    // シーケンスログ記録（AC検証用）
    if ((window as any).acTestContext) {
      (window as any).acTestContext.sequenceLog.push({
        action: 'ai_analysis_regenerated',
        timestamp: Date.now(),
        success: false
      });
    }
    
    // 既存の失敗テレメトリ記録も維持
    if (window.gtag) {
      window.gtag('event', 'ai_regeneration_failed', {
        event_category: 'ai_analysis',
        chat_id: config.chatId,
        position_symbol: config.position.symbol,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        has_chart_image: config.condition.hasChartImage
      });
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Position更新後のAI分析再生成メイン処理
 * 画像有無で分岐、直前AI返信を置き換え
 */
export async function regeneratePositionAnalysis(
  chatId: string,
  position: Position
): Promise<AIRegenerationResult> {
  
  // 1. チャート画像の存在確認
  const condition = await findChartImage(chatId, position.symbol);
  
  // 2. 画像がない場合はスキップ
  if (!condition.hasChartImage) {
    console.log('No chart image found, skipping AI regeneration');
    return {
      success: false,
      error: 'No chart image available for analysis'
    };
  }
  
  // 3. AI分析実行 (直前AI返信を置き換え)
  const config: AIRegenerationConfig = {
    chatId,
    position,
    condition,
    replaceLastAI: true,
    collapseReplaced: false // 折りたたみなし
  };
  
  return await executeAIRegeneration(config);
}

/**
 * AI再生成失敗の処理
 * 次プロンプトに委譲するためのエラー情報保存
 */
export function handleAIRegenerationFailure(
  chatId: string,
  position: Position,
  error: string
): void {
  console.warn(`AI regeneration failed for ${position.symbol}:`, error);
  
  // 失敗情報をローカルストレージに保存 (次プロンプトでの処理用)
  const failureInfo = {
    chatId,
    positionSymbol: position.symbol,
    failureReason: error,
    timestamp: new Date().toISOString(),
    retryRecommended: true
  };
  
  const existingFailures = JSON.parse(
    localStorage.getItem('ai_regeneration_failures') || '[]'
  );
  
  existingFailures.push(failureInfo);
  
  // 最新10件のみ保持
  if (existingFailures.length > 10) {
    existingFailures.splice(0, existingFailures.length - 10);
  }
  
  localStorage.setItem('ai_regeneration_failures', JSON.stringify(existingFailures));
}

// Global gtag types
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
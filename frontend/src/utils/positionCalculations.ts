import type { Position, Side } from '../store/positions';

/**
 * Position派生値計算結果
 */
export interface PositionMetrics {
  unrealizedPnl: number;      // 含み損益 (円)
  unrealizedPnlPercent: number; // 含み損益率 (%)
  stopLossTarget: number;     // 損切目標価格
  profitTarget: number;       // 利確目標価格
  riskRatio: number;          // リスク比率 (損失:利益)
  totalValue: number;         // 総評価額
  breakEvenPrice: number;     // 損益分岐点
}

/**
 * Position更新時の差分情報
 */
export interface PositionUpdateDiff {
  priceChanged: boolean;
  qtyChanged: boolean;
  sideChanged: boolean;
  oldPrice: number;
  oldQty: number;
  oldSide: Side;
  newPrice: number;
  newQty: number;
  newSide: Side;
}

/**
 * Positionの派生値を計算
 * 
 * @param position - 計算対象のPosition
 * @param currentPrice - 現在価格 (オプション、未指定時は含み損益は0)
 * @param riskSettings - リスク設定 (オプション)
 * @returns 計算結果のPositionMetrics
 */
export function calculatePositionMetrics(
  position: Position,
  currentPrice?: number,
  riskSettings?: {
    stopLossPercent?: number;  // 損切り率 (デフォルト: 5%)
    profitTargetPercent?: number; // 利確率 (デフォルト: 10%)
  }
): PositionMetrics {
  const { avgPrice, qtyTotal, side } = position;
  const settings = {
    stopLossPercent: 0.05,      // 5% loss
    profitTargetPercent: 0.10,  // 10% profit
    ...riskSettings
  };

  // 基本計算
  const totalValue = avgPrice * qtyTotal;
  const breakEvenPrice = avgPrice; // 平均建値が損益分岐点

  // 現在価格が提供されている場合の含み損益計算
  let unrealizedPnl = 0;
  let unrealizedPnlPercent = 0;
  
  if (currentPrice !== undefined) {
    if (side === 'LONG') {
      unrealizedPnl = (currentPrice - avgPrice) * qtyTotal;
    } else { // SHORT
      unrealizedPnl = (avgPrice - currentPrice) * qtyTotal;
    }
    unrealizedPnlPercent = (unrealizedPnl / totalValue) * 100;
  }

  // 損切・利確目標価格計算
  let stopLossTarget: number;
  let profitTarget: number;

  if (side === 'LONG') {
    stopLossTarget = avgPrice * (1 - settings.stopLossPercent);
    profitTarget = avgPrice * (1 + settings.profitTargetPercent);
  } else { // SHORT
    stopLossTarget = avgPrice * (1 + settings.stopLossPercent);
    profitTarget = avgPrice * (1 - settings.profitTargetPercent);
  }

  // リスク比率計算 (損失額:利益額)
  const potentialLoss = Math.abs(avgPrice - stopLossTarget) * qtyTotal;
  const potentialProfit = Math.abs(profitTarget - avgPrice) * qtyTotal;
  const riskRatio = potentialLoss / potentialProfit;

  return {
    unrealizedPnl,
    unrealizedPnlPercent,
    stopLossTarget,
    profitTarget,
    riskRatio,
    totalValue,
    breakEvenPrice
  };
}

/**
 * Position更新前後の差分を計算
 * 
 * @param oldPosition - 更新前のPosition
 * @param newPosition - 更新後のPosition
 * @returns 更新差分情報
 */
export function calculateUpdateDiff(
  oldPosition: Position,
  newPosition: Position
): PositionUpdateDiff {
  return {
    priceChanged: oldPosition.avgPrice !== newPosition.avgPrice,
    qtyChanged: oldPosition.qtyTotal !== newPosition.qtyTotal,
    sideChanged: oldPosition.side !== newPosition.side,
    oldPrice: oldPosition.avgPrice,
    oldQty: oldPosition.qtyTotal,
    oldSide: oldPosition.side,
    newPrice: newPosition.avgPrice,
    newQty: newPosition.qtyTotal,
    newSide: newPosition.side
  };
}

/**
 * 価格フォーマット (日本円)
 * 
 * @param price - フォーマット対象の価格
 * @returns フォーマット済み価格文字列
 */
export function formatPrice(price: number): string {
  return `¥${new Intl.NumberFormat('ja-JP').format(Math.round(price))}`;
}

/**
 * 数量フォーマット (株数)
 * 
 * @param qty - フォーマット対象の数量
 * @returns フォーマット済み数量文字列
 */
export function formatQty(qty: number): string {
  return `${new Intl.NumberFormat('ja-JP').format(qty)}株`;
}

/**
 * パーセンテージフォーマット
 * 
 * @param percent - フォーマット対象のパーセンテージ
 * @param decimals - 小数点以下の桁数 (デフォルト: 2)
 * @returns フォーマット済みパーセンテージ文字列
 */
export function formatPercent(percent: number, decimals: number = 2): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(decimals)}%`;
}

/**
 * 損益フォーマット (色付き)
 * 
 * @param pnl - 損益額
 * @returns フォーマット済み損益情報
 */
export function formatPnl(pnl: number): {
  text: string;
  colorClass: string;
  sign: string;
} {
  const isProfit = pnl >= 0;
  const sign = isProfit ? '+' : '';
  const colorClass = isProfit ? 'text-green-600' : 'text-red-600';
  const text = `${sign}${formatPrice(pnl)}`;
  
  return { text, colorClass, sign };
}

/**
 * Position更新時の検証
 * 
 * @param position - 検証対象のPosition
 * @returns 検証結果
 */
export function validatePosition(position: Position): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (position.avgPrice <= 0) {
    errors.push('平均建値は0より大きい値である必要があります');
  }

  if (position.qtyTotal <= 0) {
    errors.push('保有数量は0より大きい値である必要があります');
  }

  if (!['LONG', 'SHORT'].includes(position.side)) {
    errors.push('ポジションタイプはLONGまたはSHORTである必要があります');
  }

  if (position.version < 0) {
    errors.push('バージョン情報が不正です');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Position更新時の業務ロジック検証
 * 
 * @param oldPosition - 更新前Position
 * @param newPosition - 更新後Position
 * @returns 検証結果
 */
export function validatePositionUpdate(
  oldPosition: Position,
  newPosition: Position
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本検証
  const basicValidation = validatePosition(newPosition);
  errors.push(...basicValidation.errors);

  // バージョン検証
  if (newPosition.version <= oldPosition.version) {
    errors.push('バージョンが古いため更新できません');
  }

  // 業務ロジック検証
  const diff = calculateUpdateDiff(oldPosition, newPosition);
  
  // サイド変更時の警告
  if (diff.sideChanged) {
    warnings.push('ポジションタイプが変更されました。リスク管理にご注意ください。');
  }

  // 大幅な価格変更の警告
  const priceChangePercent = Math.abs((diff.newPrice - diff.oldPrice) / diff.oldPrice) * 100;
  if (priceChangePercent > 10) {
    warnings.push(`建値が${priceChangePercent.toFixed(1)}%変更されました。`);
  }

  // 数量大幅変更の警告
  const qtyChangePercent = Math.abs((diff.newQty - diff.oldQty) / diff.oldQty) * 100;
  if (qtyChangePercent > 50) {
    warnings.push(`保有数量が${qtyChangePercent.toFixed(1)}%変更されました。`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}
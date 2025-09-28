type TradeSide = 'LONG' | 'SHORT';

export interface TradePlanConfig {
  takeProfitRate: number;
  stopLossRate: number;
  takeProfitPercent: number;
  stopLossPercent: number;
}

const DEFAULT_TAKE_PROFIT_PERCENT = 5;
const DEFAULT_STOP_LOSS_PERCENT = 2;

const getNumberFromStorage = (key: string, fallback: number): number => {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const raw = window.localStorage.getItem(key);
  if (raw === null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

export const loadTradePlanConfig = (): TradePlanConfig => {
  const takeProfitPercent = getNumberFromStorage('takeProfitPercent', DEFAULT_TAKE_PROFIT_PERCENT);
  const stopLossPercent = getNumberFromStorage('stopLossPercent', DEFAULT_STOP_LOSS_PERCENT);

  return {
    takeProfitPercent,
    stopLossPercent,
    takeProfitRate: takeProfitPercent / 100,
    stopLossRate: stopLossPercent / 100,
  };
};

export const computeTradePlanTargets = (
  price: number,
  qty: number,
  side: TradeSide,
  config: TradePlanConfig
): {
  takeProfitPrice: number;
  stopLossPrice: number;
  expectedProfitAmount: number;
  expectedLossAmount: number;
} => {
  const takeProfitPrice = side === 'LONG'
    ? price * (1 + config.takeProfitRate)
    : price * (1 - config.takeProfitRate);

  const stopLossPrice = side === 'LONG'
    ? price * (1 - config.stopLossRate)
    : price * (1 + config.stopLossRate);

  const expectedProfitAmount = Math.abs(takeProfitPrice - price) * qty;
  const expectedLossAmount = Math.abs(price - stopLossPrice) * qty;

  return {
    takeProfitPrice,
    stopLossPrice,
    expectedProfitAmount,
    expectedLossAmount,
  };
};

const formatPercentText = (value: number, sign: '+' | '-'): string => {
  const normalized = Math.abs(value);
  const rounded = normalized % 1 === 0 ? normalized.toFixed(0) : normalized.toFixed(1);
  return `${sign}${rounded}%`;
};

const formatCurrency = (value: number): string => {
  return Math.round(value).toLocaleString('ja-JP');
};

export const buildPlanMessageContent = (
  price: number,
  qty: number,
  side: TradeSide,
  config: TradePlanConfig,
  options?: { edited?: boolean }
): string => {
  const { takeProfitPrice, stopLossPrice, expectedProfitAmount, expectedLossAmount } =
    computeTradePlanTargets(price, qty, side, config);

  const takeProfitPercentText = formatPercentText(config.takeProfitPercent, '+');
  const stopLossPercentText = formatPercentText(config.stopLossPercent, '-');
  const header = options?.edited ? '🎯 取引プラン設定（編集済み）' : '🎯 取引プラン設定';

  return `${header}<br/>`
    + `📋 リスク管理ルール<br/>`
    + `• 利確目標: ${takeProfitPercentText} → <span style="color: #16a34a;">${formatCurrency(takeProfitPrice)}円</span><br/>`
    + `• 損切り目標: ${stopLossPercentText} → <span style="color: #dc2626;">${formatCurrency(stopLossPrice)}円</span><br/><br/>`
    + `💰 予想損益<br/>`
    + `• 利確時: <span style="color: #16a34a;">+${formatCurrency(expectedProfitAmount)}円</span><br/>`
    + `• 損切り時: <span style="color: #dc2626;">-${formatCurrency(expectedLossAmount)}円</span><br/><br/>`
    + `⚠️ 重要: 必ず逆指値注文を設定して、感情に左右されない取引を心がけましょう`;
};

export const createPlanLegacyMessage = (
  price: number,
  qty: number,
  side: TradeSide,
  config: TradePlanConfig,
  options?: { edited?: boolean }
): { id: string; content: string; timestamp: string } => {
  const content = buildPlanMessageContent(price, qty, side, config, options);
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `plan-${crypto.randomUUID()}`
    : `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
};

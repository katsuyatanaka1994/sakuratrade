import type { TradeFilter, TradeListResp } from '../../types/trades';
import { resolveApiBaseUrl } from '../env';

const API_BASE_URL = resolveApiBaseUrl('/api');

export class TradesApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'TradesApiError';
  }
}

/**
 * DateをYYYY-MM-DD形式の文字列に変換
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * フィルター条件からクエリパラメータを構築
 */
function buildQueryParams(filters: TradeFilter): URLSearchParams {
  const params = new URLSearchParams();
  
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.q) params.append('q', filters.q);
  if (filters.type && filters.type !== 'all') params.append('type', filters.type);
  if (filters.page && filters.page > 1) params.append('page', filters.page.toString());
  if (filters.page_size && filters.page_size !== 20) params.append('page_size', filters.page_size.toString());
  if (filters.timeframe) params.append('timeframe', filters.timeframe);
  if (filters.side) params.append('side', filters.side);

  return params;
}

/**
 * トレード一覧を取得
 */
export async function fetchTrades(filters: TradeFilter = {}): Promise<TradeListResp> {
  try {
    const params = buildQueryParams(filters);
    const url = `${API_BASE_URL}/trades${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new TradesApiError(errorMessage, response.status);
    }

    const data: TradeListResp = await response.json();
    return data;
  } catch (error) {
    if (error instanceof TradesApiError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new TradesApiError('ネットワークエラーが発生しました');
    }
    
    throw new TradesApiError('予期しないエラーが発生しました');
  }
}

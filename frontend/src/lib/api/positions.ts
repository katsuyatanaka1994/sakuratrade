import { Position, Side } from '../../store/positions';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export class PositionsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'PositionsApiError';
  }
}

export interface UpdatePositionEntryPayload {
  symbolCode: string;
  symbolName: string;
  side: Side;
  price: number;
  qty: number;
  note: string;
  version: number;
}

export interface UpdatePositionEntryResponse {
  position: Position;
  message?: string;
}

/**
 * ポジションエントリーを更新 - 楽観ロック対応
 * PATCH /positions/{positionId}/entry
 */
export async function updatePositionEntry(
  positionId: string, 
  payload: UpdatePositionEntryPayload
): Promise<UpdatePositionEntryResponse> {
  try {
    const url = `${API_BASE_URL}/positions/${positionId}/entry`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      let errorCode: string | undefined;
      
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.detail || errorMessage;
        errorCode = errorData.code;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      
      throw new PositionsApiError(errorMessage, response.status, errorCode);
    }

    const data: UpdatePositionEntryResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof PositionsApiError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new PositionsApiError('ネットワークエラーが発生しました');
    }
    
    throw new PositionsApiError('予期しないエラーが発生しました');
  }
}

/**
 * ポジション詳細を取得 (409エラー後の再取得用)
 * GET /positions/{positionId}
 */
export async function fetchPositionById(positionId: string): Promise<Position> {
  try {
    const url = `${API_BASE_URL}/positions/${positionId}`;
    
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
      throw new PositionsApiError(errorMessage, response.status);
    }

    const data: Position = await response.json();
    return data;
  } catch (error) {
    if (error instanceof PositionsApiError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new PositionsApiError('ネットワークエラーが発生しました');
    }
    
    throw new PositionsApiError('予期しないエラーが発生しました');
  }
}
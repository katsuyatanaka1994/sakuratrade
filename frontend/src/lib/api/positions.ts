import type { Position, Side, PositionNoteEntry } from '../../store/positions';
import { resolveApiBaseUrl } from '../env';

const API_BASE_URL = resolveApiBaseUrl('/api');

export const ALLOWED_POSITION_SOURCES = new Set([
  'chat.modal.trade-input',
  'chat.modal.trade-edit',
]);

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
  chartPattern?: string;
}

export interface UpdatePositionEntryResponse {
  position: Position;
  message?: string;
}

export type ServerPosition = Position & {
  symbol_code?: string;
  symbolName?: string;
  symbol_name?: string;
  position_id?: string;
  id?: string;
  quantity?: number;
  qty?: number;
  avg_entry?: number;
  avg_price?: number;
  entry_price?: number;
  updated_at?: string;
  status_text?: string;
  position_status?: string;
  chat_id?: string;
  owner_id?: string;
  chart_pattern?: string;
  chart_pattern_label?: string;
  ai_feedbacked?: boolean;
  realized_pnl?: number;
  position_source?: string;
  source?: string;
  origin?: string;
  memo?: string | null;
  note?: string | null;
  notes?: Array<{
    noteId?: string;
    note_id?: string;
    text?: string | null;
    updatedAt?: string | null;
    updated_at?: string | null;
    timestamp?: string | null;
    time?: string | null;
    createdAt?: string;
    created_at?: string;
    source?: string | null;
  }>;
  lots?: Array<{
    price?: number;
    qty?: number;
    quantity?: number;
    qty_remaining?: number;
    time?: string;
    timestamp?: string;
  }>;
};

const normaliseSide = (value: unknown): Side => {
  if (typeof value !== 'string') return 'LONG';
  const upper = value.toUpperCase();
  return upper === 'SHORT' ? 'SHORT' : 'LONG';
};

const normaliseLot = (raw: ServerPosition['lots'][number], fallbackPrice: number, fallbackTime: string) => {
  if (!raw) {
    return {
      price: fallbackPrice,
      qtyRemaining: 0,
      time: fallbackTime,
    };
  }

  const rawQty = raw.qty_remaining ?? raw.qty ?? raw.quantity;
  const qtyRemaining = typeof rawQty === 'number' ? rawQty : Number(rawQty) || 0;
  const rawPrice = raw.price;
  const price = typeof rawPrice === 'number' ? rawPrice : Number(rawPrice) || fallbackPrice;
  const time = raw.time ?? raw.timestamp ?? fallbackTime;

  return {
    price,
    qtyRemaining,
    time,
  };
};

const extractNoteEntries = (raw: ServerPosition): PositionNoteEntry[] => {
  const entries: PositionNoteEntry[] = [];
  const seen = new Set<string>();

  const normaliseTimestamp = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
    return trimmed;
  };

  const push = (value: unknown, fallbackTimestamp?: unknown) => {
    if (!value) return;
    let text: string | undefined;
    let timestamp: string | undefined;

    if (typeof value === 'string') {
      text = value;
      timestamp = normaliseTimestamp(fallbackTimestamp);
    } else if (typeof (value as { text?: unknown }).text === 'string') {
      text = (value as { text: string }).text;
      const candidate = value as { updatedAt?: unknown; updated_at?: unknown; timestamp?: unknown; time?: unknown; createdAt?: unknown; created_at?: unknown };
      timestamp = normaliseTimestamp(candidate.updatedAt)
        ?? normaliseTimestamp(candidate.updated_at)
        ?? normaliseTimestamp(candidate.timestamp)
        ?? normaliseTimestamp(candidate.time)
        ?? normaliseTimestamp(candidate.createdAt)
        ?? normaliseTimestamp(candidate.created_at)
        ?? normaliseTimestamp(fallbackTimestamp);
    } else if (typeof (value as { memo?: unknown }).memo === 'string') {
      text = (value as { memo: string }).memo;
      const candidate = value as { updatedAt?: unknown; updated_at?: unknown; timestamp?: unknown; time?: unknown; createdAt?: unknown; created_at?: unknown };
      timestamp = normaliseTimestamp(candidate.updatedAt)
        ?? normaliseTimestamp(candidate.updated_at)
        ?? normaliseTimestamp(candidate.timestamp)
        ?? normaliseTimestamp(candidate.time)
        ?? normaliseTimestamp(candidate.createdAt)
        ?? normaliseTimestamp(candidate.created_at)
        ?? normaliseTimestamp(fallbackTimestamp);
    }

    if (!text) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const key = `${trimmed}__${timestamp ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ text: trimmed, updatedAt: timestamp });
  };

  const baseTimestamp = normaliseTimestamp((raw as any).memoUpdatedAt ?? (raw as any).memo_updated_at ?? raw.updatedAt ?? raw.updated_at);

  push(raw.memo, baseTimestamp);
  push(raw.note, normaliseTimestamp((raw as any).noteUpdatedAt ?? (raw as any).note_updated_at ?? raw.updatedAt ?? raw.updated_at));

  if (Array.isArray(raw.notes)) {
    raw.notes.forEach((note) => {
      push(note, raw.updatedAt ?? raw.updated_at);
    });
  }

  const memoHistory = (raw as { memo_history?: unknown; memoHistory?: unknown }).memo_history
    ?? (raw as { memo_history?: unknown; memoHistory?: unknown }).memoHistory;
  if (Array.isArray(memoHistory)) {
    memoHistory.forEach((entry) => {
      push(entry, raw.updatedAt ?? raw.updated_at);
    });
  }

  entries.sort((a, b) => {
    if (a.updatedAt && b.updatedAt) {
      const aTime = Date.parse(a.updatedAt);
      const bTime = Date.parse(b.updatedAt);
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
        return bTime - aTime;
      }
    }
    if (a.updatedAt && !b.updatedAt) return -1;
    if (!a.updatedAt && b.updatedAt) return 1;
    return 0;
  });

  return entries;
};

const extractPatterns = (raw: ServerPosition, chartPatternLabel?: string): string[] | undefined => {
  if (Array.isArray((raw as any).patterns)) {
    const values = (raw as any).patterns
      .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value: string) => value.trim());
    if (values.length > 0) {
      return values;
    }
  }

  if (chartPatternLabel && chartPatternLabel.trim().length > 0) {
    return [chartPatternLabel.trim()];
  }

  return undefined;
};

export const normaliseServerPosition = (raw: ServerPosition): Position | null => {
  const symbol = raw.symbol ?? raw.symbol_code ?? raw.symbolName ?? raw.symbol_name;
  const side = normaliseSide(raw.side);
  const qtyValue = raw.qtyTotal ?? raw.quantity ?? raw.qty;
  const qtyTotal = typeof qtyValue === 'number' ? qtyValue : Number(qtyValue) || 0;
  const avgValue = raw.avgPrice ?? raw.avg_entry ?? raw.avg_price ?? raw.entry_price ?? (raw as any).price;
  const avgPrice = typeof avgValue === 'number' ? avgValue : Number(avgValue) || 0;
  const updatedAt = raw.updatedAt ?? raw.updated_at ?? new Date().toISOString();
  const versionValue = raw.version;
  const version = typeof versionValue === 'number' && Number.isFinite(versionValue) ? versionValue : 1;
  const realizedValue = raw.realizedPnl ?? raw.realized_pnl;
  const realizedPnl = typeof realizedValue === 'number' ? realizedValue : Number(realizedValue) || 0;
  const name = raw.name ?? raw.symbolName ?? raw.symbol_name;
  const chartPattern = raw.chartPattern ?? raw.chart_pattern;
  const chartPatternLabel = raw.chartPatternLabel ?? raw.chart_pattern_label;
  const source = raw.source ?? raw.position_source ?? raw.origin;
  if (source && !ALLOWED_POSITION_SOURCES.has(source)) {
    return null;
  }

  const chatId = raw.chatId ?? raw.chat_id ?? raw.chat ?? undefined;
  if (!chatId || typeof chatId !== 'string') {
    console.warn('[positions] skipped position because chatId is missing', {
      symbol,
      side,
      rawChatId: chatId,
      positionId: raw.positionId ?? raw.position_id,
    });
    return null;
  }

  const positionId = raw.positionId ?? raw.position_id;
  if (!positionId || typeof positionId !== 'string') {
    console.warn('[positions] skipped position because positionId is missing', {
      symbol,
      side,
      rawPositionId: positionId,
    });
    return null;
  }

  const noteEntries = extractNoteEntries(raw);
  const primaryNote = noteEntries[0];
  const memoText = noteEntries.length > 0 ? noteEntries.map((entry) => entry.text).join('\n') : undefined;
  const patterns = extractPatterns(raw, chartPatternLabel);
  const lotsSource = Array.isArray(raw.lots) && raw.lots.length > 0
    ? raw.lots.map(lot => normaliseLot(lot, avgPrice, updatedAt))
    : [
        {
          price: avgPrice,
          qtyRemaining: qtyTotal,
          time: updatedAt,
        },
      ];

  const statusRaw = raw.status ?? raw.status_text ?? raw.position_status;
  const status = typeof statusRaw === 'string' ? statusRaw.toUpperCase() : 'OPEN';
  const normalizedStatus = status === 'CLOSED' ? 'CLOSED' : 'OPEN';

  return {
    symbol: typeof symbol === 'string' ? symbol : '',
    side,
    qtyTotal,
    avgPrice,
    lots: lotsSource,
    realizedPnl,
    updatedAt,
    name: typeof name === 'string' ? name : undefined,
    chatId,
    positionId,
    currentTradeId: raw.currentTradeId ?? raw.current_trade_id,
    status: normalizedStatus,
    ownerId: raw.ownerId ?? raw.owner_id,
    version,
    chartImageId: raw.chartImageId ?? raw.chart_image_id ?? null,
    aiFeedbacked: raw.aiFeedbacked ?? raw.ai_feedbacked ?? false,
    note: primaryNote ? primaryNote.text : undefined,
    memo: memoText,
    notes: noteEntries.length > 0 ? noteEntries : undefined,
    chartPattern: typeof chartPattern === 'string' ? chartPattern : undefined,
    chartPatternLabel: typeof chartPatternLabel === 'string' ? chartPatternLabel : undefined,
    patterns,
  };
};

const extractServerPositions = (payload: unknown): ServerPosition[] => {
  if (Array.isArray(payload)) {
    return payload as ServerPosition[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const possiblePositions = (payload as { positions?: unknown }).positions;

  if (Array.isArray(possiblePositions)) {
    return possiblePositions as ServerPosition[];
  }

  if (possiblePositions && typeof possiblePositions === 'object') {
    return Object.values(possiblePositions as Record<string, ServerPosition>);
  }

  return Object.values(payload as Record<string, ServerPosition>);
};

export async function fetchPositionsList(): Promise<Position[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/positions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
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

    const payload = await response.json().catch(() => []);
    const rawPositions = extractServerPositions(payload);

    return rawPositions
      .map(normaliseServerPosition)
      .filter(
        (position): position is Position =>
          Boolean(
            position &&
              position.symbol &&
              position.chatId &&
              position.qtyTotal > 0 &&
              position.status !== 'CLOSED',
          ),
      );
  } catch (error) {
    if (error instanceof PositionsApiError) {
      throw error;
    }

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new PositionsApiError('ネットワークエラーが発生しました');
    }

    throw new PositionsApiError('ポジションデータの取得に失敗しました');
  }
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

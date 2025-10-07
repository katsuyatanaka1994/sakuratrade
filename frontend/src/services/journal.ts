import { isDevelopmentEnv, resolveApiBaseUrl } from '../lib/env';

interface JournalEntry {
  trade_id: string;
  chat_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  pattern?: string | null;
  avg_entry: number;
  avg_exit: number;
  qty: number;
  pnl_abs: number;
  pnl_pct: number;
  hold_minutes: number;
  closed_at: string;
  feedback_text?: string;
  feedback_tone?: 'praise' | 'advice';
  feedback_next_actions?: string[];
  feedback_message_id?: string;
  analysis_score?: number;
  analysis_labels?: string[];
  created_at: string;
  updated_at: string;
}

interface JournalFilters {
  fromDate?: string;
  toDate?: string;
  symbol?: string;
  pnl?: 'win' | 'lose';
  side?: 'long' | 'short';
  pattern?: string;
  sort?: string[];
  limit?: number;
  offset?: number;
}

interface FeedbackResponse {
  feedback_text: string;
  chat_id: string;
  message_id?: string;
}

type TimelineKind = 'ENTRY' | 'EXIT' | 'MEMO' | 'AI' | 'IMAGE';

interface JournalPlan {
  tp?: number | null;
  sl?: number | null;
  target?: number | null;
  rr?: number | null;
  expected_pnl?: number | null;
}

interface JournalTimelineItem {
  id: string;
  kind: TimelineKind;
  occurred_at: string;
  price?: number | null;
  qty?: number | null;
  realized_pnl?: number | null;
  note?: string | null;
  raw?: string | null;
  message_id?: string | null;
  image_url?: string | null;
  thumb_url?: string | null;
  supersedes?: string | null;
}

interface JournalMemoItem {
  id: string;
  occurred_at: string;
  note: string;
  supersedes?: string | null;
}

interface JournalImageItem {
  id: string;
  occurred_at: string;
  image_url: string;
  thumb_url?: string | null;
  note?: string | null;
}

interface JournalAiFeedback {
  positives: string[];
  improvements: string[];
  next_actions: string[];
  raw?: string | null;
}

interface JournalDetail {
  header: {
    trade_id: string;
    symbol: string;
    company_name?: string | null;
    side: 'LONG' | 'SHORT';
    pattern?: string | null;
    closed_at?: string | null;
    pnl_abs: number;
    pnl_pct?: number | null;
    hold_minutes?: number | null;
  };
  plan?: JournalPlan | null;
  timeline: JournalTimelineItem[];
  memos: JournalMemoItem[];
  images: JournalImageItem[];
  ai_feedback?: JournalAiFeedback | null;
}

interface UploadImageResult {
  filename: string;
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface JournalListResponse {
  entries: JournalEntry[];
  total: number;
  page: number;
  per_page: number;
}

interface AttachImageRequest {
  image_url: string;
  thumb_url?: string | null;
  occurred_at?: string | null;
  note?: string | null;
  message_id?: string | null;
}

interface CreateMemoRequest {
  note: string;
  occurred_at?: string | null;
  supersedes?: string | null;
}

const API_BASE = resolveApiBaseUrl(isDevelopmentEnv() ? 'http://localhost:8000' : '');

export const journalApi = {
  async getEntries(filters: JournalFilters = {}): Promise<JournalListResponse> {
    const params = new URLSearchParams();

    if (filters.fromDate) params.append('from_date', filters.fromDate);
    if (filters.toDate) params.append('to_date', filters.toDate);
    if (filters.symbol) params.append('symbol', filters.symbol);
    if (filters.pnl) params.append('pnl', filters.pnl);
    if (filters.side) params.append('side', filters.side.toUpperCase());
    if (filters.pattern) params.append('pattern', filters.pattern);
    if (filters.sort?.length) params.append('sort', filters.sort.join(','));
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await fetch(`${API_BASE}/journal/?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch journal entries: ${response.status}`);
    }
    
    return await response.json();
  },

  async getFeedback(tradeId: string): Promise<FeedbackResponse> {
    const response = await fetch(`${API_BASE}/journal/${tradeId}/feedback`);
    if (!response.ok) {
      throw new Error(`Failed to fetch feedback: ${response.status}`);
    }

    return await response.json();
  },

  async getTradeDetail(tradeId: string): Promise<JournalDetail> {
    const response = await fetch(`${API_BASE}/journal/${tradeId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch journal detail: ${response.status}`);
    }

    return await response.json();
  },

  async uploadImage(file: File): Promise<UploadImageResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/images/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload image: ${response.status}`);
    }

    return await response.json();
  },

  async attachImage(tradeId: string, payload: AttachImageRequest): Promise<JournalTimelineItem> {
    const response = await fetch(`${API_BASE}/journal/${tradeId}/images:attach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to attach image: ${response.status}`);
    }

    return await response.json();
  },

  async createMemo(tradeId: string, payload: CreateMemoRequest): Promise<JournalMemoItem> {
    const response = await fetch(`${API_BASE}/journal/${tradeId}/memos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Failed to create memo: ${response.status}`);
    }

    return await response.json();
  },
};

export type { JournalEntry, JournalFilters, FeedbackResponse };
export type {
  JournalDetail,
  JournalTimelineItem,
  JournalImageItem,
  JournalMemoItem,
  JournalAiFeedback,
  UploadImageResult,
};
export type { JournalListResponse };
export type { AttachImageRequest, CreateMemoRequest };

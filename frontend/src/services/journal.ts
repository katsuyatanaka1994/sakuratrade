import { isDevelopmentEnv, resolveApiBaseUrl } from '../lib/env';

interface JournalEntry {
  trade_id: string;
  chat_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
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
  limit?: number;
  offset?: number;
}

interface FeedbackResponse {
  feedback_text: string;
  chat_id: string;
  message_id?: string;
}

const API_BASE = resolveApiBaseUrl(isDevelopmentEnv() ? 'http://localhost:8000' : '');

export const journalApi = {
  async getEntries(filters: JournalFilters = {}): Promise<JournalEntry[]> {
    const params = new URLSearchParams();
    
    if (filters.fromDate) params.append('from_date', filters.fromDate);
    if (filters.toDate) params.append('to_date', filters.toDate);
    if (filters.symbol) params.append('symbol', filters.symbol);
    if (filters.pnl) params.append('pnl', filters.pnl);
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
  }
};

export type { JournalEntry, JournalFilters, FeedbackResponse };

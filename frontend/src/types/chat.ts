export type ChatMessageType = 'TEXT' | 'ENTRY' | 'EXIT';

export type BaseMessage = {
  id: string;
  type: ChatMessageType;
  authorId: string;
  createdAt: string;
  updatedAt?: string;
};

export type ChartPattern =
  | 'pullback-buy'
  | 'retest-short'
  | 'breakout'
  | 'double-bottom'
  | 'trend-follow';

export type EntryPayload = {
  symbolCode: string;
  symbolName: string;
  side: 'LONG' | 'SHORT';
  price: number;
  qty: number;
  note?: string;
  executedAt?: string;
  tradeId: string;
  chartPattern?: ChartPattern;
};

export type ExitPayload = {
  tradeId: string;
  exitPrice: number;
  exitQty: number;
  note?: string;
  executedAt?: string;
};

export type ChatMessage =
  | (BaseMessage & { type: 'TEXT'; text: string })
  | (BaseMessage & { type: 'ENTRY'; payload: EntryPayload })
  | (BaseMessage & { type: 'EXIT'; payload: ExitPayload });

// API request types
export interface UpdateMessageRequest {
  type: ChatMessageType;
  text?: string;
  payload?: EntryPayload | ExitPayload;
}

// Extended legacy message type for backward compatibility
export interface LegacyMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  isTradeAction?: boolean;
}

// Chat type
export interface Chat {
  id: string;
  name: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

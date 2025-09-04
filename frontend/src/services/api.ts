import { ChatMessage, UpdateMessageRequest, EntryPayload, ExitPayload } from '../types/chat';

// API base URL (robust across environments)
const getApiUrl = () => {
  try {
    // Vite (if available)
    const viteUrl = (import.meta as any)?.env?.VITE_API_BASE_URL;
    if (viteUrl) return viteUrl as string;
  } catch (_) {
    // ignore — import.meta may not exist
  }

  // Meta tag override: <meta name="api-base-url" content="http://..." />
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="api-base-url"]') as HTMLMetaElement | null;
    const metaUrl = meta?.getAttribute('content');
    if (metaUrl) return metaUrl;
  }

  // Window global override: window.API_BASE_URL or window.ENV.VITE_API_BASE_URL
  if (typeof window !== 'undefined') {
    const w = window as any;
    const globalUrl = w.API_BASE_URL || w?.ENV?.VITE_API_BASE_URL;
    if (globalUrl) return globalUrl as string;
  }

  // Fallback
  return "http://localhost:8000";
};

// Chat Message API functions

// API response type (snake_case)
type ApiChatMessage = {
  id: string;
  chat_id?: string;
  type: 'TEXT' | 'ENTRY' | 'EXIT';
  author_id: string;
  text?: string;
  payload?: unknown;
  created_at: string;
  updated_at?: string | null;
};

function mapApiChatMessage(api: ApiChatMessage): ChatMessage {
  if (api.type === 'TEXT') {
    return {
      id: api.id,
      type: 'TEXT',
      authorId: api.author_id,
      text: api.text || '',
      createdAt: api.created_at,
      updatedAt: api.updated_at || undefined,
    };
  }
  if (api.type === 'ENTRY') {
    return {
      id: api.id,
      type: 'ENTRY',
      authorId: api.author_id,
      payload: api.payload as EntryPayload,
      createdAt: api.created_at,
      updatedAt: api.updated_at || undefined,
    };
  }
  // EXIT
  return {
    id: api.id,
    type: 'EXIT',
    authorId: api.author_id,
    payload: api.payload as ExitPayload,
    createdAt: api.created_at,
    updatedAt: api.updated_at || undefined,
  };
}

export async function updateChatMessage(messageId: string, data: UpdateMessageRequest): Promise<ChatMessage> {
  try {
    const response = await fetch(`${getApiUrl()}/chats/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API request failed with status ${response.status}`);
    }

    const apiMsg = (await response.json()) as ApiChatMessage;
    return mapApiChatMessage(apiMsg);
  } catch (error) {
    console.error('Error updating chat message:', error);
    throw error;
  }
}

export async function createChatMessage(chatId: string, message: {
  type: 'TEXT' | 'ENTRY' | 'EXIT';
  author_id: string;
  text?: string;
  payload?: EntryPayload | ExitPayload;
}): Promise<ChatMessage> {
  try {
    const response = await fetch(`${getApiUrl()}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API request failed with status ${response.status}`);
    }

    const apiMsg = (await response.json()) as ApiChatMessage;
    return mapApiChatMessage(apiMsg);
  } catch (error) {
    console.error('Error creating chat message:', error);
    throw error;
  }
}

export async function getChatMessages(chatId: string, options?: {
  limit?: number;
  offset?: number;
}): Promise<ChatMessage[]> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const url = `${getApiUrl()}/chats/${chatId}/messages${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API request failed with status ${response.status}`);
    }

    const apiMsgs = (await response.json()) as ApiChatMessage[];
    return apiMsgs.map(mapApiChatMessage);
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }
}

export async function undoChatMessage(messageId: string): Promise<void> {
  try {
    const response = await fetch(`${getApiUrl()}/chats/messages/${messageId}/undo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Undo request failed with status ${response.status}`);
    }
  } catch (error) {
    console.error('Error undoing message:', error);
    throw error;
  }
}

export interface AIReplyResult {
  aiMessageId: string;
  response: string;
  chatId: string;
}

export async function generateAIReply(chatId: string, latestUserMessageId: string): Promise<AIReplyResult> {
  try {
    const response = await fetch(`${getApiUrl()}/ai/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chatId,
        latestUserMessageId,
        context: {}
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `AI reply request failed with status ${response.status}`);
    }

    const data = await response.json();
    return {
      aiMessageId: data.ai_message_id ?? '',
      response: data.response ?? '',
      chatId: data.chat_id ?? chatId,
    };
  } catch (error) {
    console.error('Error generating AI reply:', error);
    throw error;
  }
}

// Legacy functions for backward compatibility

// モックデータ用
export async function getAdviceMock() {
  return {
    symbol: "DUMMY",
    entry_price: 1000,
    pattern_name: "下降トレンド・戻り売り型",
    score: 0.9,
    advice_html: `
      <h2>✅ 現在の状況（テスト時点）</h2>
      <p>下降トレンド継続中。戻り売りチャンスです。</p>
    `
  };
}

export async function getAdvice(file: File) {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${getApiUrl()}/advice`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error fetching advice:", error);
    throw error;
  }
}

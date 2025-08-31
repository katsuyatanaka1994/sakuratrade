import { ChatMessage, UpdateMessageRequest, EntryPayload, ExitPayload } from '../types/chat';

// API base URL
const getApiUrl = () => {
  return import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
};

// Chat Message API functions

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

    return await response.json();
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

    return await response.json();
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

    return await response.json();
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

export async function generateAIReply(chatId: string, latestUserMessageId: string): Promise<void> {
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

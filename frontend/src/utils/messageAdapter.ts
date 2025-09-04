import { ChatMessage, LegacyMessage } from '../types/chat';

// Trade.tsx の既存Message型
interface TradeMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: string;
  isTradeAction?: boolean;
}

/**
 * Trade.tsxの既存Message型をChatMessage/LegacyMessage型に変換
 */
export function convertTradeMessageToLegacyMessage(tradeMessage: TradeMessage): LegacyMessage {
  return {
    id: tradeMessage.id,
    type: tradeMessage.type,
    content: tradeMessage.content,
    timestamp: tradeMessage.timestamp,
    isTradeAction: tradeMessage.isTradeAction
  };
}

/**
 * LegacyMessage型をTrade.tsxのMessage型に変換
 */
export function convertLegacyMessageToTradeMessage(legacyMessage: LegacyMessage): TradeMessage {
  return {
    id: legacyMessage.id,
    type: legacyMessage.type,
    content: legacyMessage.content,
    timestamp: legacyMessage.timestamp,
    isTradeAction: legacyMessage.isTradeAction
  };
}

/**
 * ChatMessage型をTrade.tsxのMessage型に変換（表示用）
 */
export function convertChatMessageToTradeMessage(chatMessage: ChatMessage): TradeMessage {
  let content = '';
  
  switch (chatMessage.type) {
    case 'TEXT':
      content = chatMessage.text;
      break;
    case 'ENTRY':
      const { symbolCode, symbolName, side, price, qty, note } = chatMessage.payload;
      content = `📈 建値入力しました！\n銘柄: ${symbolCode} ${symbolName}\nポジションタイプ: ${side === 'LONG' ? 'ロング（買い）' : 'ショート（売り）'}\n建値: ${price.toLocaleString()}円\n数量: ${qty}株${note ? `\nメモ: ${note}` : ''}`;
      break;
    case 'EXIT':
      const { tradeId, exitPrice, exitQty, note: exitNote } = chatMessage.payload;
      content = `✅ 決済しました！\n銘柄: ${tradeId}\nポジションタイプ: ロング（買い）\n決済価格: ${exitPrice.toLocaleString()}円\n数量: ${exitQty}株${exitNote ? `\nメモ: ${exitNote}` : ''}`;
      break;
    default:
      content = 'Unknown message type';
  }

  // createdAt のフォールバック（snake_caseにも対応）
  const ts = (chatMessage as unknown as { createdAt?: string; created_at?: string });
  let createdAt = ts.createdAt ?? ts.created_at ?? new Date().toISOString();
  // If no timezone info, treat as UTC to avoid local-interpretation drift
  if (typeof createdAt === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(createdAt)) {
    createdAt = createdAt + 'Z';
  }

  return {
    id: chatMessage.id,
    type: 'user', // ChatMessageは基本的にユーザーメッセージとして扱う
    content,
    timestamp: new Date(createdAt).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    }),
    isTradeAction: chatMessage.type === 'ENTRY' || chatMessage.type === 'EXIT'
  };
}

/**
 * Trade.tsxのMessage配列をChatMessage/LegacyMessage配列に変換
 */
export function convertTradeMessagesToMixed(tradeMessages: TradeMessage[]): (ChatMessage | LegacyMessage)[] {
  return tradeMessages.map(convertTradeMessageToLegacyMessage);
}

/**
 * ChatMessage/LegacyMessage配列をTrade.tsxのMessage配列に変換
 */
export function convertMixedToTradeMessages(mixedMessages: (ChatMessage | LegacyMessage)[]): TradeMessage[] {
  return mixedMessages.map(message => {
    if ('content' in message) {
      // LegacyMessage
      return convertLegacyMessageToTradeMessage(message as LegacyMessage);
    } else {
      // ChatMessage
      return convertChatMessageToTradeMessage(message as ChatMessage);
    }
  });
}

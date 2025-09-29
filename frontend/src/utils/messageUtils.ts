import type { ChatMessage } from '../types/chat';

const UNDO_TIME_LIMIT_MINUTES = 30;

export function canUndoMessage(message: ChatMessage): boolean {
  if (message.type !== 'EXIT') {
    return false;
  }

  const createdAt = new Date(message.createdAt);
  const now = new Date();
  const timeDifferenceMs = now.getTime() - createdAt.getTime();
  const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);

  return timeDifferenceMinutes <= UNDO_TIME_LIMIT_MINUTES;
}

export function getUndoTimeRemaining(message: ChatMessage): number {
  if (message.type !== 'EXIT') {
    return 0;
  }

  const createdAt = new Date(message.createdAt);
  const now = new Date();
  const timeDifferenceMs = now.getTime() - createdAt.getTime();
  const timeDifferenceMinutes = timeDifferenceMs / (1000 * 60);
  
  const remainingMinutes = UNDO_TIME_LIMIT_MINUTES - timeDifferenceMinutes;
  return Math.max(0, remainingMinutes);
}

export function formatTimeRemaining(minutes: number): string {
  if (minutes <= 0) return '0分';
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.ceil(minutes % 60);
  
  if (hours > 0) {
    return `${hours}時間${mins}分`;
  }
  return `${mins}分`;
}

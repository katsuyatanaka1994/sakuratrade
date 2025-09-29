const AUDIT_LOG_ENDPOINT = '/api/audit/logs';
const MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 2000;

export type AuditEventType = 'ENTRY_EDITED' | 'ENTRY_DELETED';

export interface EntryAuditSnapshot {
  symbolCode?: string;
  side?: 'LONG' | 'SHORT';
  price?: number;
  qty?: number;
  note?: string;
  tradeId?: string;
  chartPattern?: string;
}

export interface AuditEventPayload {
  entryId: string;
  before: EntryAuditSnapshot | null;
  after: EntryAuditSnapshot | null;
  actorId: string;
  timestamp: string;
  regenerateFlag?: boolean;
}

interface QueueItem {
  eventType: AuditEventType;
  payload: AuditEventPayload;
  attempt: number;
}

const queue: QueueItem[] = [];
let processing = false;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sanitizeSnapshot = (snapshot: EntryAuditSnapshot | null): EntryAuditSnapshot | null => {
  if (!snapshot) return null;
  const { note, ...rest } = snapshot;
  return {
    ...rest,
    note: typeof note === 'string' ? note.slice(0, 120) : note,
  };
};

const sanitizePayload = (payload: AuditEventPayload): AuditEventPayload => ({
  ...payload,
  before: sanitizeSnapshot(payload.before),
  after: sanitizeSnapshot(payload.after),
  regenerateFlag: payload.regenerateFlag ?? false,
});

const scheduleProcessQueue = () => {
  if (processing) return;
  processing = true;
  // Run on next microtask to avoid blocking caller
  Promise.resolve().then(processQueue).catch((error) => {
    console.error('auditLogger schedule failed:', error);
    processing = false;
  });
};

const processQueue = async () => {
  while (queue.length > 0) {
    const item = queue[0];
    const payload = sanitizePayload(item.payload);
    try {
      const response = await fetch(AUDIT_LOG_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: item.eventType,
          payload,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      queue.shift();
      item.attempt = 0;
    } catch (error) {
      item.attempt += 1;
      if (item.attempt >= MAX_RETRIES) {
        console.error('Audit log send failed, giving up:', error);
        queue.shift();
      } else {
        const backoff = BASE_RETRY_DELAY_MS * item.attempt;
        await delay(backoff);
      }
    }
  }
  processing = false;
};

export const logAuditEvent = (eventType: AuditEventType, payload: AuditEventPayload): void => {
  queue.push({ eventType, payload: { ...payload }, attempt: 0 });
  scheduleProcessQueue();
};

export const recordEntryEdited = (payload: AuditEventPayload): void => {
  logAuditEvent('ENTRY_EDITED', payload);
};

export const recordEntryDeleted = (payload: AuditEventPayload): void => {
  logAuditEvent('ENTRY_DELETED', payload);
};

export const __resetAuditLoggerForTests = () => {
  queue.splice(0, queue.length);
  processing = false;
};

export const __getQueueSizeForTests = () => queue.length;

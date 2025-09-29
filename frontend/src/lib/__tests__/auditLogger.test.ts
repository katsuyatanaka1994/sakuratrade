import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  logAuditEvent,
  recordEntryEdited,
  recordEntryDeleted,
  __resetAuditLoggerForTests,
  __getQueueSizeForTests,
} from '../auditLogger';

const payloadBase = {
  entryId: 'entry-1',
  before: { symbolCode: '7203', side: 'LONG', price: 1500, qty: 100 },
  after: { symbolCode: '7203', side: 'LONG', price: 1550, qty: 120 },
  actorId: 'tester',
  timestamp: '2024-01-01T10:00:00.000Z',
  regenerateFlag: true,
} as const;

declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof fetch;
}

describe('auditLogger', () => {
  beforeEach(() => {
    __resetAuditLoggerForTests();
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('sends audit event immediately on success', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    logAuditEvent('ENTRY_EDITED', { ...payloadBase });

    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/audit/logs',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('retries failed audit deliveries up to the max retries', async () => {
    vi.mocked(global.fetch)
      .mockRejectedValueOnce(new Error('network-1'))
      .mockRejectedValueOnce(new Error('network-2'))
      .mockResolvedValue({ ok: true } as Response);

    logAuditEvent('ENTRY_EDITED', { ...payloadBase });

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2000);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(4000);
    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(__getQueueSizeForTests()).toBe(0);
  });

  it('records entry edited events through the helper', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    recordEntryEdited({ ...payloadBase });

    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalled();
  });

  it('records entry deleted events through the helper', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    recordEntryDeleted({
      entryId: 'entry-2',
      before: { symbolCode: '6501', side: 'SHORT', price: 4000, qty: 50 },
      after: null,
      actorId: 'tester',
      timestamp: '2024-01-01T11:00:00.000Z',
      regenerateFlag: false,
    });

    await Promise.resolve();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/audit/logs',
      expect.objectContaining({ method: 'POST' })
    );
  });
});

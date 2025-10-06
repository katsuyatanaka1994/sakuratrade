import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyPositionsSnapshot,
  makePositionKey,
  removePositionsByKeys,
  syncPositionsBatch,
  type Position,
} from '../store/positions';
import {
  fetchPositionsList,
  normaliseServerPosition,
  type ServerPosition,
} from '../lib/api/positions';
import { resolveApiBaseUrl } from '../lib/env';

const env = typeof import.meta !== 'undefined' ? ((import.meta as any).env ?? {}) : {};
const DEFAULT_WS_URL: string | undefined = env.VITE_WS_POSITIONS_URL;
const DEFAULT_WS_TOKEN: string | undefined = env.VITE_WS_POSITIONS_TOKEN;

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected';

type PositionsUpsertEvent = {
  type: 'positions.upsert';
  payload: ServerPosition | Position;
  schemaVersion?: string;
  emittedAt?: string;
};

type PositionsRemovedEvent = {
  type: 'positions.removed';
  payload: {
    symbol: string;
    side: 'LONG' | 'SHORT' | string;
    chatId?: string | null;
  };
  schemaVersion?: string;
  emittedAt?: string;
};

type PositionsSnapshotRequestEvent = {
  type: 'positions.snapshot.request';
  schemaVersion?: string;
};

type PositionsHeartbeatEvent = {
  type: 'ping' | 'pong';
  schemaVersion?: string;
};

type PositionsLiveEvent =
  | PositionsUpsertEvent
  | PositionsRemovedEvent
  | PositionsSnapshotRequestEvent
  | PositionsHeartbeatEvent;

interface PositionsLiveOptions {
  autoConnect?: boolean;
  websocketPath?: string;
  websocketUrl?: string | null;
  getAuthToken?: (() => Promise<string | null> | string | null);
  pingIntervalMs?: number;
  heartbeatTimeoutMs?: number;
  maxReconnectDelayMs?: number;
}

const DEFAULT_OPTIONS: Required<Pick<PositionsLiveOptions, 'autoConnect' | 'websocketPath' | 'pingIntervalMs' | 'heartbeatTimeoutMs' | 'maxReconnectDelayMs'>> = {
  autoConnect: true,
  websocketPath: '/ws/positions',
  pingIntervalMs: 25_000,
  heartbeatTimeoutMs: 45_000,
  maxReconnectDelayMs: 30_000,
};

interface WebSocketUrlOptions {
  overrideUrl?: string | null;
  path?: string;
  token?: string | null;
}

const createWebSocketUrl = ({ overrideUrl, path, token }: WebSocketUrlOptions) => {
  try {
    if (overrideUrl) {
      const url = new URL(overrideUrl);
      if (token) {
        url.searchParams.set('access_token', token);
      }
      return url.toString();
    }

    const base = resolveApiBaseUrl('http://localhost:8000');
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    const resolvedPath = path && path.length > 0 ? (path.startsWith('/') ? path : `/${path}`) : '/ws/positions';
    url.pathname = resolvedPath;
    if (token) {
      url.searchParams.set('access_token', token);
    }
    return url.toString();
  } catch (error) {
    console.warn('[positions-live] Failed to resolve WebSocket URL:', error);
    return null;
  }
};

const isClosedPosition = (position: Pick<Position, 'qtyTotal' | 'status'>) => {
  if (position.qtyTotal <= 0) return true;
  if (!position.status) return false;
  return String(position.status).toUpperCase() === 'CLOSED';
};

const toPosition = (payload: ServerPosition | Position): Position | null => {
  const maybeServer = normaliseServerPosition(payload as ServerPosition);
  if (maybeServer) {
    return maybeServer;
  }

  const candidate = payload as Position;
  if (!candidate || !candidate.symbol) {
    return null;
  }
  return candidate;
};

interface PositionsLiveState {
  connectionState: ConnectionState;
  lastError: string | null;
  lastHeartbeat: number | null;
  reconnecting: boolean;
}

export function usePositionsLive(options: PositionsLiveOptions = {}) {
  const {
    autoConnect,
    websocketPath,
    websocketUrl,
    getAuthToken,
    pingIntervalMs,
    heartbeatTimeoutMs,
    maxReconnectDelayMs,
  } = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<PositionsLiveState>({
    connectionState: 'idle',
    lastError: null,
    lastHeartbeat: null,
    reconnecting: false,
  });

  const websocketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1000);
  const pendingFrameRef = useRef<number | null>(null);
  const pendingUpsertsRef = useRef<Map<string, Position>>(new Map());
  const pendingRemovalsRef = useRef<Set<string>>(new Set());
  const isMountedRef = useRef(true);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPongRef = useRef<number | null>(null);

  const clearReconnectTimer = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const clearPingInterval = () => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearReconnectTimer();
      clearPingInterval();
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
      if (websocketRef.current) {
        try {
          websocketRef.current.close();
        } catch (error) {
          console.warn('[positions-live] Failed to close websocket on unmount:', error);
        }
      }
    };
  }, []);

  const flushQueues = useCallback(() => {
    pendingFrameRef.current = null;

    const upserts = Array.from(pendingUpsertsRef.current.values());
    const removals = Array.from(pendingRemovalsRef.current.values());

    pendingUpsertsRef.current.clear();
    pendingRemovalsRef.current.clear();

    if (upserts.length > 0) {
      try {
        syncPositionsBatch(upserts);
      } catch (error) {
        console.error('[positions-live] Failed to sync batched positions:', error);
      }
    }

    if (removals.length > 0) {
      try {
        removePositionsByKeys(removals);
      } catch (error) {
        console.error('[positions-live] Failed to remove positions batch:', error);
      }
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (pendingFrameRef.current !== null) return;
    pendingFrameRef.current = requestAnimationFrame(flushQueues);
  }, [flushQueues]);

  const queueUpsert = useCallback(
    (position: Position) => {
      const identifierKey = makePositionKey(position.symbol, position.side, position.chatId);
      if (isClosedPosition(position)) {
        pendingUpsertsRef.current.delete(identifierKey);
        pendingRemovalsRef.current.add(identifierKey);
      } else {
        pendingRemovalsRef.current.delete(identifierKey);
        pendingUpsertsRef.current.set(identifierKey, position);
      }
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const queueRemoval = useCallback(
    (symbol: string, side: string, chatId?: string | null) => {
      const identifierKey = makePositionKey(symbol, side as Position['side'], chatId ?? undefined);
      pendingUpsertsRef.current.delete(identifierKey);
      pendingRemovalsRef.current.add(identifierKey);
      scheduleFlush();
    },
    [scheduleFlush],
  );

  const applySnapshot = useCallback(async () => {
    try {
      const positions = await fetchPositionsList();
      applyPositionsSnapshot(positions);
      if (isMountedRef.current) {
        setState(prev => ({ ...prev, lastError: null }));
      }
    } catch (error) {
      console.error('[positions-live] Snapshot fetch failed:', error);
      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          lastError: error instanceof Error ? error.message : 'ポジションの取得に失敗しました',
        }));
      }
    }
  }, []);

  const handleLiveEvent = useCallback(
    (event: PositionsLiveEvent) => {
      if ('schemaVersion' in event && event.schemaVersion) {
        console.info('[positions-live] schema version', event.schemaVersion);
      }

      if ('emittedAt' in event && event.emittedAt) {
        const emittedTime = Date.parse(event.emittedAt);
        if (!Number.isNaN(emittedTime)) {
          const drift = Date.now() - emittedTime;
          if (Math.abs(drift) > 60_000) {
            console.warn('[positions-live] Event emittedAt drift detected (ms):', drift);
          }
        }
      }

      switch (event.type) {
        case 'positions.snapshot.request':
          void applySnapshot();
          return;
        case 'positions.removed':
          queueRemoval(event.payload.symbol, event.payload.side, event.payload.chatId);
          return;
        case 'positions.upsert': {
          const position = toPosition(event.payload);
          if (!position) return;
          queueUpsert(position);
          return;
        }
        case 'ping':
          if (websocketRef.current?.readyState === WebSocket.OPEN) {
            try {
              websocketRef.current.send(JSON.stringify({ type: 'pong' }));
            } catch (error) {
              console.warn('[positions-live] Failed to send pong:', error);
            }
          }
          return;
        case 'pong':
          lastPongRef.current = Date.now();
          if (isMountedRef.current) {
            setState(prev => ({ ...prev, lastHeartbeat: Date.now() }));
          }
          return;
        default:
          console.info('[positions-live] Ignoring unknown event type:', (event as PositionsLiveEvent).type);
      }
    },
    [applySnapshot, queueRemoval, queueUpsert],
  );

  const emitLocalEvent = useCallback(
    (event: MessageEvent) => {
      if (!event?.data) return;
      try {
        const parsed = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!parsed || typeof parsed.type !== 'string') return;
        if (isMountedRef.current) {
          setState(prev => ({ ...prev, lastHeartbeat: Date.now() }));
        }
        if (parsed.type === 'pong') {
          lastPongRef.current = Date.now();
        }
        handleLiveEvent(parsed as PositionsLiveEvent);
      } catch (error) {
        console.warn('[positions-live] Failed to parse live event payload:', error);
      }
    },
    [handleLiveEvent],
  );

  const attachWindowFallbackListeners = useCallback(() => {
    const eventListener = (event: Event) => {
      const detail = (event as CustomEvent).detail as PositionsLiveEvent | undefined;
      if (!detail) return;
      handleLiveEvent(detail);
    };
    window.addEventListener('positions.live', eventListener as EventListener);

    return () => {
      window.removeEventListener('positions.live', eventListener as EventListener);
    };
  }, [handleLiveEvent]);

  useEffect(() => {
    if (!autoConnect) {
      return attachWindowFallbackListeners();
    }

    const start = () => {
      let cancelled = false;

      const connect = async () => {
        if (cancelled) return;

        setState(prev => ({
          ...prev,
          connectionState: 'connecting',
          reconnecting: prev.connectionState === 'connected' ? prev.reconnecting : prev.reconnecting,
        }));

        let tokenValue: string | null = DEFAULT_WS_TOKEN ?? null;
        if (typeof getAuthToken === 'function') {
          try {
            const resolved = await Promise.resolve(getAuthToken());
            if (resolved) {
              tokenValue = resolved;
            }
          } catch (error) {
            console.warn('[positions-live] Failed to resolve auth token:', error);
          }
        } else if (typeof getAuthToken === 'string') {
          tokenValue = getAuthToken;
        }

        const resolvedUrl = createWebSocketUrl({
          overrideUrl: websocketUrl ?? DEFAULT_WS_URL ?? null,
          path: websocketPath,
          token: tokenValue,
        });

        if (!resolvedUrl) {
          if (isMountedRef.current) {
            setState(prev => ({
              ...prev,
              connectionState: 'disconnected',
              lastError: 'リアルタイム更新の接続先が設定されていません',
            }));
          }
          return;
        }

        const socket = new WebSocket(resolvedUrl);
        websocketRef.current = socket;

        socket.addEventListener('open', () => {
          retryDelayRef.current = 1000;
          if (!isMountedRef.current) return;
          lastPongRef.current = Date.now();
          setState(prev => ({
            ...prev,
            connectionState: 'connected',
            reconnecting: false,
            lastError: null,
            lastHeartbeat: Date.now(),
          }));
          clearPingInterval();
          pingIntervalRef.current = setInterval(() => {
            const currentSocket = websocketRef.current;
            if (!currentSocket || currentSocket.readyState !== WebSocket.OPEN) {
              return;
            }
            try {
              currentSocket.send(JSON.stringify({ type: 'ping' }));
            } catch (error) {
              console.warn('[positions-live] Failed to send ping:', error);
            }
            if (
              lastPongRef.current &&
              Date.now() - lastPongRef.current > heartbeatTimeoutMs
            ) {
              console.warn('[positions-live] Heartbeat timeout detected, closing socket');
              try {
                currentSocket.close();
              } catch (error) {
                console.warn('[positions-live] Failed to close socket after heartbeat timeout:', error);
              }
            }
          }, pingIntervalMs);
          void applySnapshot();
        });

        socket.addEventListener('message', emitLocalEvent);

        socket.addEventListener('close', () => {
          clearPingInterval();
          if (!isMountedRef.current) return;
          setState(prev => ({
            ...prev,
            connectionState: 'disconnected',
            reconnecting: true,
          }));
          if (cancelled) return;
          clearReconnectTimer();
          const delay = Math.min(retryDelayRef.current, maxReconnectDelayMs);
          const jitter = Math.random() * 250;
          reconnectTimeoutRef.current = setTimeout(() => {
            retryDelayRef.current = Math.min(retryDelayRef.current * 2, maxReconnectDelayMs);
            connect().catch(error => {
              console.warn('[positions-live] Reconnect attempt failed:', error);
            });
          }, delay + jitter);
        });

        socket.addEventListener('error', (event) => {
          console.warn('[positions-live] WebSocket error', event);
          if (isMountedRef.current) {
            setState(prev => ({
              ...prev,
              lastError: 'リアルタイム更新の接続に失敗しました',
            }));
          }
        });
      };

      connect().catch(error => {
        console.warn('[positions-live] Initial connect failed:', error);
      });

      return () => {
        cancelled = true;
        clearReconnectTimer();
        clearPingInterval();
        const currentSocket = websocketRef.current;
        if (currentSocket) {
          try {
            currentSocket.removeEventListener('message', emitLocalEvent);
            currentSocket.close();
          } catch (error) {
            console.warn('[positions-live] Error closing websocket during cleanup:', error);
          }
        }
      };
    };

    const cleanupConnect = start();
    const detachFallback = attachWindowFallbackListeners();

    return () => {
      cleanupConnect?.();
      detachFallback();
    };
  }, [
    autoConnect,
    websocketPath,
    websocketUrl,
    getAuthToken,
    pingIntervalMs,
    heartbeatTimeoutMs,
    maxReconnectDelayMs,
    attachWindowFallbackListeners,
    emitLocalEvent,
  ]);

  return useMemo(
    () => ({
      connectionState: state.connectionState,
      lastError: state.lastError,
      lastHeartbeat: state.lastHeartbeat,
      reconnecting: state.reconnecting,
      requestSnapshot: applySnapshot,
    }),
    [applySnapshot, state.connectionState, state.lastError, state.lastHeartbeat, state.reconnecting],
  );
}

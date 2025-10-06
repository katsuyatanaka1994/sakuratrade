import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PositionCard, type HoldingPositionCardData } from '../components/positions';
import {
  getState as getPositionsState,
  subscribe as subscribeToPositions,
  makePositionKey,
  applyPositionsSnapshot,
  type Position,
} from '../store/positions';
import { CHART_PATTERN_LABEL_MAP } from '../constants/chartPatterns';
import { fetchPositionsList } from '../lib/api/positions';
import { usePositionsLive } from '../hooks/usePositionsLive';
import { featureFlags } from '../lib/features';

const isClosedStatus = (status?: string) => {
  if (!status) return false;
  return status.toLowerCase() === 'closed';
};

const toTimestamp = (value: string) => {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCardData = (position: Position): HoldingPositionCardData => {
  const extended = position as Position & {
    note?: string;
    memo?: string;
    chartPattern?: string;
    chartPatternLabel?: string;
    patterns?: string[];
  };

  const rawPatterns = Array.isArray(extended.patterns) ? extended.patterns : undefined;
  const chartPatternKey = extended.chartPattern;
  const chartPatternLabel = extended.chartPatternLabel;

  const chartPatternLabelFromKey =
    typeof chartPatternKey === 'string' && chartPatternKey in CHART_PATTERN_LABEL_MAP
      ? CHART_PATTERN_LABEL_MAP[chartPatternKey as keyof typeof CHART_PATTERN_LABEL_MAP]
      : undefined;

  const patternChips: string[] = rawPatterns && rawPatterns.length > 0
    ? rawPatterns
    : chartPatternLabel
      ? [chartPatternLabel]
      : chartPatternLabelFromKey
        ? [chartPatternLabelFromKey]
        : [];

  const note = typeof extended.note === 'string' && extended.note.trim().length > 0
    ? extended.note.trim()
    : typeof extended.memo === 'string' && extended.memo.trim().length > 0
      ? extended.memo.trim()
      : undefined;

  return {
    id: makePositionKey(position.symbol, position.side, position.chatId ?? null),
    symbolCode: position.symbol,
    symbolName: position.name ?? position.symbol,
    side: position.side,
    averagePrice: position.avgPrice,
    quantity: position.qtyTotal,
    patterns: patternChips,
    memo: note,
    updatedAt: position.updatedAt,
    chatLink: position.chatId ? `/trade?chat=${encodeURIComponent(position.chatId)}` : '/trade',
  };
};

const selectPositions = (): Position[] => {
  const { positions } = getPositionsState();
  return Array.from(positions.values());
};

const PositionsPage: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>(() => selectPositions());
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const hydrationAttemptedRef = useRef(false);
  const isMountedRef = useRef(true);
  const liveEnabled = featureFlags.livePositions;
  const { connectionState, lastError: liveError, reconnecting } = usePositionsLive({ autoConnect: liveEnabled });

  const refreshPositions = useCallback(() => {
    setPositions(selectPositions());
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const hydrateFromServer = useCallback(async () => {
    if (typeof window === 'undefined') return;

    hydrationAttemptedRef.current = true;

    if (isMountedRef.current) {
      setIsHydrating(true);
      setHydrationError(null);
    }

    try {
      const fetchedPositions = await fetchPositionsList();

      applyPositionsSnapshot(fetchedPositions);

      if (isMountedRef.current) {
        setHydrationError(null);
      }
    } catch (error) {
      if (isMountedRef.current) {
        const message = error instanceof Error
          ? error.message
          : 'ポジション情報の取得に失敗しました。';
        setHydrationError(message);
      }
    } finally {
      if (isMountedRef.current) {
        setIsHydrating(false);
      }
    }
  }, [applyPositionsSnapshot, fetchPositionsList]);

  useEffect(() => {
    // Initial sync in case external consumers mutate store before mount
    refreshPositions();

    const unsubscribe = subscribeToPositions(refreshPositions);
    const handlePositionsChanged = () => refreshPositions();

    if (typeof window !== 'undefined') {
      window.addEventListener('positions-changed', handlePositionsChanged);
    }

    return () => {
      unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('positions-changed', handlePositionsChanged);
      }
    };
  }, [refreshPositions]);

  useEffect(() => {
    if (positions.length > 0 || hydrationAttemptedRef.current) {
      return;
    }

    void hydrateFromServer();
  }, [positions.length, hydrateFromServer]);

  const handleHydrationRetry = useCallback(() => {
    if (isHydrating) return;
    void hydrateFromServer();
  }, [hydrateFromServer, isHydrating]);

  const cardData = useMemo(() => {
    return positions
      .filter((position) => position.qtyTotal > 0 && !isClosedStatus(position.status))
      .sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
      .map(toCardData);
  }, [positions]);

  const effectiveError = hydrationError ?? (liveEnabled ? liveError : null);
  const connectionMessage = liveEnabled
    ? connectionState === 'connected'
      ? 'リアルタイム更新を受信中'
      : reconnecting
        ? 'リアルタイム接続を再試行しています…'
        : 'リアルタイム更新は一時停止中です'
    : 'リアルタイム更新は無効化されています。';

  return (
    <div className="min-h-screen bg-[#F5F5F7] px-6 py-8">
      <div className="mx-auto w-full max-w-none">
        <div className="mb-6" aria-live="polite" role="status">
          {/* ヘッダー表示を省略 */}
        </div>

        {cardData.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 bg-white py-16 text-center text-gray-500">
            {isHydrating ? (
              <span>保有ポジションを同期しています…</span>
            ) : effectiveError ? (
              <div className="space-y-3">
                <p>ポジション情報の取得に失敗しました。</p>
                <p className="break-words text-xs text-gray-400">{effectiveError}</p>
                <button
                  type="button"
                  onClick={handleHydrationRetry}
                  className="text-sm font-medium text-sky-600 transition-colors hover:text-sky-700"
                >
                  再試行する
                </button>
              </div>
            ) : (
              '現在、保有中のポジションはありません。'
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
            {cardData.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PositionsPage;

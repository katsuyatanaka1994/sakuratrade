/**
 * Entry足判定 v0.4 メインスコア計算
 *
 * エントリー足の総合評価
 */
import { mergeOptions } from './options.js';
import { roundTo } from './utils.js';
import { validateGate } from './gateValidation.js';
import { calculateMAScore, getMAFinalScore } from './maScore.js';
import { calculateCandleScore } from './candleScore.js';
import { calculateVolumeScore } from './volumeScore.js';
/**
 * ラベルを決定
 * @param finalScore - 最終スコア
 * @param gatePassed - ゲート通過フラグ
 * @param strongCutoff - 強エントリー閾値
 * @param entryCutoff - エントリー可能閾値
 * @returns ラベル
 */
function determineLabel(finalScore, gatePassed, strongCutoff, entryCutoff) {
    // ゲート未通過は強制的に見送り
    if (!gatePassed) {
        return '見送り';
    }
    if (finalScore >= strongCutoff) {
        return '強エントリー';
    }
    else if (finalScore >= entryCutoff) {
        return 'エントリー可';
    }
    else {
        return '見送り';
    }
}
/**
 * Entry足判定 v0.4 メイン関数
 * @param bar - 評価対象の足データ
 * @param indicators - テクニカル指標
 * @param context - コンテキスト（オプション）
 * @returns エントリー判定結果
 */
export function scoreEntryV04(bar, indicators, context = {}) {
    // オプション設定
    const options = mergeOptions(context.options);
    // ゲート検証
    const gateResult = validateGate(bar.close, indicators, context, options);
    // 各サブスコア計算
    const maDetails = calculateMAScore(indicators, options);
    const maScore = getMAFinalScore(maDetails);
    const candleDetails = calculateCandleScore(bar, indicators, options);
    const candleScore = candleDetails.adjustedScore;
    const volumeDetails = calculateVolumeScore(bar, indicators);
    const volumeScore = volumeDetails.score;
    // 重み付けスコア計算
    const weightedMA = roundTo(maScore * options.wMA);
    const weightedCandle = roundTo(candleScore * options.wCandle);
    const weightedVolume = roundTo(volumeScore * options.wVolume);
    // 最終スコア
    const finalScore = roundTo(weightedMA + weightedCandle + weightedVolume);
    // ラベル決定
    const label = determineLabel(finalScore, gateResult.passed, options.strongCutoff, options.entryCutoff);
    // 欠損データ収集
    const missing = [];
    if (indicators.sma5 == null)
        missing.push('sma5');
    if (indicators.sma20 == null)
        missing.push('sma20');
    if (indicators.sma60 == null)
        missing.push('sma60');
    if (indicators.volMA5 == null)
        missing.push('volMA5');
    if (indicators.prevHigh == null)
        missing.push('prevHigh');
    if (indicators.prevLow == null)
        missing.push('prevLow');
    if (indicators.prevClose == null)
        missing.push('prevClose');
    // 説明文生成（後で実装）
    const explain = generateExplain(label, finalScore, gateResult.passed, maDetails, candleDetails, volumeDetails);
    return {
        version: 'v0.4',
        gatePassed: gateResult.passed,
        scores: {
            MA: maScore,
            Candle: candleScore,
            Volume: volumeScore,
        },
        weighted: {
            MA: weightedMA,
            Candle: weightedCandle,
            Volume: weightedVolume,
        },
        final: finalScore,
        label,
        explain,
        details: {
            ma: maDetails,
            candle: candleDetails,
            volume: volumeDetails,
            ...(missing.length > 0 && { missing }),
            ...(gateResult.failures.length > 0 && { gateFailures: gateResult.failures }),
        },
    };
}
/**
 * 説明文を生成（簡易版）
 */
function generateExplain(label, finalScore, gatePassed, maDetails, candleDetails, volumeDetails) {
    if (!gatePassed) {
        return `ゲート条件未達により見送り（スコア: ${finalScore}点）`;
    }
    const maDesc = maDetails.isProperArrangement ? 'MA順調' : 'MA混在';
    const candleDesc = candleDetails.pattern.replace(/_/g, ' ');
    const volDesc = `${volumeDetails.volumeRatio}×`;
    return `${label}（${finalScore}点）: MA ${maDesc}, Candle ${candleDesc}, Vol ${volDesc}`;
}
//# sourceMappingURL=entryScore.js.map
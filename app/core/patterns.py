from __future__ import annotations

from typing import List

PATTERN_VERSION = "2025.10"

PATTERN_DEFINITIONS: List[dict[str, object]] = [
    {
        "code": "PULLBACK_BUY",
        "value": "pullback-buy",
        "label": "押し目買い",
        "description": "上昇トレンドの押し目で買い付けるパターン",
        "deprecated": False,
    },
    {
        "code": "RETEST_SHORT",
        "value": "retest-short",
        "label": "戻り売り",
        "description": "下落トレンドでの戻りを狙った売りパターン",
        "deprecated": False,
    },
    {
        "code": "BREAKOUT",
        "value": "breakout",
        "label": "ブレイクアウト",
        "description": "抵抗線を上抜けしたタイミングで仕掛けるパターン",
        "deprecated": False,
    },
    {
        "code": "DOUBLE_BOTTOM",
        "value": "double-bottom",
        "label": "ダブルボトム",
        "description": "二番底で反転を狙うパターン",
        "deprecated": False,
    },
    {
        "code": "TREND_FOLLOW",
        "value": "trend-follow",
        "label": "トレンドフォロー",
        "description": "既存トレンドに沿ってエントリーするパターン",
        "deprecated": False,
    },
]

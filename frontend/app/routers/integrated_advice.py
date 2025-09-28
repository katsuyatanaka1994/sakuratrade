import base64
import os
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_async_db
from schemas.indicators import AnalysisResponse
from services.integrated_advice_service import IntegratedAdviceService

router = APIRouter()

# 環境変数からOpenAI APIキーを取得
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


@router.post("/integrated-analysis", response_model=AnalysisResponse)
async def integrated_analysis(
    file: UploadFile = File(..., description="チャート画像ファイル"),
    symbol: Optional[str] = Form(None, description="銘柄名・証券コード"),
    entry_price: Optional[float] = Form(None, description="建値"),
    position_type: Optional[Literal["long", "short"]] = Form(None, description="ポジションタイプ"),
    analysis_context: Optional[str] = Form(None, description="分析コンテキスト"),
    db: AsyncSession = Depends(get_async_db),
):
    """
    統合分析エンドポイント

    - チャート画像をアップロード
    - pivot1.3 + entry-v04 のルールベース判定
    - GPT-4o による画像解析
    - 両者を統合した総合判定を返却
    """

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    try:
        # ファイル読み込み
        image_data = await file.read()

        # ファイルサイズチェック（10MB制限）
        if len(image_data) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="ファイルサイズが大きすぎます（10MB制限）")

        # ファイル形式チェック
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="画像ファイルのみアップロード可能です")

        # 統合アドバイスサービス初期化
        advice_service = IntegratedAdviceService(OPENAI_API_KEY)

        # 統合分析実行
        result = await advice_service.generate_integrated_advice(
            image_data=image_data,
            filename=file.filename,
            symbol_context=symbol,
            analysis_context=analysis_context,
            entry_price=entry_price,
            position_type=position_type,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析中にエラーが発生しました: {str(e)}")


@router.post("/quick-analysis")
async def quick_analysis(
    file: UploadFile = File(..., description="チャート画像ファイル"),
    symbol: Optional[str] = Form(None, description="銘柄名・証券コード"),
    analysis_context: Optional[str] = Form(None, description="分析コンテキスト"),
):
    """
    クイック分析エンドポイント（GPTのみ、軽量版）

    統合分析よりも高速だが、ルールベース判定は含まない
    """

    if not OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")

    try:
        image_data = await file.read()
        image_base64 = base64.b64encode(image_data).decode("utf-8")

        # シンプルなGPT分析のみ実行
        from services.integrated_advice_service import generate_simple_advice

        advice_text = generate_simple_advice(
            image_base64=image_base64, symbol_context=symbol, analysis_context=analysis_context
        )

        return JSONResponse(
            {"success": True, "message": advice_text, "analysis_type": "quick_gpt_only", "filename": file.filename}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"分析中にエラーが発生しました: {str(e)}")


@router.get("/analysis-status")
async def analysis_status():
    """
    分析システムの稼働状況確認
    """
    status = {
        "integrated_analysis": "available",
        "quick_analysis": "available",
        "rule_based_modules": {
            "pivot_v13": "available" if os.path.exists("pivot/dist/pivotScore.js") else "unavailable",
            "entry_v04": "available" if os.path.exists("entry-v04/dist/entryScore.js") else "unavailable",
        },
        "gpt_analysis": "available" if OPENAI_API_KEY else "unavailable",
        "template_system": "available",
    }

    overall_status = (
        "healthy"
        if all(
            [
                status["rule_based_modules"]["pivot_v13"] == "available",
                status["rule_based_modules"]["entry_v04"] == "available",
                status["gpt_analysis"] == "available",
            ]
        )
        else "partial"
    )

    return {"overall_status": overall_status, "details": status, "timestamp": "2024-01-15T10:00:00Z"}


@router.post("/test-integration")
async def test_integration():
    """
    統合システムのテスト用エンドポイント
    """

    try:
        # テスト用のサンプルデータで統合分析をテスト
        advice_service = IntegratedAdviceService(OPENAI_API_KEY or "test_key")

        # ダミー画像データ（1x1ピクセル透明PNG）
        dummy_image = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        )

        result = await advice_service.generate_integrated_advice(
            image_data=dummy_image,
            filename="test.png",
            symbol_context="TEST銘柄",
            analysis_context="テスト分析",
            entry_price=1000.0,
            position_type="long",
        )

        return {
            "test_status": "success",
            "integration_working": result.success,
            "analysis_generated": result.analysis is not None,
            "feedback_generated": bool(result.natural_feedback),
            "sample_analysis": {
                "overall_evaluation": result.analysis.overall_evaluation if result.analysis else None,
                "confidence_score": result.analysis.confidence_score if result.analysis else None,
                "indicators_count": len(result.analysis.indicators) if result.analysis else 0,
            },
        }

    except Exception as e:
        return {"test_status": "error", "error_message": str(e), "integration_working": False}

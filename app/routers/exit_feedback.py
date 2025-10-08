from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.database import get_async_db
from app.schemas.exit_feedback import ExitFeedbackRequest, ExitFeedbackResponse
from app.services.exit_feedback_service import ExitFeedbackService

router = APIRouter()

settings = get_settings()


def _require_openai_key() -> str:
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OpenAI API key not configured")
    return settings.openai_api_key


@router.post("/feedback/exit", response_model=ExitFeedbackResponse)
async def generate_exit_feedback(
    trade_id: Optional[str] = Form(None, description="トレードID"),
    symbol: str = Form(..., description="銘柄名・証券コード"),
    entry_price: float = Form(..., description="建値"),
    exit_price: float = Form(..., description="決済値"),
    position_type: str = Form(..., description="ポジションタイプ(long/short)"),
    quantity: int = Form(..., description="数量"),
    file: Optional[UploadFile] = File(None, description="チャート画像ファイル"),
    entry_date: Optional[str] = Form(None, description="エントリー日時"),
    exit_date: Optional[str] = Form(None, description="決済日時"),
    db: AsyncSession = Depends(get_async_db),
):
    """
    決済時フィードバック生成エンドポイント

    - チャート画像を分析して振り返りポイントを生成
    - GPT-4oによる画像解析でトレードの振り返りを構造化
    - HTML形式で視認性の高いフィードバックを返却
    """

    api_key = _require_openai_key()

    try:
        # リクエストデータ作成
        request = ExitFeedbackRequest(
            trade_id=trade_id,
            symbol=symbol,
            entry_price=entry_price,
            exit_price=exit_price,
            position_type=position_type.lower(),
            quantity=quantity,
            image_file=file.filename if file else None,
            entry_date=entry_date,
            exit_date=exit_date,
        )

        # ファイル処理
        image_data = None
        if file:
            # ファイルサイズチェック（10MB制限）
            file_content = await file.read()
            if len(file_content) > 10 * 1024 * 1024:
                raise HTTPException(status_code=413, detail="ファイルサイズが大きすぎます（10MB制限）")

            # ファイル形式チェック
            if not file.content_type or not file.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="画像ファイルのみアップロード可能です")

            image_data = file_content

        # フィードバック生成サービス初期化
        feedback_service = ExitFeedbackService(api_key)

        # 決済フィードバック生成
        result = feedback_service.generate_exit_feedback(request, image_data)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"フィードバック生成中にエラーが発生しました: {str(e)}")


@router.get("/feedback/status")
async def feedback_status():
    """
    フィードバックシステムの稼働状況確認
    """
    status = {
        "exit_feedback": "available",
        "gpt_analysis": "available" if settings.openai_api_key else "unavailable",
        "template_system": "available",
    }

    overall_status = "healthy" if status["gpt_analysis"] == "available" else "partial"

    return {"overall_status": overall_status, "details": status, "timestamp": "2024-01-15T10:00:00Z"}

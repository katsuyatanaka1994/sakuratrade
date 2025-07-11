from datetime import datetime
from fastapi import APIRouter

from .. import schemas

router = APIRouter(prefix="/patterns", tags=["patterns"])


@router.get("/{trade_id}", response_model=schemas.PatternResult)
async def get_pattern(trade_id: int) -> schemas.PatternResult:
    # TODO: fetch pattern result
    return schemas.PatternResult(
        pattern_id=1,
        trade_id=trade_id,
        rule="demo",
        score=0.0,
        diagnosed_at=datetime.utcnow(),
    )

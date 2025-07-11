from datetime import datetime
from fastapi import APIRouter, status

from .. import schemas

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=schemas.Alert, status_code=status.HTTP_201_CREATED)
async def create_alert(alert: schemas.Alert) -> schemas.Alert:
    # TODO: persist alert
    if alert.alert_id is None:
        alert.alert_id = 1
    return alert


@router.get("/{trade_id}", response_model=list[schemas.Alert])
async def list_alerts(trade_id: int) -> list[schemas.Alert]:
    # TODO: fetch alerts
    dummy = schemas.Alert(
        alert_id=1,
        trade_id=trade_id,
        type=schemas.AlertType.TP,
        target_price=0.0,
        triggered_at=datetime.utcnow(),
    )
    return [dummy]

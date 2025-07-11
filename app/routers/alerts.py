from typing import Optional, List
from datetime import datetime
from enum import Enum
from pydantic import BaseModel

class AlertType(str, Enum):
    TP = "TP"
    SL = "SL"

class Alert(BaseModel):
    alert_id: Optional[int] = None
    trade_id: int
    type: AlertType
    target_price: Optional[float] = None
    triggered_at: Optional[datetime] = None


from enum import Enum
from typing import Optional
from datetime import datetime
from pydantic import BaseModel

class AlertType(str, Enum):
    PRICE = "price"
    VOLUME = "volume"

class Alert(BaseModel):
    alertId: str
    type: AlertType
    message: str
    target_price: Optional[float] = None
    triggered_at: Optional[datetime] = None

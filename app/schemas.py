from pydantic import BaseModel
from datetime import datetime
from enum import Enum

class AlertType(str, Enum):
    PRICE = "price"
    VOLUME = "volume"

class Alert(BaseModel):
    alertId: str
    type: AlertType
    message: str
    target_price: float | None = None
    triggered_at: datetime | None = None
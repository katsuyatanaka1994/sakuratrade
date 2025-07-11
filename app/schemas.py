from enum import Enum
from pydantic import BaseModel
from datetime import datetime

class AlertType(str, Enum):
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"

class Alert(BaseModel):
    alertId: str
    type: AlertType
    message: str
    triggeredAt: datetime
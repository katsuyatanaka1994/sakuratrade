# app/schemas/alert.py

# app/schemas/alert.py

from enum import Enum
from pydantic import BaseModel
from typing import Optional


class AlertType(str, Enum):
    WARNING = "warning"
    ERROR = "error"
    INFO = "info"

class Alert(BaseModel):
    type: AlertType
    message: str
    level: Optional[str] = "info"
    
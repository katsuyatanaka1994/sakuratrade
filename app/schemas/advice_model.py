from pydantic import BaseModel
from typing import Optional, Dict, Any

class AdviceRequest(BaseModel):
    indicators: Optional[Dict[str, Any]] = None
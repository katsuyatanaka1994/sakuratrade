from typing import Any, Dict, Optional

from pydantic import BaseModel


class AdviceRequest(BaseModel):
    indicators: Optional[Dict[str, Any]] = None

from pydantic import BaseModel
from typing import Optional

class PatternResult(BaseModel):
    pattern_name: str
    confidence: Optional[float] = None
    description: Optional[str] = None
    
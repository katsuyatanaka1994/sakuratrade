from typing import Optional

from pydantic import BaseModel


class PatternResult(BaseModel):
    pattern_name: str
    confidence: Optional[float] = None
    description: Optional[str] = None

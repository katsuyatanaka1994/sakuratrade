from typing import List, Optional

from pydantic import BaseModel


class PatternResult(BaseModel):
    pattern_name: str
    confidence: Optional[float] = None
    description: Optional[str] = None


class PatternDefinition(BaseModel):
    code: str
    value: str
    label: str
    description: Optional[str] = None
    deprecated: bool = False


class PatternCatalog(BaseModel):
    pattern_version: str
    version: str
    patterns: List[PatternDefinition]

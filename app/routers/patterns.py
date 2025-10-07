from __future__ import annotations

from fastapi import APIRouter

from app.core.patterns import PATTERN_DEFINITIONS, PATTERN_VERSION
from app.schemas.pattern import PatternCatalog, PatternDefinition

router = APIRouter(prefix="/patterns", tags=["patterns"])


@router.get("", response_model=PatternCatalog)
async def list_patterns() -> PatternCatalog:
    """Return chart pattern catalog for frontend synchronisation."""

    patterns = [PatternDefinition(**definition) for definition in PATTERN_DEFINITIONS]
    return PatternCatalog(pattern_version=PATTERN_VERSION, version=PATTERN_VERSION, patterns=patterns)

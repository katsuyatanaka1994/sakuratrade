from __future__ import annotations

import json
import uuid
from enum import Enum
from typing import Any, Type

from sqlalchemy import String, Text
from sqlalchemy.types import TypeDecorator


class UUIDStr(TypeDecorator):
    """Store UUID values as canonical strings for cross-database compatibility."""

    impl = String(36)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect) -> str | None:  # pragma: no cover
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return str(value)
        return str(uuid.UUID(str(value)))

    def process_result_value(self, value: Any, dialect) -> uuid.UUID | None:  # pragma: no cover
        if value is None:
            return None
        return uuid.UUID(str(value))


class EnumStr(TypeDecorator):
    """Persist Enum values as short strings regardless of backend."""

    cache_ok = True

    def __init__(self, enum_cls: Type[Enum], length: int = 64) -> None:
        super().__init__()
        self.enum_cls = enum_cls
        self.impl = String(length)

    def process_bind_param(self, value: Any, dialect) -> str | None:  # pragma: no cover
        if value is None:
            return None
        if isinstance(value, Enum):
            return value.value
        return str(value)

    def process_result_value(self, value: Any, dialect) -> Enum | str | None:  # pragma: no cover
        if value is None:
            return None
        try:
            return self.enum_cls(value)
        except Exception:
            return value


class JSONText(TypeDecorator):
    """Persist JSON structures as TEXT (useful for SQLite)."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: Any, dialect) -> str | None:  # pragma: no cover
        if value is None:
            return None
        return json.dumps(value)

    def process_result_value(self, value: Any, dialect) -> Any:  # pragma: no cover
        if value is None:
            return None
        return json.loads(value)


__all__ = ["UUIDStr", "EnumStr", "JSONText"]

from typing import Optional

from pydantic import BaseModel


class Image(BaseModel):
    filename: str
    content_type: str
    size: Optional[int] = None

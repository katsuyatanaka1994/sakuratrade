from pydantic import BaseModel
from typing import Optional

class Image(BaseModel):
    filename: str
    content_type: str
    size: Optional[int] = None
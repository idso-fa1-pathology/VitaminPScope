from typing import List, Optional

from pydantic import BaseModel, Field


class UploadedItem(BaseModel):
    name: str
    path: str
    type: str
    size: int = 0
    kind: str = "slide"
    overwritten: bool = False


class UploadFailure(BaseModel):
    name: str
    error: str


class UploadResponse(BaseModel):
    uploaded: List[UploadedItem] = Field(default_factory=list)
    failed: List[UploadFailure] = Field(default_factory=list)
    target_path: str = ""
    message: Optional[str] = None